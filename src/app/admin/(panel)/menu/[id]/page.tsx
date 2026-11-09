import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, Copy, Trash2 } from "lucide-react";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/action";
import { ProductForm } from "./product-form";
import { duplicateProduct, deleteProduct } from "../../actions/menu";

export default async function ProductEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "nouveau";
  const pid = Number(id);
  if (!isNew && !Number.isInteger(pid)) notFound();
  const p = isNew ? null : await db.query.products.findFirst({ where: eq(schema.products.id, pid) });
  if (!isNew && (!p || p.deletedAt)) notFound();
  const cats = await db.select().from(schema.categories).orderBy(asc(schema.categories.position));
  const ings = await db.select().from(schema.ingredients).orderBy(asc(schema.ingredients.name));
  const groups = p ? await db.select().from(schema.optionGroups).where(eq(schema.optionGroups.productId, p.id)).orderBy(asc(schema.optionGroups.position)) : [];
  const opts = groups.length ? await db.select().from(schema.options).where(inArray(schema.options.groupId, groups.map((g) => g.id))).orderBy(asc(schema.options.position)) : [];
  const recipe = p ? await db.select().from(schema.recipeItems).where(eq(schema.recipeItems.productId, p.id)) : [];

  return (
    <div>
      <Link href="/admin/menu" className="mb-4 inline-flex items-center gap-1.5 font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Plats & catégories
      </Link>
      <PageHeader
        title={p ? p.name : "Nouveau plat"}
        actions={
          p && (
            <>
              <ActionButton action={duplicateProduct.bind(null, p.id)} variant="outline">
                <Copy className="size-4" /> Dupliquer
              </ActionButton>
              <ActionButton action={deleteProduct.bind(null, p.id)} variant="outline" className="text-red-700" confirm={`Supprimer « ${p.name} » de la carte ? Les anciennes commandes restent consultables.`}>
                <Trash2 className="size-4" /> Supprimer
              </ActionButton>
            </>
          )
        }
      />
      <ProductForm
        product={
          p
            ? {
                id: p.id,
                name: p.name,
                categoryId: p.categoryId,
                priceCents: p.priceCents,
                description: p.description,
                ingredientsText: p.ingredientsText,
                allergens: p.allergens,
                availableDays: p.availableDays,
                active: p.active,
                featured: p.featured,
                spicy: p.spicy,
                stockQty: p.stockQty,
                reservedQty: p.reservedQty,
                alertThreshold: p.alertThreshold,
                dailyLimit: p.dailyLimit,
                maxPerOrder: p.maxPerOrder,
                imageId: p.imageId,
                galleryImageIds: p.galleryImageIds,
              }
            : null
        }
        categories={cats.map((c) => ({ id: c.id, name: c.name }))}
        ingredients={ings.map((i) => ({ id: i.id, name: i.name, unit: i.unit }))}
        initialOptions={groups.map((g) => ({
          id: g.id,
          name: g.name,
          required: g.required,
          maxChoices: g.maxChoices,
          options: opts.filter((o) => o.groupId === g.id).map((o) => ({ id: o.id, name: o.name, price: o.priceDeltaCents ? (o.priceDeltaCents / 100).toFixed(2).replace(".", ",") : "" })),
        }))}
        initialRecipe={recipe.map((r) => ({ ingredientId: r.ingredientId, quantity: r.quantity }))}
      />
    </div>
  );
}
