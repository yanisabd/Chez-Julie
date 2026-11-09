import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { runMigrations } from "@/db/migrate";
import { seed, truncateAll } from "@/db/seed-data";
import { createOrder, markOrderPaid, cancelOrder, changeStatus } from "@/server/orders";
import { releaseExpiredOrders } from "@/server/maintenance";
import { buildDay, getCustomerAvailability } from "@/server/slots";
import { getSettings, updateSettings } from "@/server/settings";
import { addDays, parisDateTime, parisDay } from "@/lib/time";
import { SYSTEM } from "@/server/log";

const db = getDb();

/** Produit à stock suivi de la carte (boisson) : 20 en stock, 4,00 € */
const STOCKED = "Bouye (jus de baobab) 50 cl";

/** Premier choix de chaque groupe d'options obligatoire. */
async function requiredOptions(pid: number) {
  const groups = await db.select().from(schema.optionGroups).where(eq(schema.optionGroups.productId, pid));
  const ids: number[] = [];
  for (const g of groups.filter((x) => x.required)) ids.push((await db.select().from(schema.options).where(eq(schema.options.groupId, g.id)))[0].id);
  return ids;
}

async function productId(name: string) {
  const p = await db.query.products.findFirst({ where: eq(schema.products.name, name) });
  return p!.id;
}

/** Premier créneau disponible (retrait) pour un panier. */
async function firstSlot(productIdValue: number, qty = 1, skip = 0) {
  const s = await getSettings();
  const days = await getCustomerAvailability(s, "pickup", [{ productId: productIdValue, qty }]);
  const slots = days.flatMap((d) => d.slots.filter((x) => x.state === "available"));
  return slots[skip].key;
}

function input(over: Record<string, unknown>) {
  return { mode: "pickup", name: "Test Client", email: "client@test.fr", phone: "0612345678", acceptTerms: true, ...over };
}

beforeAll(async () => {
  await runMigrations();
});

beforeEach(async () => {
  await truncateAll(db);
  await seed(db, { adminEmail: "admin@test.fr", adminPassword: "MotDePasse123" });
  // Tous les jours ouverts toute la journée pour des tests indépendants de l'heure courante
  await updateSettings((s) => {
    s.schedule = Array.from({ length: 7 }, () => ({ open: true, ranges: [{ start: "08:00", end: "23:00", pickup: true, delivery: true }] }));
    s.ordering.defaultMaxOrdersPerSlot = 50;
    s.ordering.defaultMaxItemsPerSlot = 500;
  });
});

describe("Parcours de commande", () => {
  it("crée, paie (une seule fois) et décrémente le stock", async () => {
    const pid = await productId(STOCKED);
    const slot = await firstSlot(pid);
    const r = await createOrder(input({ items: [{ productId: pid, qty: 2, optionIds: [] }], slot }), null);
    expect(r.ok).toBe(true);
    const order = (await db.select().from(schema.orders))[0];
    expect(order.status).toBe("pending_payment");
    expect(order.totalCents).toBe(800);

    let p = await db.query.products.findFirst({ where: eq(schema.products.id, pid) });
    expect(p!.reservedQty).toBe(2);
    expect(p!.stockQty).toBe(20);

    await markOrderPaid({ orderId: order.id, provider: "demo", reference: "x", sessionId: null, amountCents: order.totalCents });
    await markOrderPaid({ orderId: order.id, provider: "demo", reference: "x", sessionId: null, amountCents: order.totalCents }); // webhook répété

    p = await db.query.products.findFirst({ where: eq(schema.products.id, pid) });
    expect(p!.reservedQty).toBe(0);
    expect(p!.stockQty).toBe(18);
    const o2 = await db.query.orders.findFirst({ where: eq(schema.orders.id, order.id) });
    expect(o2!.status).toBe("accepted");
    expect(o2!.paymentStatus).toBe("paid");
    const mails = await db.select().from(schema.notifications).where(and(eq(schema.notifications.type, "order_confirmed"), eq(schema.notifications.channel, "email")));
    expect(mails).toHaveLength(1);
    expect((await db.select().from(schema.payments)).length).toBe(1);
  });

  it("refuse un prix falsifié : le prix vient toujours de la base", async () => {
    const pid = await productId("Alloco");
    const slot = await firstSlot(pid);
    const r = await createOrder(input({ items: [{ productId: pid, qty: 1, optionIds: [], priceCents: 1 }], slot }), null);
    expect(r.ok).toBe(true);
    const order = (await db.select().from(schema.orders))[0];
    expect(order.subtotalCents).toBe(450);
  });

  it("exige les options obligatoires", async () => {
    const pid = await productId("Poulet braisé aux poivrons");
    const slot = await firstSlot(pid);
    const r = await createOrder(input({ items: [{ productId: pid, qty: 1, optionIds: [] }], slot }), null);
    expect(r.ok).toBe(false);
  });
});

describe("Stocks et commandes simultanées", () => {
  it("20 clients simultanés pour 3 dernières portions : exactement 3 commandes acceptées", async () => {
    const pid = await productId(STOCKED);
    await db.update(schema.products).set({ stockQty: 3 }).where(eq(schema.products.id, pid));
    const slot = await firstSlot(pid);
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => createOrder(input({ email: `c${i}@test.fr`, items: [{ productId: pid, qty: 1, optionIds: [] }], slot }), null)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    const p = await db.query.products.findFirst({ where: eq(schema.products.id, pid) });
    expect(p!.stockQty! - p!.reservedQty).toBe(0);
  });

  it("un créneau complet ferme automatiquement", async () => {
    await updateSettings((s) => (s.ordering.defaultMaxOrdersPerSlot = 2));
    const pid = await productId("Alloco");
    const slot = await firstSlot(pid);
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => createOrder(input({ email: `c${i}@test.fr`, items: [{ productId: pid, qty: 1, optionIds: [] }], slot }), null)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    const s = await getSettings();
    const day = parisDay(new Date(slot));
    const view = await buildDay(s, day, { mode: "pickup" });
    expect(view.slots.find((x) => x.key === slot)!.state).toBe("full");
  });

  it("la capacité en plats par créneau est respectée", async () => {
    await updateSettings((s) => (s.ordering.defaultMaxItemsPerSlot = 5));
    const pid = await productId("Alloco");
    const slot = await firstSlot(pid);
    const a = await createOrder(input({ items: [{ productId: pid, qty: 4, optionIds: [] }], slot }), null);
    const b = await createOrder(input({ items: [{ productId: pid, qty: 2, optionIds: [] }], slot }), null);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(false);
  });

  it("les ingrédients limitent les portions vendables", async () => {
    // Poisson braisé entier : 450 g de poisson par portion. 900 g => 2 portions max.
    await db.update(schema.ingredients).set({ stock: 900 }).where(eq(schema.ingredients.name, "Poisson"));
    const pid = await productId("Poisson braisé entier");
    const optIds = await requiredOptions(pid);
    const slot = await firstSlot(pid);
    const ok = await createOrder(input({ items: [{ productId: pid, qty: 2, optionIds: optIds }], slot }), null);
    const ko = await createOrder(input({ items: [{ productId: pid, qty: 1, optionIds: optIds }], slot }), null);
    expect(ok.ok).toBe(true);
    expect(ko.ok).toBe(false);
  });

  it("la limite de production journalière est respectée", async () => {
    const pid = await productId("Alloco");
    await db.update(schema.products).set({ dailyLimit: 3 }).where(eq(schema.products.id, pid));
    const slotA = await firstSlot(pid, 1, 0);
    const slotB = await firstSlot(pid, 1, 1);
    expect(parisDay(new Date(slotA))).toBe(parisDay(new Date(slotB)));
    expect((await createOrder(input({ items: [{ productId: pid, qty: 2, optionIds: [] }], slot: slotA }), null)).ok).toBe(true);
    expect((await createOrder(input({ items: [{ productId: pid, qty: 2, optionIds: [] }], slot: slotB }), null)).ok).toBe(false);
    expect((await createOrder(input({ items: [{ productId: pid, qty: 1, optionIds: [] }], slot: slotB }), null)).ok).toBe(true);
  });
});

describe("Délais et expiration", () => {
  it("un créneau à moins de 6 h n’est pas proposé", async () => {
    const s = await getSettings();
    const day = addDays(parisDay(), 1);
    const now = parisDateTime(day, "14:00");
    const view = await buildDay(s, day, { now, mode: "pickup" });
    expect(view.slots.find((x) => x.label.startsWith("18h00"))!.state).toBe("too_soon");
    expect(view.slots.find((x) => x.label.startsWith("20h00"))!.state).toBe("available");
  });

  it("une réservation non payée est libérée automatiquement", async () => {
    const pid = await productId(STOCKED);
    const slot = await firstSlot(pid);
    await createOrder(input({ items: [{ productId: pid, qty: 3, optionIds: [] }], slot }), null);
    await db.update(schema.orders).set({ holdExpiresAt: new Date(Date.now() - 1000) });
    await releaseExpiredOrders();
    const o = (await db.select().from(schema.orders))[0];
    expect(o.status).toBe("expired");
    const p = await db.query.products.findFirst({ where: eq(schema.products.id, pid) });
    expect(p!.reservedQty).toBe(0);
    const sl = (await db.select().from(schema.slots))[0];
    expect(sl.bookedOrders).toBe(0);
    expect(sl.bookedItems).toBe(0);
  });

  it("un paiement arrivé après expiration re-réserve si possible", async () => {
    const pid = await productId(STOCKED);
    const slot = await firstSlot(pid);
    await createOrder(input({ items: [{ productId: pid, qty: 1, optionIds: [] }], slot }), null);
    await db.update(schema.orders).set({ holdExpiresAt: new Date(Date.now() - 1000) });
    await releaseExpiredOrders();
    const o = (await db.select().from(schema.orders))[0];
    await markOrderPaid({ orderId: o.id, provider: "demo", reference: null, sessionId: null, amountCents: o.totalCents });
    const o2 = await db.query.orders.findFirst({ where: eq(schema.orders.id, o.id) });
    expect(o2!.status).toBe("accepted");
    const p = await db.query.products.findFirst({ where: eq(schema.products.id, pid) });
    expect(p!.stockQty).toBe(19);
  });
});

describe("Annulation et statuts", () => {
  it("l’annulation rembourse, libère le créneau et remet en stock", async () => {
    const pid = await productId(STOCKED);
    const slot = await firstSlot(pid);
    await createOrder(input({ items: [{ productId: pid, qty: 2, optionIds: [] }], slot }), null);
    const o = (await db.select().from(schema.orders))[0];
    await markOrderPaid({ orderId: o.id, provider: "demo", reference: null, sessionId: null, amountCents: o.totalCents });
    const r = await cancelOrder(o.id, SYSTEM, { reason: "Test", restock: true, refund: true });
    expect(r.ok).toBe(true);
    const o2 = await db.query.orders.findFirst({ where: eq(schema.orders.id, o.id) });
    expect(o2!.status).toBe("cancelled");
    expect(o2!.paymentStatus).toBe("refunded");
    const p = await db.query.products.findFirst({ where: eq(schema.products.id, pid) });
    expect(p!.stockQty).toBe(20);
    const sl = (await db.select().from(schema.slots))[0];
    expect(sl.bookedOrders).toBe(0);
    // Une 2e annulation est refusée (pas de double libération)
    expect((await cancelOrder(o.id, SYSTEM, { reason: "x", restock: true, refund: true })).ok).toBe(false);
  });

  it("enchaîne les statuts et refuse les sauts d’étape", async () => {
    const pid = await productId("Alloco");
    const slot = await firstSlot(pid);
    await createOrder(input({ items: [{ productId: pid, qty: 1, optionIds: [] }], slot }), null);
    const o = (await db.select().from(schema.orders))[0];
    await markOrderPaid({ orderId: o.id, provider: "demo", reference: null, sessionId: null, amountCents: o.totalCents });
    expect((await changeStatus(o.id, "accepted", "ready", SYSTEM, "kitchen")).ok).toBe(false);
    expect((await changeStatus(o.id, "accepted", "preparing", SYSTEM, "kitchen")).ok).toBe(true);
    expect((await changeStatus(o.id, "accepted", "preparing", SYSTEM, "kitchen")).ok).toBe(false); // double clic
    expect((await changeStatus(o.id, "preparing", "ready", SYSTEM, "kitchen")).ok).toBe(true);
    expect((await changeStatus(o.id, "ready", "preparing", SYSTEM, "kitchen")).ok).toBe(true); // retour arrière
    expect((await changeStatus(o.id, "preparing", "ready", SYSTEM, "kitchen")).ok).toBe(true);
    expect((await changeStatus(o.id, "ready", "completed", SYSTEM, "kitchen")).ok).toBe(true);
    // L'email « prête » n'est envoyé qu'une fois malgré le retour arrière
    const ready = await db.select().from(schema.notifications).where(and(eq(schema.notifications.type, "ready"), eq(schema.notifications.channel, "email")));
    expect(ready).toHaveLength(1);
    const count = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM order_events WHERE order_id = ${o.id}`);
    expect(Number(count.rows[0].n)).toBeGreaterThan(5);
  });
});
