"use server";

import { redirect } from "next/navigation";
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { guarded, form, UserError } from "@/server/action";
import { saveImage } from "@/server/images";
import { audit } from "@/server/log";
import { parsePriceToCents, slugify } from "@/lib/format";
import { ALLERGENS } from "@/lib/constants";

/* ---------------------------- Catégories ---------------------------- */

export async function saveCategory(id: number | null, fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const name = form.str(fd, "name");
    if (name.length < 2) throw new UserError("Nom de catégorie trop court.");
    const description = form.str(fd, "description") || null;
    if (id) {
      await db.update(schema.categories).set({ name, description }).where(eq(schema.categories.id, id));
    } else {
      const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${schema.categories.position}), 0)` }).from(schema.categories);
      await db.insert(schema.categories).values({ name, description, position: Number(max) + 1 });
    }
    await audit(actor, id ? "category.update" : "category.create", "category", id, { name });
    return { ok: true, message: id ? "Catégorie modifiée" : "Catégorie ajoutée" };
  });
}

export async function toggleCategory(id: number) {
  return guarded(["admin"], async ({ actor }) => {
    await db.update(schema.categories).set({ active: sql`NOT ${schema.categories.active}` }).where(eq(schema.categories.id, id));
    await audit(actor, "category.toggle", "category", id);
  });
}

export async function moveCategory(id: number, dir: -1 | 1) {
  return guarded(["admin"], async () => {
    const all = await db.select().from(schema.categories).orderBy(asc(schema.categories.position), asc(schema.categories.id));
    const i = all.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j], all[i]];
    await db.transaction(async (tx) => {
      for (const [pos, c] of all.entries()) await tx.update(schema.categories).set({ position: pos }).where(eq(schema.categories.id, c.id));
    });
  });
}

export async function deleteCategory(id: number) {
  return guarded(["admin"], async ({ actor }) => {
    const used = await db.query.products.findFirst({ where: and(eq(schema.products.categoryId, id), isNull(schema.products.deletedAt)) });
    if (used) throw new UserError("Cette catégorie contient encore des plats. Déplacez-les ou supprimez-les d’abord.");
    await db.delete(schema.categories).where(eq(schema.categories.id, id));
    await audit(actor, "category.delete", "category", id);
    return { ok: true, message: "Catégorie supprimée" };
  });
}

/* ------------------------------ Plats ------------------------------- */

const optionsSchema = z.array(
  z.object({
    id: z.number().int().optional(),
    name: z.string().trim().min(1, "Nom de groupe d’options manquant").max(60),
    required: z.boolean(),
    maxChoices: z.number().int().min(1).max(20),
    options: z.array(z.object({ id: z.number().int().optional(), name: z.string().trim().min(1, "Nom d’option manquant").max(60), price: z.string().max(10) })).min(1, "Chaque groupe doit avoir au moins un choix"),
  }),
);
const recipeSchema = z.array(z.object({ ingredientId: z.number().int(), quantity: z.number().int().min(1).max(1_000_000) }));

export async function saveProduct(id: number | null, fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const name = form.str(fd, "name");
    if (name.length < 2) throw new UserError("Le nom du plat est obligatoire.");
    const price = parsePriceToCents(form.str(fd, "price"));
    if (price == null || price <= 0) throw new UserError("Prix invalide (exemple : 12,50).");
    const categoryId = form.int(fd, "categoryId");
    const allergens = fd.getAll("allergens").map(String).filter((a) => ALLERGENS.some((x) => x.code === a));
    const days = fd.getAll("days").map(Number).filter((d) => d >= 1 && d <= 7);
    const trackStock = form.bool(fd, "trackStock");
    const stockQty = trackStock ? Math.max(0, form.int(fd, "stockQty") ?? 0) : null;
    const nonNeg = (k: string) => {
      const v = form.int(fd, k);
      return v == null ? null : Math.max(0, v);
    };
    const options = optionsSchema.parse(JSON.parse(form.str(fd, "optionsJson") || "[]"));
    const recipe = recipeSchema.parse(JSON.parse(form.str(fd, "recipeJson") || "[]"));
    for (const g of options) for (const o of g.options) if (o.price && parsePriceToCents(o.price.replace("+", "")) == null) throw new UserError(`Supplément invalide pour « ${o.name} ».`);

    let imageId: string | undefined | null;
    const file = fd.get("image");
    if (file instanceof File && file.size > 0) imageId = await saveImage(file);
    if (form.bool(fd, "removeImage")) imageId = null;

    // Slug unique
    let slug = slugify(name) || "plat";
    for (let n = 2; ; n++) {
      const clash = await db.query.products.findFirst({ where: and(eq(schema.products.slug, slug), id ? ne(schema.products.id, id) : undefined) });
      if (!clash) break;
      slug = `${slugify(name)}-${n}`;
    }

    const values = {
      name,
      slug,
      categoryId,
      priceCents: price,
      description: form.str(fd, "description"),
      ingredientsText: form.str(fd, "ingredientsText"),
      allergens,
      availableDays: days.length === 7 ? [] : days,
      active: form.bool(fd, "active"),
      featured: form.bool(fd, "featured"),
      spicy: Math.min(3, Math.max(0, form.int(fd, "spicy") ?? 0)),
      stockQty,
      alertThreshold: nonNeg("alertThreshold"),
      dailyLimit: nonNeg("dailyLimit"),
      maxPerOrder: nonNeg("maxPerOrder") || null,
      updatedAt: new Date(),
      ...(imageId !== undefined ? { imageId } : {}),
    };

    let productId = id;
    await db.transaction(async (tx) => {
      if (id) {
        const before = await tx.query.products.findFirst({ where: eq(schema.products.id, id) });
        if (!before) throw new UserError("Plat introuvable.");
        await tx.update(schema.products).set(values).where(eq(schema.products.id, id));
        if (before.stockQty !== stockQty) {
          await tx.insert(schema.stockMovements).values({ productId: id, delta: (stockQty ?? 0) - (before.stockQty ?? 0), reason: "adjustment", actorLabel: actor.label });
        }
      } else {
        const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${schema.products.position}), 0)` }).from(schema.products);
        const [row] = await tx.insert(schema.products).values({ ...values, position: Number(max) + 1 }).returning({ id: schema.products.id });
        productId = row.id;
      }
      // Options : mise à jour en conservant les identifiants existants, pour que les paniers
      // déjà remplis par les clients restent valides (les commandes passées gardent leur propre copie).
      const existingGroups = await tx.select().from(schema.optionGroups).where(eq(schema.optionGroups.productId, productId!));
      const keptGroups = new Set<number>();
      for (const [gi, g] of options.entries()) {
        const values = { name: g.name, required: g.required, maxChoices: g.maxChoices, position: gi };
        let groupId: number;
        if (g.id && existingGroups.some((x) => x.id === g.id)) {
          groupId = g.id;
          await tx.update(schema.optionGroups).set(values).where(eq(schema.optionGroups.id, groupId));
        } else {
          groupId = (await tx.insert(schema.optionGroups).values({ productId: productId!, ...values }).returning())[0].id;
        }
        keptGroups.add(groupId);
        const existingOpts = await tx.select().from(schema.options).where(eq(schema.options.groupId, groupId));
        const keptOpts = new Set<number>();
        for (const [oi, o] of g.options.entries()) {
          const ov = { name: o.name, priceDeltaCents: parsePriceToCents(o.price.replace("+", "")) ?? 0, position: oi };
          if (o.id && existingOpts.some((x) => x.id === o.id)) {
            await tx.update(schema.options).set(ov).where(eq(schema.options.id, o.id));
            keptOpts.add(o.id);
          } else {
            keptOpts.add((await tx.insert(schema.options).values({ groupId, ...ov }).returning())[0].id);
          }
        }
        for (const x of existingOpts) if (!keptOpts.has(x.id)) await tx.delete(schema.options).where(eq(schema.options.id, x.id));
      }
      for (const x of existingGroups) if (!keptGroups.has(x.id)) await tx.delete(schema.optionGroups).where(eq(schema.optionGroups.id, x.id));
      await tx.delete(schema.recipeItems).where(eq(schema.recipeItems.productId, productId!));
      const seen = new Set<number>();
      for (const r of recipe) {
        if (seen.has(r.ingredientId)) continue;
        seen.add(r.ingredientId);
        await tx.insert(schema.recipeItems).values({ productId: productId!, ingredientId: r.ingredientId, quantity: r.quantity });
      }
    });
    await audit(actor, id ? "product.update" : "product.create", "product", productId, { name, price });
    if (!id) redirect(`/admin/menu?ajoute=${productId}`);
    return { ok: true, message: "Plat enregistré ✓" };
  });
}

export async function toggleProduct(id: number) {
  return guarded(["admin"], async ({ actor }) => {
    const [p] = await db.update(schema.products).set({ active: sql`NOT ${schema.products.active}`, updatedAt: new Date() }).where(eq(schema.products.id, id)).returning();
    await audit(actor, p.active ? "product.enable" : "product.disable", "product", id, { name: p.name });
    return { ok: true, message: p.active ? `« ${p.name} » est de nouveau en vente` : `« ${p.name} » est masqué de la carte` };
  });
}

export async function moveProduct(id: number, dir: -1 | 1) {
  return guarded(["admin"], async () => {
    const p = await db.query.products.findFirst({ where: eq(schema.products.id, id) });
    if (!p) return;
    const all = await db
      .select()
      .from(schema.products)
      .where(and(p.categoryId ? eq(schema.products.categoryId, p.categoryId) : isNull(schema.products.categoryId), isNull(schema.products.deletedAt)))
      .orderBy(asc(schema.products.position), asc(schema.products.id));
    const i = all.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j], all[i]];
    await db.transaction(async (tx) => {
      for (const [pos, x] of all.entries()) await tx.update(schema.products).set({ position: pos }).where(eq(schema.products.id, x.id));
    });
  });
}

export async function duplicateProduct(id: number) {
  return guarded(["admin"], async ({ actor }) => {
    const p = await db.query.products.findFirst({ where: eq(schema.products.id, id) });
    if (!p) throw new UserError("Plat introuvable.");
    const groups = await db.select().from(schema.optionGroups).where(eq(schema.optionGroups.productId, id));
    const recipe = await db.select().from(schema.recipeItems).where(eq(schema.recipeItems.productId, id));
    let newId = 0;
    await db.transaction(async (tx) => {
      const { id: _i, createdAt: _c, updatedAt: _u, reservedQty: _r, ...rest } = p;
      const [row] = await tx
        .insert(schema.products)
        .values({ ...rest, name: `${p.name} (copie)`, slug: `${p.slug}-copie-${Date.now().toString(36)}`, active: false })
        .returning();
      newId = row.id;
      for (const g of groups) {
        const opts = await tx.select().from(schema.options).where(eq(schema.options.groupId, g.id));
        const [ng] = await tx.insert(schema.optionGroups).values({ productId: row.id, name: g.name, required: g.required, maxChoices: g.maxChoices, position: g.position }).returning();
        if (opts.length) await tx.insert(schema.options).values(opts.map((o) => ({ groupId: ng.id, name: o.name, priceDeltaCents: o.priceDeltaCents, position: o.position })));
      }
      for (const r of recipe) await tx.insert(schema.recipeItems).values({ ...r, productId: row.id });
    });
    await audit(actor, "product.duplicate", "product", newId, { from: id });
    redirect(`/admin/menu/${newId}`);
  });
}

/** Suppression « douce » : le plat disparaît mais l'historique des commandes reste intact. */
export async function deleteProduct(id: number) {
  return guarded(["admin"], async ({ actor }) => {
    const p = await db.query.products.findFirst({ where: eq(schema.products.id, id) });
    if (!p) throw new UserError("Plat introuvable.");
    await db
      .update(schema.products)
      .set({ deletedAt: new Date(), active: false, slug: `${p.slug}-supprime-${Date.now().toString(36)}` })
      .where(eq(schema.products.id, id));
    await audit(actor, "product.delete", "product", id, { name: p.name });
    redirect("/admin/menu?supprime=1");
  });
}
