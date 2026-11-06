import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { OrderItemOption } from "@/db/schema";
import { sellableQuantities } from "./inventory";
import { normalizeCity, normalizePostalCode, formatPrice } from "@/lib/format";

export type CartInputLine = { productId: number; qty: number; optionIds: number[] };

export type PricedLine = {
  productId: number;
  name: string;
  qty: number;
  optionIds: number[];
  unitPriceCents: number;
  options: OrderItemOption[];
  lineTotalCents: number;
  issue: string | null;
  /** Quantité maximale commandable pour ce plat (null = pas de limite connue) */
  maxQty: number | null;
};

export async function priceCart(lines: CartInputLine[]) {
  const ids = [...new Set(lines.map((l) => l.productId))];
  const prods = ids.length
    ? await db.select().from(schema.products).where(and(inArray(schema.products.id, ids), isNull(schema.products.deletedAt)))
    : [];
  const groups = ids.length ? await db.select().from(schema.optionGroups).where(inArray(schema.optionGroups.productId, ids)) : [];
  const opts = groups.length
    ? await db.select().from(schema.options).where(inArray(schema.options.groupId, groups.map((g) => g.id)))
    : [];
  const sellable = await sellableQuantities(db, ids);
  const cats = await db.select().from(schema.categories);

  const totalQtyBy = new Map<number, number>();
  for (const l of lines) totalQtyBy.set(l.productId, (totalQtyBy.get(l.productId) ?? 0) + l.qty);

  const priced: PricedLine[] = lines.map((l) => {
    const p = prods.find((x) => x.id === l.productId);
    if (!p) return { ...l, name: "Plat retiré de la carte", unitPriceCents: 0, options: [], lineTotalCents: 0, issue: "Ce plat n’est plus proposé.", maxQty: 0 };
    const cat = cats.find((c) => c.id === p.categoryId);
    let issue: string | null = null;
    if (!p.active || (cat && !cat.active)) issue = "Ce plat n’est plus disponible pour le moment.";

    // Options
    const pGroups = groups.filter((g) => g.productId === p.id);
    const chosen: OrderItemOption[] = [];
    let unit = p.priceCents;
    for (const g of pGroups) {
      const sel = opts.filter((o) => o.groupId === g.id && l.optionIds.includes(o.id));
      if (g.required && sel.length === 0) issue ??= `Choix « ${g.name} » à compléter.`;
      if (sel.length > g.maxChoices) issue ??= `Trop de choix pour « ${g.name} ».`;
      for (const o of sel) {
        unit += o.priceDeltaCents;
        chosen.push({ group: g.name, name: o.name, priceDeltaCents: o.priceDeltaCents });
      }
    }
    const validIds = new Set(opts.filter((o) => pGroups.some((g) => g.id === o.groupId)).map((o) => o.id));
    if (l.optionIds.some((id) => !validIds.has(id))) issue ??= "Une option choisie n’existe plus.";

    const total = totalQtyBy.get(p.id)!;
    const stockMax = sellable.get(p.id) ?? null;
    let maxQty = stockMax;
    if (p.maxPerOrder != null) maxQty = maxQty == null ? p.maxPerOrder : Math.min(maxQty, p.maxPerOrder);
    if (stockMax != null && total > stockMax) issue ??= stockMax === 0 ? "Épuisé pour le moment." : `Plus que ${stockMax} disponible${stockMax > 1 ? "s" : ""}.`;
    else if (p.maxPerOrder != null && total > p.maxPerOrder) issue ??= `Maximum ${p.maxPerOrder} par commande.`;

    return { ...l, name: p.name, unitPriceCents: unit, options: chosen, lineTotalCents: unit * l.qty, issue, maxQty };
  });

  const subtotalCents = priced.reduce((n, l) => n + l.lineTotalCents, 0);
  return { lines: priced, subtotalCents, hasIssues: priced.some((l) => l.issue) };
}

export async function findDeliveryZone(postalCode: string, city: string) {
  const pc = normalizePostalCode(postalCode);
  const c = normalizeCity(city);
  const zones = await db.select().from(schema.deliveryZones).where(eq(schema.deliveryZones.active, true));
  return (
    zones.find(
      (z) => z.postalCodes.map(normalizePostalCode).includes(pc) && (z.cities.length === 0 || z.cities.map(normalizeCity).includes(c)),
    ) ?? null
  );
}

export type PromoResult = { ok: true; promo: typeof schema.promoCodes.$inferSelect; discountCents: number } | { ok: false; error: string };

export async function checkPromo(code: string, subtotalCents: number, now = new Date()): Promise<PromoResult> {
  const c = code.trim().toUpperCase();
  if (!c) return { ok: false, error: "Code vide." };
  const promo = await db.query.promoCodes.findFirst({ where: eq(sql`upper(${schema.promoCodes.code})`, c) });
  if (!promo || !promo.active) return { ok: false, error: "Ce code promo n’existe pas." };
  if (promo.startsAt && promo.startsAt > now) return { ok: false, error: "Ce code n’est pas encore actif." };
  if (promo.endsAt && promo.endsAt < now) return { ok: false, error: "Ce code a expiré." };
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) return { ok: false, error: "Ce code a atteint son nombre maximum d’utilisations." };
  if (subtotalCents < promo.minOrderCents) return { ok: false, error: `Ce code est valable dès ${formatPrice(promo.minOrderCents)} d’achat.` };
  const discountCents = promo.kind === "percent" ? Math.round((subtotalCents * Math.min(promo.value, 100)) / 100) : Math.min(promo.value, subtotalCents);
  return { ok: true, promo, discountCents };
}

export function deliveryFee(zone: { feeCents: number; freeAboveCents: number | null }, amountCents: number) {
  if (zone.freeAboveCents != null && amountCents >= zone.freeAboveCents) return 0;
  return zone.feeCents;
}
