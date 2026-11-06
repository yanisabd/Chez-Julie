import { and, asc, eq, isNull, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { sellableQuantities } from "./inventory";
import type { Settings } from "@/lib/settings-schema";
import { WEEKDAYS } from "@/lib/time";

export type MenuProduct = {
  id: number;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  imageId: string | null;
  categoryId: number | null;
  allergens: string[];
  spicy: number;
  featured: boolean;
  availableDays: number[];
  sellable: number | null;
  hasOptions: boolean;
};

export async function getMenu() {
  const cats = await db.select().from(schema.categories).where(eq(schema.categories.active, true)).orderBy(asc(schema.categories.position), asc(schema.categories.id));
  const prods = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.active, true), isNull(schema.products.deletedAt)))
    .orderBy(asc(schema.products.position), asc(schema.products.id));
  const ids = prods.map((p) => p.id);
  const sellable = await sellableQuantities(db, ids);
  const groups = ids.length ? await db.select({ productId: schema.optionGroups.productId }).from(schema.optionGroups).where(inArray(schema.optionGroups.productId, ids)) : [];
  const withOptions = new Set(groups.map((g) => g.productId));
  const activeCatIds = new Set(cats.map((c) => c.id));

  const products: MenuProduct[] = prods
    .filter((p) => p.categoryId == null || activeCatIds.has(p.categoryId))
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      priceCents: p.priceCents,
      imageId: p.imageId,
      categoryId: p.categoryId,
      allergens: p.allergens,
      spicy: p.spicy,
      featured: p.featured,
      availableDays: p.availableDays,
      sellable: sellable.get(p.id) ?? null,
      hasOptions: withOptions.has(p.id),
    }));
  return {
    categories: cats.map((c) => ({ ...c, products: products.filter((p) => p.categoryId === c.id) })).filter((c) => c.products.length),
    products,
  };
}

export async function getProduct(slug: string) {
  const p = await db.query.products.findFirst({ where: and(eq(schema.products.slug, slug), isNull(schema.products.deletedAt)) });
  if (!p) return null;
  const groups = await db.select().from(schema.optionGroups).where(eq(schema.optionGroups.productId, p.id)).orderBy(asc(schema.optionGroups.position), asc(schema.optionGroups.id));
  const opts = groups.length
    ? await db.select().from(schema.options).where(inArray(schema.options.groupId, groups.map((g) => g.id))).orderBy(asc(schema.options.position), asc(schema.options.id))
    : [];
  const category = p.categoryId ? await db.query.categories.findFirst({ where: eq(schema.categories.id, p.categoryId) }) : null;
  const sellable = (await sellableQuantities(db, [p.id])).get(p.id) ?? null;
  return { ...p, category, sellable, groups: groups.map((g) => ({ ...g, options: opts.filter((o) => o.groupId === g.id) })) };
}

export function daysLabel(days: number[]) {
  if (!days.length || days.length === 7) return null;
  return days
    .slice()
    .sort()
    .map((d) => WEEKDAYS[d - 1].slice(0, 3).toLowerCase() + ".")
    .join(" ");
}

/** Résumé lisible des horaires : [{ day: "Lundi", text: "18h00 – 21h30" }] */
export function scheduleSummary(settings: Settings) {
  return settings.schedule.map((d, i) => ({
    day: WEEKDAYS[i],
    open: d.open && d.ranges.length > 0,
    text: d.open && d.ranges.length ? d.ranges.map((r) => `${r.start.replace(":", "h")} – ${r.end.replace(":", "h")}`).join(" · ") : "Fermé",
    ranges: d.ranges,
  }));
}
