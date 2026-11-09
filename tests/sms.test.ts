import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { runMigrations } from "@/db/migrate";
import { seed, truncateAll } from "@/db/seed-data";
import { createOrder, markOrderPaid, changeStatus, cancelOrder } from "@/server/orders";
import { processOutbox } from "@/server/notifications";
import { getCustomerAvailability } from "@/server/slots";
import { getSettings, updateSettings } from "@/server/settings";
import { toInternational, canReceiveSms, smsSenderName } from "@/lib/phone";
import { SYSTEM } from "@/server/log";

const db = getDb();

async function paidOrder(phone = "06 12 34 56 78") {
  const p = (await db.query.products.findFirst({ where: eq(schema.products.name, "Alloco") }))!;
  const days = await getCustomerAvailability(await getSettings(), "pickup", [{ productId: p.id, qty: 1 }]);
  const slot = days.flatMap((d) => d.slots).find((s) => s.state === "available")!.key;
  const r = await createOrder({ items: [{ productId: p.id, qty: 1, optionIds: [] }], slot, mode: "pickup", name: "Awa Diallo", email: "awa@test.fr", phone, acceptTerms: true }, null);
  if (!r.ok) throw new Error(r.error);
  const o = (await db.select().from(schema.orders).where(eq(schema.orders.phone, phone)))[0];
  await markOrderPaid({ orderId: o.id, provider: "demo", reference: null, sessionId: null, amountCents: o.totalCents });
  return o;
}

const smsOf = (orderId: string) => db.select().from(schema.notifications).where(and(eq(schema.notifications.orderId, orderId), eq(schema.notifications.channel, "sms")));

beforeAll(async () => {
  await runMigrations();
});

beforeEach(async () => {
  await truncateAll(db);
  await seed(db, { adminEmail: "admin@test.fr", adminPassword: "MotDePasse123" });
  await updateSettings((s) => {
    s.schedule = Array.from({ length: 7 }, () => ({ open: true, ranges: [{ start: "08:00", end: "23:00", pickup: true, delivery: true }] }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BREVO_API_KEY;
});

describe("Numéros de téléphone", () => {
  it("met les numéros au format international", () => {
    expect(toInternational("06 12 34 56 78")).toBe("33612345678");
    expect(toInternational("06.12.34.56.78")).toBe("33612345678");
    expect(toInternational("+33 6 12 34 56 78")).toBe("33612345678");
    expect(toInternational("0033612345678")).toBe("33612345678");
    expect(toInternational("+32 470 12 34 56")).toBe("32470123456");
    expect(toInternational("123")).toBeNull();
  });
  it("ne considère que les mobiles français pour les SMS", () => {
    expect(canReceiveSms("07 11 22 33 44")).toBe(true);
    expect(canReceiveSms("01 23 45 67 89")).toBe(false);
  });
  it("produit un nom d’expéditeur valide", () => {
    expect(smsSenderName("Chez Julie")).toBe("ChezJulie");
    expect(smsSenderName("Saveurs d’Afrique & Co")).toBe("SaveursdAfr");
  });
});

describe("SMS clients", () => {
  it("envoie un SMS de confirmation court, en plus de l’email", async () => {
    const o = await paidOrder();
    const sms = await smsOf(o.id);
    expect(sms).toHaveLength(1);
    expect(sms[0].type).toBe("order_confirmed");
    expect(sms[0].recipient).toBe("33612345678");
    expect(sms[0].text).toContain(`n°${o.number}`);
    expect(sms[0].text.length).toBeLessThanOrEqual(160);
    const emails = await db.select().from(schema.notifications).where(and(eq(schema.notifications.orderId, o.id), eq(schema.notifications.channel, "email")));
    expect(emails.map((e) => e.type)).toContain("order_confirmed");
  });

  it("envoie le SMS « prête » une seule fois malgré un retour arrière en cuisine", async () => {
    const o = await paidOrder();
    await changeStatus(o.id, "accepted", "preparing", SYSTEM, "kitchen");
    await changeStatus(o.id, "preparing", "ready", SYSTEM, "kitchen");
    await changeStatus(o.id, "ready", "preparing", SYSTEM, "kitchen");
    await changeStatus(o.id, "preparing", "ready", SYSTEM, "kitchen");
    const ready = (await smsOf(o.id)).filter((n) => n.type === "ready");
    expect(ready).toHaveLength(1);
    // Pas de SMS pour « en préparation » (email seulement)
    expect((await smsOf(o.id)).some((n) => n.type === "preparing")).toBe(false);
  });

  it("prévient par SMS en cas d’annulation avec le montant remboursé", async () => {
    const o = await paidOrder();
    await cancelOrder(o.id, SYSTEM, { reason: "Rupture", restock: true, refund: true });
    const c = (await smsOf(o.id)).find((n) => n.type === "cancelled");
    expect(c?.text).toMatch(/annulée.*Remboursement/);
  });

  it("n’envoie pas de SMS à un numéro fixe, ni quand les SMS sont désactivés", async () => {
    const fixe = await paidOrder("01 23 45 67 89");
    expect(await smsOf(fixe.id)).toHaveLength(0);
    await updateSettings((s) => (s.notifications.sms.enabled = false));
    const o = await paidOrder("07 00 00 00 01");
    expect(await smsOf(o.id)).toHaveLength(0);
  });

  it("alerte le gérant par SMS à chaque nouvelle commande", async () => {
    await updateSettings((s) => (s.notifications.sms.adminPhone = "06 99 88 77 66"));
    const o = await paidOrder();
    const admin = await db.select().from(schema.notifications).where(and(eq(schema.notifications.channel, "sms"), eq(schema.notifications.recipient, "33699887766")));
    expect(admin).toHaveLength(1);
    expect(admin[0].text).toContain(`nouvelle commande n°${o.number}`);
  });
});

describe("Envoi via Brevo", () => {
  it("appelle l’API Brevo avec le bon format et marque le SMS comme envoyé", async () => {
    process.env.BREVO_API_KEY = "test-key";
    const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
        return new Response(JSON.stringify({ messageId: 42 }), { status: 201 });
      }),
    );
    const o = await paidOrder();
    await processOutbox();
    const sms = calls.find((c) => c.url.includes("brevo"));
    expect(sms?.url).toBe("https://api.brevo.com/v3/transactionalSMS/sms");
    expect(sms?.headers["api-key"]).toBe("test-key");
    expect(sms?.body).toMatchObject({ recipient: "33612345678", type: "transactional", sender: "Mounoukid" });
    const row = (await smsOf(o.id))[0];
    expect(row.status).toBe("sent");
    expect(row.providerId).toBe("42");
  });

  it("réessaie plus tard si Brevo est indisponible", async () => {
    process.env.BREVO_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("indisponible", { status: 503 })));
    const o = await paidOrder();
    await processOutbox();
    const row = (await smsOf(o.id))[0];
    expect(row.status).toBe("pending");
    expect(row.attempts).toBe(1);
    expect(row.lastError).toContain("503");
  });
});
