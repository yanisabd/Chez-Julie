"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";

export async function productsForReorder(ids: number[]) {
  const clean = ids.filter((x) => Number.isInteger(x)).slice(0, 50);
  if (!clean.length) return [];
  const prods = await db
    .select()
    .from(schema.products)
    .where(and(inArray(schema.products.id, clean), eq(schema.products.active, true), isNull(schema.products.deletedAt)));
  const groups = await db.select({ productId: schema.optionGroups.productId }).from(schema.optionGroups).where(inArray(schema.optionGroups.productId, clean));
  return prods.map((p) => ({ id: p.id, slug: p.slug, name: p.name, imageId: p.imageId, priceCents: p.priceCents, hasOptions: groups.some((g) => g.productId === p.id) }));
}
