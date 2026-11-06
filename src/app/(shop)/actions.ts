"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "@/server/settings";
import { priceCart, findDeliveryZone, checkPromo, deliveryFee } from "@/server/pricing";
import { getCustomerAvailability } from "@/server/slots";
import { createOrder, cancelOrder, canCustomerCancel } from "@/server/orders";
import { getCurrentUser } from "@/server/auth";
import { rateLimit, clientIp } from "@/server/rate-limit";
import { runMaintenance } from "@/server/maintenance";
import { formatPrice } from "@/lib/format";
import { logSystem } from "@/server/log";

const linesSchema = z
  .array(z.object({ productId: z.number().int().positive(), qty: z.number().int().min(1).max(50), optionIds: z.array(z.number().int()).max(20) }))
  .max(50);

/** Revalide le panier côté serveur : prix actuels, disponibilité, options. */
export async function validateCart(raw: unknown) {
  const lines = linesSchema.safeParse(raw);
  if (!lines.success) return { ok: false as const, error: "Panier invalide." };
  await runMaintenance();
  const priced = await priceCart(lines.data);
  return {
    ok: true as const,
    lines: priced.lines.map((l) => ({ productId: l.productId, optionIds: l.optionIds, unitPriceCents: l.unitPriceCents, issue: l.issue, maxQty: l.maxQty, name: l.name })),
    subtotalCents: priced.subtotalCents,
  };
}

export type ClientSlot = { key: string; label: string; state: string };
export type ClientDay = { day: string; closedReason: string | null; productIssue: string | null; slots: ClientSlot[] };

export async function getAvailability(mode: "pickup" | "delivery", raw: unknown): Promise<{ ok: true; days: ClientDay[] } | { ok: false; error: string }> {
  const lines = linesSchema.safeParse(raw);
  if (!lines.success || !["pickup", "delivery"].includes(mode)) return { ok: false, error: "Requête invalide." };
  await runMaintenance();
  const s = await getSettings();
  if (s.ordering.paused) return { ok: false, error: s.ordering.pauseMessage };
  const days = await getCustomerAvailability(s, mode, lines.data);
  return {
    ok: true,
    days: days.map((d) => ({
      day: d.day,
      closedReason: d.closedReason,
      productIssue: d.productIssue,
      slots: d.slots.filter((x) => x.state !== "past").map((x) => ({ key: x.key, label: x.label, state: x.state })),
    })),
  };
}

export async function checkDeliveryAddress(postalCode: string, city: string) {
  const pc = String(postalCode ?? "").replace(/\s/g, "");
  if (!/^\d{5}$/.test(pc)) return { ok: false as const, error: "Code postal invalide (5 chiffres)." };
  const zone = await findDeliveryZone(pc, String(city ?? ""));
  if (!zone) return { ok: false as const, error: "Désolé, nous ne livrons pas encore à cette adresse. Le retrait reste possible !" };
  return {
    ok: true as const,
    zone: { name: zone.name, feeCents: zone.feeCents, minOrderCents: zone.minOrderCents, freeAboveCents: zone.freeAboveCents },
  };
}

/** Calcul du total (identique à celui utilisé au paiement). */
export async function quote(input: { mode: "pickup" | "delivery"; lines: unknown; postalCode?: string; city?: string; promoCode?: string }) {
  const lines = linesSchema.safeParse(input.lines);
  if (!lines.success) return { ok: false as const, error: "Panier invalide." };
  const s = await getSettings();
  const priced = await priceCart(lines.data);
  let discount = 0;
  let promoError: string | null = null;
  let promoLabel: string | null = null;
  if (input.promoCode && s.ordering.promoCodesEnabled) {
    if (!(await rateLimit(`promo:${await clientIp()}`, 30, 600))) return { ok: false as const, error: "Trop de tentatives. Réessayez plus tard." };
    const pr = await checkPromo(input.promoCode, priced.subtotalCents);
    if (pr.ok) {
      discount = pr.discountCents;
      promoLabel = pr.promo.kind === "percent" ? `-${pr.promo.value} %` : `-${formatPrice(pr.promo.value)}`;
    } else promoError = pr.error;
  }
  let fee = 0;
  let deliveryError: string | null = null;
  if (input.mode === "delivery") {
    const zone = input.postalCode ? await findDeliveryZone(input.postalCode, input.city ?? "") : null;
    if (!zone) deliveryError = "Adresse hors zone de livraison.";
    else {
      fee = deliveryFee(zone, priced.subtotalCents - discount);
      if (priced.subtotalCents < zone.minOrderCents) deliveryError = `Minimum de commande pour la livraison : ${formatPrice(zone.minOrderCents)}.`;
    }
  }
  return {
    ok: true as const,
    subtotalCents: priced.subtotalCents,
    discountCents: discount,
    deliveryFeeCents: fee,
    totalCents: priced.subtotalCents - discount + fee,
    promoError,
    promoLabel,
    deliveryError,
    issues: priced.lines.filter((l) => l.issue).map((l) => `${l.name} : ${l.issue}`),
  };
}

export async function placeOrder(input: unknown) {
  const ip = await clientIp();
  if (!(await rateLimit(`order:${ip}`, 12, 900))) return { ok: false as const, error: "Trop de tentatives de commande. Merci de patienter quelques minutes." };
  await runMaintenance();
  const user = await getCurrentUser();
  try {
    return await createOrder(input, user?.role === "customer" ? user.id : null);
  } catch (e) {
    await logSystem("error", "Erreur inattendue au passage de commande", e);
    return { ok: false as const, error: "Une erreur technique est survenue. Aucun paiement n’a été effectué." };
  }
}

/** Annulation par le client depuis le lien de suivi (le jeton secret fait office d'authentification). */
export async function customerCancel(token: string) {
  if (!(await rateLimit(`cancel:${await clientIp()}`, 10, 600))) return { ok: false as const, error: "Trop de tentatives." };
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.publicToken, String(token)) });
  if (!order) return { ok: false as const, error: "Commande introuvable." };
  if (!(await canCustomerCancel(order))) return { ok: false as const, error: "Cette commande ne peut plus être annulée en ligne. Contactez-nous par téléphone." };
  const r = await cancelOrder(order.id, { id: order.userId, label: `${order.customerName} (client)` }, { reason: "Annulée par le client", restock: true, refund: true, byCustomer: true });
  return r.ok ? { ok: true as const, message: "Votre commande a été annulée et remboursée." } : r;
}
