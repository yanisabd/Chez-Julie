import Link from "next/link";
import { asc, isNull } from "drizzle-orm";
import { Plus, ChevronUp, ChevronDown, Pencil, Eye, EyeOff, Trash2 } from "lucide-react";
import { db, schema } from "@/db";
import { sellableQuantities } from "@/server/inventory";
import { formatPrice, cn } from "@/lib/format";
import { DishImage } from "@/components/dish-image";
import { PageHeader, Help, LinkButton, Card, Input, Badge } from "@/components/ui";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action";
import { toggleProduct, moveProduct, saveCategory, toggleCategory, moveCategory, deleteCategory } from "../actions/menu";
import { daysLabel } from "@/server/catalog";

export const metadata = { title: "Plats & catégories" };

export default async function MenuAdmin() {
  const cats = await db.select().from(schema.categories).orderBy(asc(schema.categories.position), asc(schema.categories.id));
  const prods = await db.select().from(schema.products).where(isNull(schema.products.deletedAt)).orderBy(asc(schema.products.position), asc(schema.products.id));
  const sellable = await sellableQuantities(db, prods.map((p) => p.id));
  const groups = [...cats.map((c) => ({ cat: c, items: prods.filter((p) => p.categoryId === c.id) })), { cat: null, items: prods.filter((p) => !p.categoryId || !cats.some((c) => c.id === p.categoryId)) }].filter(
    (g) => g.cat || g.items.length,
  );

  return (
    <div>
      <PageHeader
        title="Plats & catégories"
        subtitle="Ajoutez, modifiez ou masquez vos plats. Les changements sont visibles immédiatement sur le site."
        actions={
          <LinkButton href="/admin/menu/nouveau" variant="primary">
            <Plus className="size-5" /> Ajouter un plat
          </LinkButton>
        }
      />
      <Help>
        Le bouton <Eye className="inline size-4" /> / <EyeOff className="inline size-4" /> masque un plat de la carte sans le supprimer (pratique pour un plat temporairement indisponible). Les flèches changent l’ordre d’affichage.
      </Help>

      <div className="space-y-8">
        {groups.map(({ cat, items }) => (
          <section key={cat?.id ?? "none"}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className={cn("font-sans text-xl font-bold", cat && !cat.active && "text-stone-400 line-through")}>{cat?.name ?? "Sans catégorie"}</h2>
              {cat && (
                <div className="ml-auto flex items-center gap-1">
                  <ActionButton action={moveCategory.bind(null, cat.id, -1)} variant="ghost" size="sm" title="Monter">
                    <ChevronUp className="size-4" />
                  </ActionButton>
                  <ActionButton action={moveCategory.bind(null, cat.id, 1)} variant="ghost" size="sm" title="Descendre">
                    <ChevronDown className="size-4" />
                  </ActionButton>
                  <ActionButton action={toggleCategory.bind(null, cat.id)} variant="ghost" size="sm">
                    {cat.active ? <><EyeOff className="size-4" /> Masquer</> : <><Eye className="size-4" /> Afficher</>}
                  </ActionButton>
                  <details className="relative">
                    <summary className="flex h-9 cursor-pointer list-none items-center gap-1 rounded-full px-3 text-sm font-semibold hover:bg-black/5">
                      <Pencil className="size-4" /> Renommer
                    </summary>
                    <Card className="absolute right-0 z-20 mt-1 w-80">
                      <ActionForm action={saveCategory.bind(null, cat.id)} className="space-y-2">
                        <Input name="name" defaultValue={cat.name} required />
                        <Input name="description" defaultValue={cat.description ?? ""} placeholder="Description (facultatif)" />
                        <SubmitButton size="sm">Enregistrer</SubmitButton>
                      </ActionForm>
                    </Card>
                  </details>
                  {items.length === 0 && (
                    <ActionButton action={deleteCategory.bind(null, cat.id)} variant="ghost" size="sm" confirm={`Supprimer la catégorie « ${cat.name} » ?`}>
                      <Trash2 className="size-4" />
                    </ActionButton>
                  )}
                </div>
              )}
            </div>
            {items.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-sand-dark p-4 text-muted">Aucun plat dans cette catégorie.</p>
            ) : (
              <div className="space-y-2">
                {items.map((p) => {
                  const left = sellable.get(p.id);
                  const days = daysLabel(p.availableDays);
                  return (
                    <div key={p.id} className={cn("flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5", !p.active && "opacity-60")}>
                      <DishImage imageId={p.imageId} name={p.name} className="size-14 shrink-0" rounded="rounded-xl" />
                      <Link href={`/admin/menu/${p.id}`} className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold hover:underline">{p.name}</span>
                          {!p.active && <Badge className="bg-stone-100 text-stone-600 ring-stone-300">Masqué</Badge>}
                          {p.featured && <Badge className="bg-gold-light text-amber-900 ring-gold/40">Mis en avant</Badge>}
                          {left === 0 && <Badge className="bg-red-100 text-red-800 ring-red-300">Épuisé</Badge>}
                        </div>
                        <div className="text-sm text-muted">
                          {formatPrice(p.priceCents)}
                          {left != null && ` · ${left} vendable(s)`}
                          {p.dailyLimit != null && ` · ${p.dailyLimit}/jour max`}
                          {days && ` · le ${days}`}
                        </div>
                      </Link>
                      <div className="flex shrink-0 items-center">
                        <ActionButton action={moveProduct.bind(null, p.id, -1)} variant="ghost" size="sm" title="Monter" className="hidden sm:inline-flex">
                          <ChevronUp className="size-4" />
                        </ActionButton>
                        <ActionButton action={moveProduct.bind(null, p.id, 1)} variant="ghost" size="sm" title="Descendre" className="hidden sm:inline-flex">
                          <ChevronDown className="size-4" />
                        </ActionButton>
                        <ActionButton action={toggleProduct.bind(null, p.id)} variant="ghost" size="sm" title={p.active ? "Masquer de la carte" : "Remettre en vente"}>
                          {p.active ? <Eye className="size-5 text-forest" /> : <EyeOff className="size-5" />}
                        </ActionButton>
                        <Link href={`/admin/menu/${p.id}`} className="grid size-9 place-items-center rounded-full hover:bg-black/5" title="Modifier">
                          <Pencil className="size-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      <Card className="mt-10">
        <h2 className="font-sans text-lg font-bold">Ajouter une catégorie</h2>
        <ActionForm action={saveCategory.bind(null, null)} reset className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input name="name" placeholder="Ex. : Plats végétariens" required />
          <Input name="description" placeholder="Description (facultatif)" />
          <SubmitButton>Ajouter</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
