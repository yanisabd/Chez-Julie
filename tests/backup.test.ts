import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { runMigrations } from "@/db/migrate";
import { seed, truncateAll } from "@/db/seed-data";
import { exportAll, restoreAll } from "@/server/backup";
import { createOrder, markOrderPaid } from "@/server/orders";
import { getCustomerAvailability } from "@/server/slots";
import { getSettings, updateSettings } from "@/server/settings";
import { getKitchenOrders } from "@/server/kitchen";
import { parisDay } from "@/lib/time";

const db = getDb();

beforeAll(async () => {
  await runMigrations();
  await truncateAll(db);
  await seed(db, { adminEmail: "admin@test.fr", adminPassword: "MotDePasse123" });
  await updateSettings((s) => {
    s.schedule = Array.from({ length: 7 }, () => ({ open: true, ranges: [{ start: "08:00", end: "23:00", pickup: true, delivery: true }] }));
  });
  await db.insert(schema.images).values({ data: new Uint8Array([1, 2, 3, 250]), mime: "image/webp" });
});

describe("Sauvegarde / restauration", () => {
  it("restaure exactement les données, y compris les commandes et les images", async () => {
    const p = await db.query.products.findFirst({ where: eq(schema.products.name, "Alloco") });
    const days = await getCustomerAvailability(await getSettings(), "pickup", [{ productId: p!.id, qty: 1 }]);
    const slot = days.flatMap((d) => d.slots).find((s) => s.state === "available")!.key;
    const r = await createOrder({ items: [{ productId: p!.id, qty: 2, optionIds: [] }], slot, mode: "pickup", name: "Awa Diallo", email: "a@test.fr", phone: "0612345678", acceptTerms: true }, null);
    expect(r.ok).toBe(true);
    const o = (await db.select().from(schema.orders))[0];
    await markOrderPaid({ orderId: o.id, provider: "demo", reference: null, sessionId: null, amountCents: o.totalCents });

    const backup = JSON.parse(JSON.stringify(await exportAll(db)));
    await truncateAll(db);
    expect(await db.select().from(schema.orders)).toHaveLength(0);

    await restoreAll(db, backup);
    const restored = await db.select().from(schema.orders);
    expect(restored).toHaveLength(1);
    expect(restored[0].number).toBe(o.number);
    expect(restored[0].reservation.products[0].qty).toBe(2);
    const img = (await db.select().from(schema.images))[0];
    expect([...img.data]).toEqual([1, 2, 3, 250]);
    // Les séquences reprennent après les données restaurées
    const [cat] = await db.insert(schema.categories).values({ name: "Nouvelle" }).returning();
    expect(cat.id).toBeGreaterThan(6);
    const nextOrder = await createOrder({ items: [{ productId: p!.id, qty: 1, optionIds: [] }], slot, mode: "pickup", name: "Bintou", email: "b@test.fr", phone: "0612345678", acceptTerms: true }, null);
    expect(nextOrder).toMatchObject({ ok: true });
    const nums = (await db.select().from(schema.orders)).map((x) => x.number).sort();
    expect(nums[1]).toBe(o.number + 1);
  });
});

describe("Confidentialité côté cuisine", () => {
  it("la cuisine ne reçoit ni email, ni téléphone, ni adresse", async () => {
    const day = (await db.select().from(schema.orders))[0].serviceDay;
    const { orders } = await getKitchenOrders(day ?? parisDay(), 45);
    expect(orders.length).toBeGreaterThan(0);
    const json = JSON.stringify(orders);
    expect(json).not.toContain("a@test.fr");
    expect(json).not.toContain("0612345678");
    expect(json).toContain("Awa D.");
  });
});
