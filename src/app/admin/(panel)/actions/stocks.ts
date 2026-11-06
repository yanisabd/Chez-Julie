"use server";

import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { guarded, form, UserError } from "@/server/action";
import { audit } from "@/server/log";

/** Convertit une saisie (ex. 2,5 kg) dans l'unité de base de l'ingrédient (g). */
function toBase(qty: number, inputUnit: string) {
  if (inputUnit === "kg" || inputUnit === "l") return Math.round(qty * 1000);
  return Math.round(qty);
}

export async function setProductStock(id: number, fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const mode = form.str(fd, "mode");
    const qty = form.int(fd, "qty");
    if (qty == null) throw new UserError("Quantité invalide.");
    const p = await db.query.products.findFirst({ where: eq(schema.products.id, id) });
    if (!p || p.stockQty == null) throw new UserError("Le stock n’est pas suivi pour ce plat.");
    // Le nouveau stock ne peut pas être inférieur aux quantités en cours de paiement
    const target = mode === "add" ? p.stockQty + qty : qty;
    if (target < p.reservedQty) throw new UserError(`Impossible : ${p.reservedQty} sont en cours de paiement.`);
    const [row] = await db
      .update(schema.products)
      .set({ stockQty: mode === "add" ? sql`${schema.products.stockQty} + ${qty}` : qty, updatedAt: new Date() })
      .where(eq(schema.products.id, id))
      .returning();
    await db.insert(schema.stockMovements).values({ productId: id, delta: (row.stockQty ?? 0) - (p.stockQty ?? 0), reason: mode === "add" ? "restock" : "adjustment", actorLabel: actor.label });
    await audit(actor, "stock.product", "product", id, { from: p.stockQty, to: row.stockQty });
    return { ok: true, message: `Stock de « ${p.name} » : ${row.stockQty}` };
  });
}

export async function saveIngredient(id: number | null, fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const name = form.str(fd, "name");
    if (name.length < 2) throw new UserError("Nom trop court.");
    const unit = ["g", "ml", "pce"].includes(form.str(fd, "unit")) ? form.str(fd, "unit") : "g";
    const alertIn = form.num(fd, "alert");
    const alertUnit = unit === "pce" ? "pce" : form.str(fd, "alertUnit") || unit;
    const alertThreshold = alertIn == null ? null : toBase(alertIn, alertUnit);
    if (id) {
      await db.update(schema.ingredients).set({ name, alertThreshold, updatedAt: new Date() }).where(eq(schema.ingredients.id, id));
    } else {
      const stockIn = form.num(fd, "stock") ?? 0;
      const stock = toBase(stockIn, unit === "pce" ? "pce" : form.str(fd, "stockUnit") || unit);
      const [row] = await db.insert(schema.ingredients).values({ name, unit, stock, alertThreshold }).returning();
      await db.insert(schema.stockMovements).values({ ingredientId: row.id, delta: stock, reason: "restock", actorLabel: actor.label });
    }
    await audit(actor, id ? "ingredient.update" : "ingredient.create", "ingredient", id, { name });
    return { ok: true, message: id ? "Ingrédient modifié" : "Ingrédient ajouté" };
  });
}

export async function adjustIngredient(id: number, fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const ing = await db.query.ingredients.findFirst({ where: eq(schema.ingredients.id, id) });
    if (!ing) throw new UserError("Ingrédient introuvable.");
    const q = form.num(fd, "qty");
    if (q == null || q < 0) throw new UserError("Quantité invalide.");
    const qty = toBase(q, ing.unit === "pce" ? "pce" : form.str(fd, "inputUnit") || ing.unit);
    const mode = form.str(fd, "mode");
    const target = mode === "add" ? ing.stock + qty : qty;
    if (target < ing.reserved) throw new UserError("Impossible : une partie est réservée par des paiements en cours.");
    await db.update(schema.ingredients).set({ stock: target, updatedAt: new Date() }).where(eq(schema.ingredients.id, id));
    await db.insert(schema.stockMovements).values({ ingredientId: id, delta: target - ing.stock, reason: mode === "add" ? "restock" : "adjustment", actorLabel: actor.label });
    await audit(actor, "stock.ingredient", "ingredient", id, { from: ing.stock, to: target });
    return { ok: true, message: `Stock de « ${ing.name} » mis à jour` };
  });
}

export async function deleteIngredient(id: number) {
  return guarded(["admin"], async ({ actor }) => {
    const used = await db.query.recipeItems.findFirst({ where: eq(schema.recipeItems.ingredientId, id) });
    if (used) throw new UserError("Cet ingrédient est utilisé dans une recette. Retirez-le des plats d’abord.");
    const ing = await db.query.ingredients.findFirst({ where: eq(schema.ingredients.id, id) });
    if (ing && ing.reserved > 0) throw new UserError("Des paiements sont en cours sur cet ingrédient. Réessayez dans quelques minutes.");
    await db.delete(schema.ingredients).where(eq(schema.ingredients.id, id));
    await audit(actor, "ingredient.delete", "ingredient", id);
    return { ok: true, message: "Ingrédient supprimé" };
  });
}
