import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { stripe, stripeEnabled } from "@/server/payments";
import { markOrderPaid, expireOrder } from "@/server/orders";
import { logSystem } from "@/server/log";

export const runtime = "nodejs";

/**
 * Webhook Stripe : seule source de vérité pour les paiements.
 * - signature vérifiée (impossible de simuler un paiement)
 * - chaque évènement n'est traité qu'une fois (table webhook_events)
 */
export async function POST(req: Request) {
  if (!stripeEnabled() || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Stripe non configuré" }, { status: 400 });
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig ?? "", process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    await logSystem("warn", "Webhook Stripe avec signature invalide rejeté", e);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  const already = await db.query.webhookEvents.findFirst({ where: eq(schema.webhookEvents.id, event.id) });
  if (already) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = s.metadata?.orderId ?? s.client_reference_id;
        if (orderId && s.payment_status === "paid") {
          await markOrderPaid({
            orderId,
            provider: "stripe",
            reference: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null),
            sessionId: s.id,
            amountCents: s.amount_total ?? 0,
          });
        }
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = s.metadata?.orderId ?? s.client_reference_id;
        if (orderId) await expireOrder(orderId, event.type === "checkout.session.expired" ? "Session de paiement expirée" : "Paiement refusé");
        break;
      }
      case "charge.refunded": {
        const c = event.data.object as Stripe.Charge;
        const pi = typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id;
        if (pi) {
          const pay = await db.query.payments.findFirst({ where: eq(schema.payments.reference, pi) });
          // Remboursement fait directement depuis le tableau de bord Stripe : on synchronise.
          if (pay && c.amount_refunded > pay.refundedCents) {
            const full = c.amount_refunded >= pay.amountCents;
            await db.update(schema.payments).set({ refundedCents: c.amount_refunded, status: full ? "refunded" : "partially_refunded" }).where(eq(schema.payments.id, pay.id));
            await db.update(schema.orders).set({ paymentStatus: full ? "refunded" : "partially_refunded", updatedAt: new Date() }).where(eq(schema.orders.id, pay.orderId));
            await db.insert(schema.orderEvents).values({ orderId: pay.orderId, kind: "refund", message: `Remboursement synchronisé depuis Stripe (total remboursé : ${(c.amount_refunded / 100).toFixed(2)} €)`, actorLabel: "Stripe" });
          }
        }
        break;
      }
      default:
        break;
    }
    await db.insert(schema.webhookEvents).values({ id: event.id, type: event.type }).onConflictDoNothing();
    return NextResponse.json({ received: true });
  } catch (e) {
    await logSystem("error", `Erreur de traitement du webhook Stripe ${event.type}`, e);
    // 500 => Stripe renverra l'évènement automatiquement plus tard
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
