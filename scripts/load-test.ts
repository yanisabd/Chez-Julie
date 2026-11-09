/**
 * Test de charge / commandes simultanées (cahier des charges §17.3).
 *
 * ⚠ EFFACE la base ciblée : utilisez une base de TEST dédiée.
 *   LOAD_TEST_DATABASE_URL=postgres://... npm run load-test
 *   (sans variable : base locale embarquée en mémoire — la concurrence y est sérialisée,
 *    le test est donc surtout probant sur un vrai PostgreSQL)
 */
import "dotenv/config";

if (process.env.LOAD_TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.LOAD_TEST_DATABASE_URL;
else {
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DIR = "memory";
}
process.env.DATABASE_POOL_MAX = "20";

async function main() {
  const { eq, sql } = await import("drizzle-orm");
  const { getDb, closeDb, schema } = await import("../src/db");
  const { runMigrations } = await import("../src/db/migrate");
  const { seed, truncateAll } = await import("../src/db/seed-data");
  const { createOrder, markOrderPaid } = await import("../src/server/orders");
  const { updateSettings, getSettings } = await import("../src/server/settings");
  const { getCustomerAvailability } = await import("../src/server/slots");

  const db = getDb();
  console.log(`Base : ${process.env.DATABASE_URL ? "PostgreSQL externe" : "embarquée (mémoire)"}`);
  await runMigrations();
  await truncateAll(db);
  await seed(db, { adminEmail: "load@test.fr", adminPassword: "LoadTest12345" });
  await updateSettings((s) => {
    s.schedule = Array.from({ length: 7 }, () => ({ open: true, ranges: [{ start: "00:00", end: "23:30", pickup: true, delivery: true }] }));
    s.ordering.minLeadHours = 1;
    s.ordering.defaultMaxOrdersPerSlot = 500;
    s.ordering.defaultMaxItemsPerSlot = 5000;
  });

  const thiakry = (await db.query.products.findFirst({ where: eq(schema.products.name, "Thiakry") }))!;
  const alloco = (await db.query.products.findFirst({ where: eq(schema.products.name, "Alloco") }))!;
  await db.update(schema.products).set({ stockQty: 10 }).where(eq(schema.products.id, thiakry.id));
  const days = await getCustomerAvailability(await getSettings(), "pickup", [{ productId: thiakry.id, qty: 1 }]);
  const slots = days.flatMap((d) => d.slots.filter((s) => s.state === "available"));
  const input = (i: number, productId: number, slot: string) => ({ items: [{ productId, qty: 1, optionIds: [] }], slot, mode: "pickup", name: `Client ${i}`, email: `c${i}@load.test`, phone: "0612345678", acceptTerms: true });

  let failures = 0;
  const check = (label: string, cond: boolean, detail = "") => {
    console.log(`${cond ? "✓" : "✗"} ${label}${detail ? ` (${detail})` : ""}`);
    if (!cond) failures++;
  };

  // 1. 60 clients simultanés pour 10 portions
  let t = Date.now();
  const r1 = await Promise.all(Array.from({ length: 60 }, (_, i) => createOrder(input(i, thiakry.id, slots[i % 5].key), null)));
  const ok1 = r1.filter((r) => r.ok).length;
  const p1 = (await db.query.products.findFirst({ where: eq(schema.products.id, thiakry.id) }))!;
  check("60 commandes simultanées pour 10 portions → 10 acceptées", ok1 === 10, `${ok1} acceptées en ${Date.now() - t} ms`);
  check("Stock jamais négatif", p1.stockQty! - p1.reservedQty >= 0, `stock ${p1.stockQty}, réservé ${p1.reservedQty}`);

  // 2. Paiements confirmés en double, en simultané (webhook + retour client + tâche planifiée)
  const pending = await db.select().from(schema.orders).where(eq(schema.orders.status, "pending_payment"));
  t = Date.now();
  await Promise.all(pending.flatMap((o) => Array.from({ length: 4 }, () => markOrderPaid({ orderId: o.id, provider: "demo", reference: `x-${o.id}`, sessionId: null, amountCents: o.totalCents }))));
  const pays = await db.select().from(schema.payments);
  const p2 = (await db.query.products.findFirst({ where: eq(schema.products.id, thiakry.id) }))!;
  check("Chaque paiement n’est compté qu’une fois", pays.length === pending.length, `${pays.length} paiements pour ${pending.length} commandes, ${Date.now() - t} ms`);
  check("Stock décrémenté exactement une fois", p2.stockQty === 0 && p2.reservedQty === 0, `stock ${p2.stockQty}, réservé ${p2.reservedQty}`);
  const mails = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM notifications WHERE type = 'order_confirmed' AND channel = 'email'`);
  check("Aucun email de confirmation en double", Number(mails.rows[0].n) === pending.length, `${mails.rows[0].n} emails`);

  // 3. Capacité d'un créneau sous forte concurrence
  await updateSettings((s) => (s.ordering.defaultMaxOrdersPerSlot = 7));
  const target = slots[10].key;
  const r3 = await Promise.all(Array.from({ length: 80 }, (_, i) => createOrder(input(1000 + i, alloco.id, target), null)));
  const slot = await db.query.slots.findFirst({ where: eq(schema.slots.startsAt, new Date(target)) });
  check("80 commandes simultanées sur un créneau de 7 → 7 acceptées", r3.filter((r) => r.ok).length === 7 && slot!.bookedOrders === 7, `créneau : ${slot!.bookedOrders} réservées`);

  // 4. Numéros de commande uniques
  const dup = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM (SELECT number FROM orders GROUP BY number HAVING count(*) > 1) d`);
  check("Aucun numéro de commande en double", Number(dup.rows[0].n) === 0);

  await closeDb();
  if (failures) {
    console.log(`\n✗ ${failures} vérification(s) en échec`);
    process.exit(1);
  }
  console.log("\n✓ Test de charge réussi");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
