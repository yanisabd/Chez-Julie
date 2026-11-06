import { and, asc, eq, lte, sql, inArray } from "drizzle-orm";
import { db, schema, type DBorTx } from "@/db";
import { getSettings } from "./settings";
import { renderAdminEmail, renderCustomerEmail, appUrl, type CustomerEmailType, type EmailOrder } from "./email-templates";
import { logSystem } from "./log";

const MAX_ATTEMPTS = 6;
const BACKOFF_MIN = [1, 5, 15, 60, 180, 360];

export const emailsEnabled = () => !!process.env.RESEND_API_KEY;

type Enqueue = {
  orderId?: string | null;
  type: string;
  recipient: string;
  subject: string;
  html: string;
  text: string;
  dedupeKey: string;
};

/** Ajoute un email à la file. La clé de déduplication empêche tout doublon, même si l'évènement se répète. */
export async function enqueue(tx: DBorTx, n: Enqueue) {
  await tx
    .insert(schema.notifications)
    .values({ ...n, orderId: n.orderId ?? null })
    .onConflictDoNothing({ target: schema.notifications.dedupeKey });
}

export async function loadEmailOrder(tx: DBorTx, orderId: string) {
  const order = await tx.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order) return null;
  const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  return { order, emailOrder: { ...order, items } as EmailOrder };
}

const TOGGLEABLE = ["accepted", "preparing", "ready", "out_for_delivery", "completed"] as const;

export async function enqueueCustomerEmail(
  tx: DBorTx,
  orderId: string,
  type: CustomerEmailType,
  extra: Parameters<typeof renderCustomerEmail>[3] = {},
  dedupeSuffix = "",
) {
  const settings = await getSettings(tx);
  if ((TOGGLEABLE as readonly string[]).includes(type) && !settings.notifications.customer[type as (typeof TOGGLEABLE)[number]]) return;
  const loaded = await loadEmailOrder(tx, orderId);
  if (!loaded || loaded.order.anonymizedAt) return;
  const mail = renderCustomerEmail(type, loaded.emailOrder, settings, extra);
  await enqueue(tx, {
    orderId,
    type,
    recipient: loaded.order.email,
    ...mail,
    dedupeKey: `${orderId}:${type}${dedupeSuffix}`,
  });
}

export async function enqueueAdminEmail(
  tx: DBorTx,
  dedupeKey: string,
  subject: string,
  lines: string[],
  linkPath?: { path: string; label: string },
  orderId?: string,
) {
  const settings = await getSettings(tx);
  const to = settings.notifications.adminEmail || settings.business.email;
  if (!to) return;
  const mail = renderAdminEmail(settings, subject, lines, linkPath ? { href: appUrl() + linkPath.path, label: linkPath.label } : undefined);
  await enqueue(tx, { orderId: orderId ?? null, type: "admin", recipient: to, ...mail, dedupeKey: `admin:${dedupeKey}` });
}

async function deliver(n: typeof schema.notifications.$inferSelect): Promise<{ ok: true; id: string | null; simulated?: boolean } | { ok: false; error: string; permanent?: boolean }> {
  if (!emailsEnabled()) return { ok: true, id: null, simulated: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `notif-${n.id}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
        to: [n.recipient],
        subject: n.subject,
        html: n.html,
        text: n.text,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const j = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, id: j.id ?? null };
    }
    const body = await res.text();
    // 4xx (hors 429) : erreur définitive (adresse invalide, domaine non vérifié...)
    return { ok: false, error: `HTTP ${res.status} ${body.slice(0, 300)}`, permanent: res.status >= 400 && res.status < 500 && res.status !== 429 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Envoie les emails en attente. Appelé juste après chaque évènement et par la tâche planifiée (réessais). */
export async function processOutbox(limit = 20) {
  // Emails bloqués « en cours d'envoi » depuis plus de 10 minutes : on les remet en file.
  await db.execute(sql`UPDATE notifications SET status = 'pending' WHERE status = 'sending' AND next_attempt_at < now() - interval '10 minutes'`);

  const due = await db
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.status, "pending"), lte(schema.notifications.nextAttemptAt, new Date())))
    .orderBy(asc(schema.notifications.id))
    .limit(limit);

  let sent = 0;
  for (const { id } of due) {
    // Verrouillage : un seul processus peut envoyer un email donné.
    const claimed = await db
      .update(schema.notifications)
      .set({ status: "sending", nextAttemptAt: new Date() })
      .where(and(eq(schema.notifications.id, id), eq(schema.notifications.status, "pending")))
      .returning();
    const n = claimed[0];
    if (!n) continue;
    const r = await deliver(n);
    const attempts = n.attempts + 1;
    if (r.ok) {
      sent++;
      await db
        .update(schema.notifications)
        .set({ status: r.simulated ? "simulated" : "sent", attempts, sentAt: new Date(), providerId: r.id, lastError: null })
        .where(eq(schema.notifications.id, id));
    } else {
      const failed = r.permanent || attempts >= MAX_ATTEMPTS;
      await db
        .update(schema.notifications)
        .set({
          status: failed ? "failed" : "pending",
          attempts,
          lastError: r.error,
          nextAttemptAt: new Date(Date.now() + BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] * 60000),
        })
        .where(eq(schema.notifications.id, id));
      if (failed) await logSystem("error", `Échec définitif d’envoi d’email à ${n.recipient} (${n.subject})`, { error: r.error, notificationId: id });
    }
  }
  return sent;
}

/** Relance manuelle depuis l'administration. */
export async function retryNotifications(ids: number[]) {
  if (!ids.length) return;
  await db
    .update(schema.notifications)
    .set({ status: "pending", nextAttemptAt: new Date(), attempts: 0 })
    .where(and(inArray(schema.notifications.id, ids), eq(schema.notifications.status, "failed")));
  await processOutbox();
}

/** Envoi immédiat sans bloquer la réponse en cas d'erreur. */
export async function flushOutboxSafely() {
  try {
    await processOutbox();
  } catch (e) {
    await logSystem("error", "Erreur lors de l’envoi des emails", e);
  }
}
