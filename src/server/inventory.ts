import { sql, inArray, eq } from "drizzle-orm";
import { schema, type Tx } from "@/db";
import type { ReservationSnapshot } from "@/db/schema";

/** Erreur « métier » affichable telle quelle au client. */
export class AvailabilityError extends Error {
  constructor(
    message: string,
    public code: "slot_full" | "day_full" | "stock" | "daily_limit" | "ingredient" | "promo" | "unavailable" = "stock",
  ) {
    super(message);
  }
}

export type ReserveInput = {
  slotStart: Date;
  slotEnd: Date;
  day: string;
  defaultMaxOrders: number;
  defaultMaxItems: number;
  maxOrdersPerDay: number | null;
  maxItemsPerDay: number | null;
  lines: { productId: number; qty: number }[];
  promoId: number | null;
  /** Pour une re-réservation après expiration : on ignore la capacité du créneau déjà passé, etc. */
  ignoreCapacity?: boolean;
};

const rowsOf = (r: unknown) => (r as { rows: Record<string, unknown>[] }).rows;

/**
 * Réserve de manière ATOMIQUE tout ce qu'il faut pour une commande :
 * créneau, capacité journalière, stock des plats, limite journalière, ingrédients, code promo.
 * Chaque mise à jour est conditionnelle : si une seule échoue, la transaction entière est annulée.
 */
export async function reserve(tx: Tx, input: ReserveInput): Promise<ReservationSnapshot> {
  const items = input.lines.reduce((n, l) => n + l.qty, 0);

  // 1. Créneau
  await tx.execute(sql`
    INSERT INTO slots (starts_at, ends_at, day) VALUES (${input.slotStart.toISOString()}, ${input.slotEnd.toISOString()}, ${input.day})
    ON CONFLICT (starts_at) DO NOTHING`);
  const slotRes = rowsOf(
    await tx.execute(sql`
    UPDATE slots SET booked_orders = booked_orders + 1, booked_items = booked_items + ${items}
    WHERE starts_at = ${input.slotStart.toISOString()}
      AND (${input.ignoreCapacity ?? false}::boolean OR (
        blocked = false
        AND booked_orders + 1 <= COALESCE(max_orders, ${input.defaultMaxOrders}::int)
        AND booked_items + ${items} <= COALESCE(max_items, ${input.defaultMaxItems}::int)))
    RETURNING id`),
  );
  if (!slotRes.length) throw new AvailabilityError("Ce créneau vient d’être complété. Merci d’en choisir un autre.", "slot_full");
  const slotId = Number(slotRes[0].id);

  // 2. Capacité de la journée
  await tx.execute(sql`INSERT INTO day_usage (day) VALUES (${input.day}) ON CONFLICT (day) DO NOTHING`);
  const dayRes = rowsOf(
    await tx.execute(sql`
    UPDATE day_usage SET orders = orders + 1, items = items + ${items}
    WHERE day = ${input.day}
      AND (${input.ignoreCapacity ?? false}::boolean OR (
        (${input.maxOrdersPerDay}::int IS NULL OR orders + 1 <= ${input.maxOrdersPerDay}::int)
        AND (${input.maxItemsPerDay}::int IS NULL OR items + ${items} <= ${input.maxItemsPerDay}::int)))
    RETURNING day`),
  );
  if (!dayRes.length) throw new AvailabilityError("La cuisine est complète pour cette journée. Merci de choisir un autre jour.", "day_full");

  // 3. Plats : stock + limite journalière
  const qtyBy = new Map<number, number>();
  for (const l of input.lines) qtyBy.set(l.productId, (qtyBy.get(l.productId) ?? 0) + l.qty);
  const ids = [...qtyBy.keys()];
  const prods = ids.length ? await tx.select().from(schema.products).where(inArray(schema.products.id, ids)) : [];
  const snapProducts: ReservationSnapshot["products"] = [];

  for (const p of prods) {
    const q = qtyBy.get(p.id)!;
    const stockTracked = p.stockQty != null;
    if (stockTracked) {
      const r = rowsOf(
        await tx.execute(sql`
        UPDATE products SET reserved_qty = reserved_qty + ${q}
        WHERE id = ${p.id} AND stock_qty IS NOT NULL AND stock_qty - reserved_qty >= ${q}
        RETURNING id`),
      );
      if (!r.length) {
        const left = Math.max(0, (p.stockQty ?? 0) - p.reservedQty);
        throw new AvailabilityError(
          left > 0 ? `Il ne reste que ${left} « ${p.name} ». Merci d’ajuster votre panier.` : `« ${p.name} » est épuisé.`,
          "stock",
        );
      }
    }
    const daily = p.dailyLimit != null;
    if (daily) {
      await tx.execute(sql`INSERT INTO product_day_usage (product_id, day, qty) VALUES (${p.id}, ${input.day}, 0) ON CONFLICT DO NOTHING`);
      const r = rowsOf(
        await tx.execute(sql`
        UPDATE product_day_usage SET qty = qty + ${q}
        WHERE product_id = ${p.id} AND day = ${input.day}
          AND (${input.ignoreCapacity ?? false}::boolean OR qty + ${q} <= (SELECT daily_limit FROM products WHERE id = ${p.id}))
        RETURNING qty`),
      );
      if (!r.length) throw new AvailabilityError(`« ${p.name} » est complet pour ce jour-là. Choisissez un autre jour.`, "daily_limit");
    }
    snapProducts.push({ id: p.id, qty: q, stockTracked, daily });
  }
  if (prods.length !== ids.length) throw new AvailabilityError("Un plat de votre panier n’existe plus.", "unavailable");

  // 4. Ingrédients (recettes)
  const recipe = ids.length ? await tx.select().from(schema.recipeItems).where(inArray(schema.recipeItems.productId, ids)) : [];
  const needBy = new Map<number, number>();
  for (const r of recipe) needBy.set(r.ingredientId, (needBy.get(r.ingredientId) ?? 0) + r.quantity * qtyBy.get(r.productId)!);
  const snapIngredients: ReservationSnapshot["ingredients"] = [];
  for (const [ingId, need] of needBy) {
    const r = rowsOf(
      await tx.execute(sql`
      UPDATE ingredients SET reserved = reserved + ${need}
      WHERE id = ${ingId} AND stock - reserved >= ${need}
      RETURNING id`),
    );
    if (!r.length) {
      const users = recipe.filter((x) => x.ingredientId === ingId).map((x) => prods.find((p) => p.id === x.productId)?.name);
      throw new AvailabilityError(
        `Nous ne pouvons plus préparer autant de « ${users[0] ?? "ce plat"} » (ingrédient épuisé). Merci de réduire la quantité.`,
        "ingredient",
      );
    }
    snapIngredients.push({ id: ingId, qty: need });
  }

  // 5. Code promo (nombre d'utilisations)
  if (input.promoId) {
    const r = rowsOf(
      await tx.execute(sql`
      UPDATE promo_codes SET used_count = used_count + 1
      WHERE id = ${input.promoId} AND active = true AND (max_uses IS NULL OR used_count < max_uses)
      RETURNING id`),
    );
    if (!r.length) throw new AvailabilityError("Ce code promo n’est plus valable.", "promo");
  }

  return { slotId, day: input.day, items, products: snapProducts, ingredients: snapIngredients, promoId: input.promoId };
}

/** Paiement confirmé : la réservation devient une consommation définitive du stock. */
export async function commit(tx: Tx, snap: ReservationSnapshot, orderId: string) {
  const low: { kind: "product" | "ingredient"; id: number }[] = [];
  for (const p of snap.products) {
    if (!p.stockTracked) continue;
    const r = rowsOf(
      await tx.execute(sql`
      UPDATE products SET stock_qty = stock_qty - ${p.qty}, reserved_qty = GREATEST(reserved_qty - ${p.qty}, 0)
      WHERE id = ${p.id} AND stock_qty IS NOT NULL
      RETURNING stock_qty, alert_threshold`),
    );
    await tx.insert(schema.stockMovements).values({ productId: p.id, delta: -p.qty, reason: "sale", orderId });
    const row = r[0];
    if (row && row.alert_threshold != null && Number(row.stock_qty) <= Number(row.alert_threshold)) low.push({ kind: "product", id: p.id });
  }
  for (const i of snap.ingredients) {
    const r = rowsOf(
      await tx.execute(sql`
      UPDATE ingredients SET stock = stock - ${i.qty}, reserved = GREATEST(reserved - ${i.qty}, 0), updated_at = now()
      WHERE id = ${i.id}
      RETURNING stock, alert_threshold`),
    );
    await tx.insert(schema.stockMovements).values({ ingredientId: i.id, delta: -i.qty, reason: "sale", orderId });
    const row = r[0];
    if (row && row.alert_threshold != null && Number(row.stock) <= Number(row.alert_threshold)) low.push({ kind: "ingredient", id: i.id });
  }
  return low;
}

/**
 * Libère une réservation.
 * - wasCommitted = false : paiement jamais abouti -> on libère les quantités bloquées.
 * - wasCommitted = true  : commande payée puis annulée -> la capacité est libérée ;
 *   le stock n'est remis que si `restock` est vrai (plats non encore cuisinés).
 */
export async function release(tx: Tx, snap: ReservationSnapshot, opts: { wasCommitted: boolean; restock: boolean; orderId: string }) {
  await tx.execute(sql`
    UPDATE slots SET booked_orders = GREATEST(booked_orders - 1, 0), booked_items = GREATEST(booked_items - ${snap.items}, 0)
    WHERE id = ${snap.slotId}`);
  await tx.execute(sql`
    UPDATE day_usage SET orders = GREATEST(orders - 1, 0), items = GREATEST(items - ${snap.items}, 0) WHERE day = ${snap.day}`);
  for (const p of snap.products) {
    if (p.daily)
      await tx.execute(sql`
        UPDATE product_day_usage SET qty = GREATEST(qty - ${p.qty}, 0) WHERE product_id = ${p.id} AND day = ${snap.day}`);
    if (!p.stockTracked) continue;
    if (!opts.wasCommitted) {
      await tx.execute(sql`UPDATE products SET reserved_qty = GREATEST(reserved_qty - ${p.qty}, 0) WHERE id = ${p.id}`);
    } else if (opts.restock) {
      await tx.execute(sql`UPDATE products SET stock_qty = stock_qty + ${p.qty} WHERE id = ${p.id} AND stock_qty IS NOT NULL`);
      await tx.insert(schema.stockMovements).values({ productId: p.id, delta: p.qty, reason: "cancel", orderId: opts.orderId });
    }
  }
  for (const i of snap.ingredients) {
    if (!opts.wasCommitted) {
      await tx.execute(sql`UPDATE ingredients SET reserved = GREATEST(reserved - ${i.qty}, 0) WHERE id = ${i.id}`);
    } else if (opts.restock) {
      await tx.execute(sql`UPDATE ingredients SET stock = stock + ${i.qty}, updated_at = now() WHERE id = ${i.id}`);
      await tx.insert(schema.stockMovements).values({ ingredientId: i.id, delta: i.qty, reason: "cancel", orderId: opts.orderId });
    }
  }
  if (snap.promoId) await tx.execute(sql`UPDATE promo_codes SET used_count = GREATEST(used_count - 1, 0) WHERE id = ${snap.promoId}`);
}

/** Nombre de portions encore vendables d'un plat (stock, ingrédients). NULL = illimité. */
export async function sellableQuantities(tx: Tx | typeof import("@/db").db, productIds: number[]) {
  const out = new Map<number, number | null>();
  if (!productIds.length) return out;
  const prods = await tx.select().from(schema.products).where(inArray(schema.products.id, productIds));
  const recipe = await tx
    .select({ productId: schema.recipeItems.productId, quantity: schema.recipeItems.quantity, stock: schema.ingredients.stock, reserved: schema.ingredients.reserved })
    .from(schema.recipeItems)
    .innerJoin(schema.ingredients, eq(schema.ingredients.id, schema.recipeItems.ingredientId))
    .where(inArray(schema.recipeItems.productId, productIds));
  for (const p of prods) {
    let max: number | null = p.stockQty != null ? Math.max(0, p.stockQty - p.reservedQty) : null;
    for (const r of recipe.filter((x) => x.productId === p.id)) {
      if (r.quantity <= 0) continue;
      const possible = Math.max(0, Math.floor((r.stock - r.reserved) / r.quantity));
      max = max == null ? possible : Math.min(max, possible);
    }
    out.set(p.id, max);
  }
  return out;
}
