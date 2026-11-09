import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { OrderStatus } from "@/lib/constants";
import { STATUS } from "@/lib/constants";
import { nextStatus, previousStatus } from "@/lib/status-flow";
import { parisDay, isoWeekday, formatHour } from "@/lib/time";
import { formatPrice } from "@/lib/format";
import { getSettings } from "./settings";
import { buildDay } from "./slots";
import { reserve, commit, release, AvailabilityError } from "./inventory";
import { priceCart, findDeliveryZone, checkPromo, deliveryFee } from "./pricing";
import { createCheckout, stripeEnabled, refundPayment, expireCheckoutSession } from "./payments";
import { enqueueCustomerEmail, enqueueAdminEmail, enqueueAdminSms, flushOutboxSafely } from "./notifications";
import { randomToken } from "./auth";
import { audit, logSystem, SYSTEM, type Actor } from "./log";

type Order = typeof schema.orders.$inferSelect;

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

export const orderInputSchema = z
  .object({
    items: z
      .array(z.object({ productId: z.number().int().positive(), qty: z.number().int().min(1).max(50), optionIds: z.array(z.number().int()).max(20).default([]) }))
      .min(1, "Votre panier est vide.")
      .max(50),
    mode: z.enum(["pickup", "delivery"]),
    slot: z.string().datetime(),
    name: z.string().trim().min(2, "Merci d’indiquer votre nom.").max(80),
    email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(160),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 .-]{9,20}$/, "Numéro de téléphone invalide."),
    addressLine: z.string().trim().max(200).optional().default(""),
    postalCode: z.string().trim().max(10).optional().default(""),
    city: z.string().trim().max(80).optional().default(""),
    deliveryInstructions: z.string().trim().max(300).optional().default(""),
    kitchenNotes: z.string().trim().max(300).optional().default(""),
    promoCode: z.string().trim().max(40).optional().default(""),
    acceptTerms: z.literal(true, { message: "Merci d’accepter les conditions générales de vente." }),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "delivery") {
      if (v.addressLine.length < 5) ctx.addIssue({ code: "custom", path: ["addressLine"], message: "Adresse de livraison requise." });
      if (!/^\d{5}$/.test(v.postalCode.replace(/\s/g, ""))) ctx.addIssue({ code: "custom", path: ["postalCode"], message: "Code postal invalide." });
      if (v.city.length < 2) ctx.addIssue({ code: "custom", path: ["city"], message: "Ville requise." });
    }
  });

export type OrderInput = z.input<typeof orderInputSchema>;
export type CreateOrderResult = { ok: true; redirectUrl: string; token: string } | { ok: false; error: string; field?: string; code?: string };

export async function createOrder(raw: unknown, userId: string | null): Promise<CreateOrderResult> {
  const parsed = orderInputSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: i.message, field: String(i.path[0] ?? "") };
  }
  const input = parsed.data;
  const settings = await getSettings();
  const o = settings.ordering;
  const now = new Date();

  if (o.paused) return { ok: false, error: o.pauseMessage, code: "paused" };
  if (input.mode === "pickup" && !o.pickupEnabled) return { ok: false, error: "Le retrait n’est pas disponible actuellement." };
  if (input.mode === "delivery" && !o.deliveryEnabled) return { ok: false, error: "La livraison n’est pas disponible actuellement." };

  const totalQty = input.items.reduce((n, i) => n + i.qty, 0);
  if (totalQty > o.maxItemsPerOrder) return { ok: false, error: `Maximum ${o.maxItemsPerOrder} articles par commande. Contactez-nous pour une grosse commande.` };

  // Prix recalculés côté serveur
  const priced = await priceCart(input.items);
  const bad = priced.lines.find((l) => l.issue);
  if (bad) return { ok: false, error: `${bad.name} : ${bad.issue}`, code: "cart" };

  // Créneau
  const slotStart = new Date(input.slot);
  const day = parisDay(slotStart);
  const dayView = await buildDay(settings, day, { now, itemsCount: totalQty, mode: input.mode });
  const slot = dayView.slots.find((s) => s.key === slotStart.toISOString());
  if (!slot) return { ok: false, error: "Ce créneau n’existe pas. Merci d’en choisir un autre.", code: "slot" };
  if (slot.state === "too_soon")
    return { ok: false, error: `Les commandes doivent être passées au moins ${o.minLeadHours} h à l’avance. Merci de choisir un créneau plus tard.`, code: "slot" };
  if (slot.state !== "available") return { ok: false, error: "Ce créneau n’est plus disponible. Merci d’en choisir un autre.", code: "slot" };
  if (Math.round((slotStart.getTime() - now.getTime()) / 86400_000) > o.maxAdvanceDays + 1)
    return { ok: false, error: "Ce créneau est trop éloigné dans le temps.", code: "slot" };

  // Jours de vente des plats
  const wd = isoWeekday(day);
  const prods = await db
    .select({ id: schema.products.id, name: schema.products.name, availableDays: schema.products.availableDays })
    .from(schema.products)
    .where(inArray(schema.products.id, priced.lines.map((l) => l.productId)));
  for (const l of priced.lines) {
    const p = prods.find((x) => x.id === l.productId);
    if (p && p.availableDays.length && !p.availableDays.includes(wd)) return { ok: false, error: `« ${p.name} » n’est pas proposé ce jour-là.`, code: "slot" };
  }

  // Livraison
  let fee = 0;
  let promoId: number | null = null;
  let discount = 0;
  if (input.promoCode && o.promoCodesEnabled) {
    const pr = await checkPromo(input.promoCode, priced.subtotalCents, now);
    if (!pr.ok) return { ok: false, error: pr.error, field: "promoCode" };
    promoId = pr.promo.id;
    discount = pr.discountCents;
  }
  if (input.mode === "delivery") {
    const zone = await findDeliveryZone(input.postalCode, input.city);
    if (!zone) return { ok: false, error: "Désolé, nous ne livrons pas encore à cette adresse. Le retrait reste possible !", field: "postalCode" };
    if (priced.subtotalCents < zone.minOrderCents)
      return { ok: false, error: `Le minimum de commande pour la livraison dans votre zone est de ${formatPrice(zone.minOrderCents)}.`, code: "cart" };
    fee = deliveryFee(zone, priced.subtotalCents - discount);
  }
  const total = priced.subtotalCents - discount + fee;
  if (total < 50) return { ok: false, error: "Le montant minimum payable est de 0,50 €." };

  const holdExpiresAt = new Date(now.getTime() + (o.paymentHoldMinutes + 5) * 60000);
  const token = randomToken(18);

  let order: Order;
  try {
    order = await db.transaction(async (tx) => {
      const snapshot = await reserve(tx, {
        slotStart: slot.start,
        slotEnd: slot.end,
        day,
        defaultMaxOrders: o.defaultMaxOrdersPerSlot,
        defaultMaxItems: o.defaultMaxItemsPerSlot,
        maxOrdersPerDay: o.maxOrdersPerDay,
        maxItemsPerDay: o.maxItemsPerDay,
        lines: priced.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        promoId,
      });
      const num = await tx.execute<{ n: string }>(sql`SELECT nextval('order_number_seq') AS n`);
      const [created] = await tx
        .insert(schema.orders)
        .values({
          number: Number(num.rows[0].n),
          publicToken: token,
          userId,
          customerName: input.name,
          email: input.email,
          phone: input.phone,
          mode: input.mode,
          addressLine: input.mode === "delivery" ? input.addressLine : null,
          postalCode: input.mode === "delivery" ? input.postalCode.replace(/\s/g, "") : null,
          city: input.mode === "delivery" ? input.city : null,
          deliveryInstructions: input.mode === "delivery" ? input.deliveryInstructions || null : null,
          kitchenNotes: input.kitchenNotes || null,
          slotId: snapshot.slotId,
          slotStart: slot.start,
          slotEnd: slot.end,
          serviceDay: day,
          subtotalCents: priced.subtotalCents,
          deliveryFeeCents: fee,
          discountCents: discount,
          totalCents: total,
          promoCode: promoId ? input.promoCode.toUpperCase() : null,
          reservation: snapshot,
          holdExpiresAt,
        })
        .returning();
      await tx.insert(schema.orderItems).values(
        priced.lines.map((l) => ({
          orderId: created.id,
          productId: l.productId,
          productName: l.name,
          unitPriceCents: l.unitPriceCents,
          quantity: l.qty,
          options: l.options,
          lineTotalCents: l.lineTotalCents,
        })),
      );
      await tx.insert(schema.orderEvents).values({ orderId: created.id, kind: "status", toStatus: "pending_payment", message: "Commande créée, paiement en cours", actorLabel: "Client" });
      return created;
    });
  } catch (e) {
    if (e instanceof AvailabilityError) return { ok: false, error: e.message, code: e.code };
    await logSystem("error", "Erreur lors de la création d’une commande", e);
    return { ok: false, error: "Une erreur technique est survenue. Aucun paiement n’a été effectué. Merci de réessayer." };
  }

  // Paiement
  try {
    const { url, sessionId } = await createCheckout(
      { ...order, items: priced.lines.map((l) => ({ productName: l.name, quantity: l.qty, unitPriceCents: l.unitPriceCents, options: l.options })) },
      settings.business.name,
    );
    if (sessionId) await db.update(schema.orders).set({ checkoutSessionId: sessionId }).where(eq(schema.orders.id, order.id));
    return { ok: true, redirectUrl: url, token };
  } catch (e) {
    await logSystem("error", `Impossible de créer le paiement de la commande n°${order.number}`, e);
    await expireOrder(order.id, "Erreur du prestataire de paiement", { notify: false });
    return { ok: false, error: "Le service de paiement est momentanément indisponible. Aucun montant n’a été débité. Merci de réessayer dans quelques minutes." };
  }
}

/* ------------------------------------------------------------------ */
/* Paiement confirmé                                                   */
/* ------------------------------------------------------------------ */

export async function markOrderPaid(p: { orderId: string; provider: "stripe" | "demo"; reference: string | null; sessionId: string | null; amountCents: number }) {
  const settings = await getSettings();
  let lateFailure: Order | null = null;

  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, p.orderId)).for("update");
    if (!order) throw new Error(`Commande introuvable ${p.orderId}`);
    if (order.paymentStatus !== "unpaid" && order.paymentStatus !== "failed") return { order, already: true };

    if (p.amountCents !== order.totalCents) {
      await logSystem("error", `Montant payé (${formatPrice(p.amountCents)}) différent du total de la commande n°${order.number} (${formatPrice(order.totalCents)})`);
    }

    let snapshot = order.reservation;
    let canFulfil = true;
    if (order.reservationState === "released") {
      // Le paiement arrive après l'expiration de la réservation : on tente de re-réserver.
      try {
        await tx.execute(sql`SAVEPOINT rereserve`);
        snapshot = await reserve(tx, {
          slotStart: order.slotStart,
          slotEnd: order.slotEnd,
          day: order.serviceDay,
          defaultMaxOrders: settings.ordering.defaultMaxOrdersPerSlot,
          defaultMaxItems: settings.ordering.defaultMaxItemsPerSlot,
          maxOrdersPerDay: settings.ordering.maxOrdersPerDay,
          maxItemsPerDay: settings.ordering.maxItemsPerDay,
          lines: order.reservation.products.map((x) => ({ productId: x.id, qty: x.qty })),
          promoId: null,
        });
        await tx.execute(sql`RELEASE SAVEPOINT rereserve`);
      } catch (e) {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT rereserve`);
        if (!(e instanceof AvailabilityError)) throw e;
        canFulfil = false;
      }
    }

    await tx
      .insert(schema.payments)
      .values({ orderId: order.id, provider: p.provider, reference: p.reference, checkoutSessionId: p.sessionId, amountCents: p.amountCents, status: "succeeded", paidAt: new Date() })
      .onConflictDoNothing();

    if (!canFulfil) {
      const [upd] = await tx
        .update(schema.orders)
        .set({ paymentStatus: "paid", paidAt: new Date(), status: "cancelled", cancelledAt: new Date(), cancelReason: "Paiement reçu après expiration, plus de disponibilité", updatedAt: new Date() })
        .where(eq(schema.orders.id, order.id))
        .returning();
      await tx.insert(schema.orderEvents).values({ orderId: order.id, kind: "payment", message: `Paiement reçu (${formatPrice(p.amountCents)}) mais la réservation avait expiré et il n’y a plus de disponibilité : remboursement automatique.`, actorLabel: "Système" });
      lateFailure = upd;
      return { order: upd, already: false };
    }

    const low = await commit(tx, snapshot, order.id);
    const status: OrderStatus = settings.ordering.autoAccept ? "accepted" : "new";
    const [upd] = await tx
      .update(schema.orders)
      .set({ paymentStatus: "paid", paidAt: new Date(), status, reservation: snapshot, reservationState: "committed", updatedAt: new Date() })
      .where(eq(schema.orders.id, order.id))
      .returning();
    await tx.insert(schema.orderEvents).values([
      { orderId: order.id, kind: "payment", message: `Paiement confirmé : ${formatPrice(p.amountCents)} (${p.provider === "demo" ? "paiement simulé" : "Stripe"}${p.reference ? ` · ${p.reference}` : ""})`, actorLabel: "Système" },
      { orderId: order.id, kind: "status", fromStatus: order.status, toStatus: status, message: STATUS[status].label, actorLabel: "Système" },
    ]);

    await enqueueCustomerEmail(tx, order.id, "order_confirmed", { awaitingAcceptance: status === "new" });
    if (settings.notifications.notifyAdminNewOrder)
      await enqueueAdminEmail(
        tx,
        `new:${order.id}`,
        `Nouvelle commande n°${order.number} – ${formatPrice(order.totalCents)}`,
        [`${order.customerName} – ${order.mode === "pickup" ? "Retrait" : "Livraison"} le ${order.serviceDay}`],
        { path: `/admin/commandes/${order.id}`, label: "Voir la commande" },
        order.id,
      );
    await enqueueAdminSms(
      tx,
      `new:${order.id}`,
      `${settings.business.name} : nouvelle commande n°${order.number} (${formatPrice(order.totalCents)}), ${order.mode === "pickup" ? "retrait" : "livraison"} le ${order.serviceDay.split("-").reverse().slice(0, 2).join("/")} à ${formatHour(order.slotStart)}.`,
      "adminNewOrder",
      order.id,
    );
    if (settings.notifications.notifyAdminLowStock) {
      for (const l of low) {
        const name =
          l.kind === "product"
            ? (await tx.query.products.findFirst({ where: eq(schema.products.id, l.id) }))?.name
            : (await tx.query.ingredients.findFirst({ where: eq(schema.ingredients.id, l.id) }))?.name;
        await enqueueAdminEmail(tx, `low:${l.kind}:${l.id}:${parisDay()}`, `Stock bas : ${name}`, [`Le stock de « ${name} » a atteint son seuil d’alerte.`], { path: "/admin/stocks", label: "Gérer les stocks" });
      }
    }
    return { order: upd, already: false };
  });

  if (lateFailure) {
    const o = lateFailure as Order;
    await refundOrder(o.id, o.totalCents, "Créneau ou plats plus disponibles au moment du paiement", SYSTEM, { silent: true });
    await db.transaction(async (tx) => {
      await enqueueCustomerEmail(tx, o.id, "cancelled", { reason: "Votre paiement est arrivé après l’expiration de votre réservation et les plats ne sont plus disponibles.", refundCents: o.totalCents });
      await enqueueAdminEmail(tx, `late:${o.id}`, `Commande n°${o.number} remboursée automatiquement`, ["Paiement reçu après expiration de la réservation, sans disponibilité restante."], { path: `/admin/commandes/${o.id}`, label: "Voir" }, o.id);
    });
  }
  if (!result.already) {
    await audit(SYSTEM, "order.paid", "order", result.order.id, { provider: p.provider, amount: p.amountCents });
    await flushOutboxSafely();
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Expiration / échec de paiement                                      */
/* ------------------------------------------------------------------ */

export async function expireOrder(orderId: string, reason: string, opts: { notify?: boolean } = {}) {
  const done = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for("update");
    if (!order || order.status !== "pending_payment" || order.paymentStatus !== "unpaid") return null;
    if (order.reservationState === "held") await release(tx, order.reservation, { wasCommitted: false, restock: false, orderId });
    await tx
      .update(schema.orders)
      .set({ status: "expired", reservationState: "released", cancelReason: reason, updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId));
    await tx.insert(schema.orderEvents).values({ orderId, kind: "status", fromStatus: "pending_payment", toStatus: "expired", message: reason, actorLabel: "Système" });
    if (opts.notify !== false) await enqueueCustomerEmail(tx, orderId, "payment_failed");
    return order;
  });
  if (done) {
    if (done.checkoutSessionId && stripeEnabled()) await expireCheckoutSession(done.checkoutSessionId);
    await flushOutboxSafely();
  }
  return !!done;
}

/* ------------------------------------------------------------------ */
/* Statuts                                                             */
/* ------------------------------------------------------------------ */

export { nextStatus, previousStatus };

export async function changeStatus(orderId: string, from: OrderStatus, to: OrderStatus, actor: Actor, role: "admin" | "kitchen") {
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order) return { ok: false as const, error: "Commande introuvable." };
  const forward = nextStatus(order) === to;
  const backward = previousStatus(order) === to;
  if (!forward && !backward) return { ok: false as const, error: "Ce changement de statut n’est pas possible." };
  if (order.status === "new" && role !== "admin") return { ok: false as const, error: "Seul le responsable peut accepter une commande." };

  const ok = await db.transaction(async (tx) => {
    const upd = await tx
      .update(schema.orders)
      .set({ status: to, updatedAt: new Date() })
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, from)))
      .returning({ id: schema.orders.id });
    if (!upd.length) return false;
    await tx.insert(schema.orderEvents).values({
      orderId,
      kind: "status",
      fromStatus: from,
      toStatus: to,
      message: backward ? `Retour à « ${STATUS[to].label} »` : STATUS[to].label,
      actorUserId: actor.id,
      actorLabel: actor.label,
    });
    if (forward && ["accepted", "preparing", "ready", "out_for_delivery", "completed"].includes(to)) {
      await enqueueCustomerEmail(tx, orderId, to as "accepted");
    }
    return true;
  });
  if (!ok) return { ok: false as const, error: "La commande a déjà été modifiée par quelqu’un d’autre. L’écran a été actualisé." };
  await audit(actor, "order.status", "order", orderId, { from, to });
  await flushOutboxSafely();
  return { ok: true as const };
}

/* ------------------------------------------------------------------ */
/* Annulation & remboursement                                          */
/* ------------------------------------------------------------------ */

export function customerCancelDeadline(order: Pick<Order, "slotStart">, cancelDeadlineHours: number) {
  return new Date(order.slotStart.getTime() - cancelDeadlineHours * 3600_000);
}

export async function canCustomerCancel(order: Order) {
  const s = await getSettings();
  if (!s.ordering.allowCustomerCancel) return false;
  if (!["new", "accepted"].includes(order.status)) return false;
  return new Date() < customerCancelDeadline(order, s.ordering.cancelDeadlineHours);
}

export async function refundOrder(orderId: string, amountCents: number, reason: string, actor: Actor, opts: { silent?: boolean } = {}) {
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  const payment = await db.query.payments.findFirst({ where: eq(schema.payments.orderId, orderId) });
  if (!order || !payment) return { ok: false as const, error: "Aucun paiement trouvé pour cette commande." };
  const refundable = payment.amountCents - payment.refundedCents;
  if (amountCents <= 0 || amountCents > refundable) return { ok: false as const, error: `Montant invalide (maximum remboursable : ${formatPrice(refundable)}).` };

  let reference: string | null = null;
  let status = "succeeded";
  if (payment.provider === "stripe") {
    if (!payment.reference) return { ok: false as const, error: "Référence de paiement Stripe manquante." };
    try {
      const r = await refundPayment(payment.reference, amountCents, `refund-${orderId}-${payment.refundedCents}-${amountCents}`);
      reference = r.id;
      status = r.status === "failed" ? "failed" : r.status === "succeeded" ? "succeeded" : "pending";
    } catch (e) {
      await logSystem("error", `Échec du remboursement de la commande n°${order.number}`, e);
      return { ok: false as const, error: "Le remboursement a été refusé par Stripe. Vérifiez votre tableau de bord Stripe." };
    }
  } else {
    reference = `demo-refund-${Date.now()}`;
  }
  if (status === "failed") return { ok: false as const, error: "Le remboursement a échoué." };

  await db.transaction(async (tx) => {
    const [pay] = await tx
      .update(schema.payments)
      .set({ refundedCents: sql`${schema.payments.refundedCents} + ${amountCents}` })
      .where(eq(schema.payments.id, payment.id))
      .returning();
    const full = pay.refundedCents >= pay.amountCents;
    await tx.update(schema.payments).set({ status: full ? "refunded" : "partially_refunded" }).where(eq(schema.payments.id, payment.id));
    await tx.update(schema.orders).set({ paymentStatus: full ? "refunded" : "partially_refunded", updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
    const [rf] = await tx.insert(schema.refunds).values({ orderId, amountCents, reference, reason, status, actorLabel: actor.label }).returning();
    await tx.insert(schema.orderEvents).values({ orderId, kind: "refund", message: `Remboursement de ${formatPrice(amountCents)}${reason ? ` – ${reason}` : ""}`, actorUserId: actor.id, actorLabel: actor.label });
    if (!opts.silent) await enqueueCustomerEmail(tx, orderId, "refunded", { refundCents: amountCents, reason }, `:${rf.id}`);
  });
  await audit(actor, "order.refund", "order", orderId, { amountCents, reason });
  await flushOutboxSafely();
  return { ok: true as const };
}

export async function cancelOrder(
  orderId: string,
  actor: Actor,
  opts: { reason: string; restock: boolean; refund: boolean; byCustomer?: boolean },
) {
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order) return { ok: false as const, error: "Commande introuvable." };
  if (["cancelled", "expired", "completed"].includes(order.status)) return { ok: false as const, error: "Cette commande ne peut plus être annulée." };
  if (order.status === "pending_payment") {
    await expireOrder(orderId, opts.reason || "Annulée avant paiement", { notify: false });
    return { ok: true as const };
  }

  // 1. Remboursement d'abord : si le prestataire refuse, on n'annule pas (pas d'état incohérent).
  let refunded = 0;
  if (opts.refund && (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded")) {
    const payment = await db.query.payments.findFirst({ where: eq(schema.payments.orderId, orderId) });
    const amount = payment ? payment.amountCents - payment.refundedCents : 0;
    if (amount > 0) {
      const r = await refundOrder(orderId, amount, opts.reason || "Annulation", actor, { silent: true });
      if (!r.ok) return r;
      refunded = amount;
    }
  }

  // 2. Annulation + libération des capacités
  const ok = await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId)).for("update");
    if (!cur || ["cancelled", "expired", "completed"].includes(cur.status)) return false;
    if (cur.reservationState !== "released") {
      await release(tx, cur.reservation, { wasCommitted: cur.reservationState === "committed", restock: opts.restock, orderId });
    }
    await tx
      .update(schema.orders)
      .set({ status: "cancelled", reservationState: "released", cancelledAt: new Date(), cancelReason: opts.reason || null, updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId));
    await tx.insert(schema.orderEvents).values({
      orderId,
      kind: "status",
      fromStatus: cur.status,
      toStatus: "cancelled",
      message: `Annulée${opts.byCustomer ? " par le client" : ""}${opts.reason ? ` – ${opts.reason}` : ""}${opts.restock ? " (quantités remises en stock)" : ""}`,
      actorUserId: actor.id,
      actorLabel: actor.label,
    });
    await enqueueCustomerEmail(tx, orderId, "cancelled", { reason: opts.reason, refundCents: refunded });
    if (opts.byCustomer)
      await enqueueAdminEmail(tx, `custcancel:${orderId}`, `Commande n°${cur.number} annulée par le client`, [`${cur.customerName} a annulé sa commande du ${cur.serviceDay}.`], { path: `/admin/commandes/${orderId}`, label: "Voir" }, orderId);
    return true;
  });
  if (!ok) return { ok: false as const, error: "Cette commande a déjà été clôturée." };
  await audit(actor, "order.cancel", "order", orderId, { reason: opts.reason, restock: opts.restock, refunded });
  await flushOutboxSafely();
  return { ok: true as const };
}

/* ------------------------------------------------------------------ */
/* Problèmes & commentaires                                            */
/* ------------------------------------------------------------------ */

export async function reportIssue(orderId: string, reason: string, message: string, actor: Actor) {
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order) return { ok: false as const, error: "Commande introuvable." };
  const settings = await getSettings();
  await db.transaction(async (tx) => {
    const [ev] = await tx
      .insert(schema.orderEvents)
      .values({ orderId, kind: "issue", message: `${reason}${message ? ` : ${message}` : ""}`, actorUserId: actor.id, actorLabel: actor.label })
      .returning();
    if (settings.notifications.notifyAdminIssues)
      await enqueueAdminEmail(
        tx,
        `issue:${ev.id}`,
        `⚠️ Problème signalé – commande n°${order.number}`,
        [`${actor.label} a signalé : ${reason}`, message ? `Détail : ${message}` : "", `Créneau : ${order.serviceDay}`].filter(Boolean),
        { path: `/admin/commandes/${orderId}`, label: "Voir la commande" },
        orderId,
      );
  });
  await enqueueAdminSms(db, `issue:${orderId}:${Date.now()}`, `${settings.business.name} : problème signalé sur la commande n°${order.number} – ${reason}${message ? ` : ${message}` : ""} (${actor.label})`, "adminIssues", orderId);
  await audit(actor, "order.issue", "order", orderId, { reason, message });
  await flushOutboxSafely();
  return { ok: true as const };
}

export async function resolveIssue(eventId: number, actor: Actor) {
  await db.update(schema.orderEvents).set({ resolvedAt: new Date() }).where(and(eq(schema.orderEvents.id, eventId), eq(schema.orderEvents.kind, "issue")));
  await audit(actor, "order.issue_resolved", "order_event", eventId);
}

export async function addComment(orderId: string, message: string, actor: Actor) {
  await db.insert(schema.orderEvents).values({ orderId, kind: "comment", message, actorUserId: actor.id, actorLabel: actor.label });
}
