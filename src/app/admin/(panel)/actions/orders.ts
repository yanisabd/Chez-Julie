"use server";

import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { guarded, form, UserError } from "@/server/action";
import { changeStatus, cancelOrder, refundOrder, addComment, resolveIssue } from "@/server/orders";
import { audit } from "@/server/log";
import { parsePriceToCents, formatPrice } from "@/lib/format";
import type { OrderStatus } from "@/lib/constants";

export async function resolveIssueAction(eventId: number) {
  return guarded(["admin"], async ({ actor }) => {
    await resolveIssue(eventId, actor);
  });
}

export async function adminSetStatus(orderId: string, from: OrderStatus, to: OrderStatus) {
  return guarded(["admin"], async ({ actor }) => {
    const r = await changeStatus(orderId, from, to, actor, "admin");
    return r.ok ? { ok: true } : r;
  });
}

export async function adminCancel(orderId: string, fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const reason = form.str(fd, "reason");
    if (reason.length < 3) throw new UserError("Indiquez le motif de l’annulation (il sera envoyé au client).");
    const r = await cancelOrder(orderId, actor, { reason, restock: form.bool(fd, "restock"), refund: form.bool(fd, "refund") });
    return r.ok ? { ok: true, message: "Commande annulée. Le client a été prévenu par email." } : r;
  });
}

export async function adminRefund(orderId: string, fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const amount = parsePriceToCents(form.str(fd, "amount"));
    if (!amount) throw new UserError("Montant invalide.");
    const r = await refundOrder(orderId, amount, form.str(fd, "reason"), actor);
    return r.ok ? { ok: true, message: `Remboursement de ${formatPrice(amount)} effectué.` } : r;
  });
}

export async function adminComment(orderId: string, fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const msg = form.str(fd, "message");
    if (!msg) throw new UserError("Le commentaire est vide.");
    await addComment(orderId, msg.slice(0, 1000), actor);
    return { ok: true, message: "Commentaire ajouté" };
  });
}

const EDITABLE = {
  customerName: "Nom",
  phone: "Téléphone",
  email: "Email",
  addressLine: "Adresse",
  postalCode: "Code postal",
  city: "Ville",
  deliveryInstructions: "Instructions de livraison",
  kitchenNotes: "Note pour la cuisine",
} as const;

export async function adminEditOrder(orderId: string, fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
    if (!order) throw new UserError("Commande introuvable.");
    const patch: Partial<Record<keyof typeof EDITABLE, string | null>> = {};
    const changes: string[] = [];
    for (const k of Object.keys(EDITABLE) as (keyof typeof EDITABLE)[]) {
      if (!fd.has(k)) continue;
      const v = form.str(fd, k).slice(0, 300) || null;
      if ((order[k] ?? null) !== v) {
        patch[k] = v;
        changes.push(`${EDITABLE[k]} : « ${order[k] ?? ""} » → « ${v ?? ""} »`);
      }
    }
    if (patch.customerName === null || patch.email === null || patch.phone === null) throw new UserError("Le nom, l’email et le téléphone sont obligatoires.");
    if (!changes.length) return { ok: true, message: "Aucune modification" };
    await db.update(schema.orders).set({ ...(patch as Record<string, string>), updatedAt: new Date() }).where(eq(schema.orders.id, orderId));
    await db.insert(schema.orderEvents).values({ orderId, kind: "edit", message: changes.join("\n"), actorUserId: actor.id, actorLabel: actor.label });
    await audit(actor, "order.edit", "order", orderId, { changes });
    return { ok: true, message: "Modifications enregistrées" };
  });
}
