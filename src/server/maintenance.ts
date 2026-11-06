import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "./settings";
import { expireOrder, markOrderPaid } from "./orders";
import { processOutbox } from "./notifications";
import { retrieveCheckoutSession, stripeEnabled } from "./payments";
import { logSystem } from "./log";

/**
 * Libère les stocks des commandes dont le paiement n'a pas abouti dans le délai.
 * Avant d'abandonner, on vérifie auprès de Stripe que le paiement n'a pas réellement eu lieu
 * (cas d'un webhook perdu) : on privilégie toujours la fiabilité.
 */
export async function releaseExpiredOrders() {
  const expired = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.status, "pending_payment"), lt(schema.orders.holdExpiresAt, new Date())))
    .limit(50);
  for (const o of expired) {
    try {
      if (o.checkoutSessionId && stripeEnabled()) {
        const s = await retrieveCheckoutSession(o.checkoutSessionId);
        if (s.payment_status === "paid") {
          await markOrderPaid({
            orderId: o.id,
            provider: "stripe",
            reference: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null),
            sessionId: s.id,
            amountCents: s.amount_total ?? o.totalCents,
          });
          continue;
        }
      }
      await expireOrder(o.id, "Paiement non finalisé dans le délai imparti");
    } catch (e) {
      await logSystem("error", `Impossible de traiter l’expiration de la commande n°${o.number}`, e);
    }
  }
  return expired.length;
}

/** RGPD : anonymise les données personnelles des commandes anciennes (les montants restent pour la comptabilité). */
export async function anonymizeOldOrders() {
  const s = await getSettings();
  const limit = new Date();
  limit.setMonth(limit.getMonth() - s.privacy.retentionMonths);
  const res = await db
    .update(schema.orders)
    .set({
      customerName: "Client anonymisé",
      email: "anonymise@invalid.local",
      phone: "",
      addressLine: null,
      deliveryInstructions: null,
      kitchenNotes: null,
      anonymizedAt: new Date(),
    })
    .where(and(lt(schema.orders.createdAt, limit), isNull(schema.orders.anonymizedAt)))
    .returning({ id: schema.orders.id });
  if (res.length) {
    await db.update(schema.notifications).set({ html: "", text: "", recipient: "anonymise" }).where(lt(schema.notifications.createdAt, limit));
    await logSystem("info", `${res.length} commande(s) anonymisée(s) (durée de conservation : ${s.privacy.retentionMonths} mois)`);
  }
}

async function cleanup() {
  await db.delete(schema.rateLimits).where(lt(schema.rateLimits.resetAt, new Date()));
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  await db.delete(schema.passwordResets).where(lt(schema.passwordResets.expiresAt, new Date()));
  await db.execute(sql`DELETE FROM webhook_events WHERE received_at < now() - interval '60 days'`);
}

const g = globalThis as unknown as { __lastMaint?: number; __lastDaily?: number; __maintRunning?: Promise<void> };

/** Tâches courtes : expiration des paiements & envoi des emails. */
export async function runMaintenance(force = false) {
  const now = Date.now();
  if (!force && g.__lastMaint && now - g.__lastMaint < 30_000) return;
  if (g.__maintRunning) return g.__maintRunning;
  g.__lastMaint = now;
  g.__maintRunning = (async () => {
    try {
      await releaseExpiredOrders();
      await processOutbox();
      if (force || !g.__lastDaily || now - g.__lastDaily > 6 * 3600_000) {
        g.__lastDaily = now;
        await cleanup();
        await anonymizeOldOrders();
      }
    } catch (e) {
      await logSystem("error", "Erreur pendant la maintenance automatique", e);
    } finally {
      g.__maintRunning = undefined;
    }
  })();
  return g.__maintRunning;
}
