import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Flame, AlertTriangle, CalendarDays } from "lucide-react";
import { getProduct, daysLabel } from "@/server/catalog";
import { getSettings } from "@/server/settings";
import { DishImage } from "@/components/dish-image";
import { allergenLabel } from "@/lib/constants";
import { AddToCart } from "./add-to-cart";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  return { title: p?.name ?? "Plat", description: p?.description };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getProduct((await params).slug);
  if (!p || !p.active) notFound();
  const s = await getSettings();
  const days = daysLabel(p.availableDays);
  const soldOut = p.sellable === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6">
      <Link href="/menu" className="mb-4 inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Retour à la carte
      </Link>
      <div className="grid gap-8 md:grid-cols-2">
        <DishImage imageId={p.imageId} name={p.name} className="aspect-square w-full shadow-md md:sticky md:top-24" rounded="rounded-3xl" />
        <div>
          {p.category && <div className="text-sm font-semibold uppercase tracking-wide text-terracotta">{p.category.name}</div>}
          <h1 className="mt-1 flex items-center gap-3 text-3xl font-bold sm:text-4xl">
            {p.name}
            {p.spicy > 0 && (
              <span className="flex text-terracotta" title="Pimenté">
                {Array.from({ length: p.spicy }).map((_, i) => (
                  <Flame key={i} className="size-6" />
                ))}
              </span>
            )}
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-ink/80">{p.description}</p>

          {days && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-forest-light px-3 py-2 text-[15px] font-medium text-forest">
              <CalendarDays className="size-5" /> Proposé uniquement le {days}
            </p>
          )}
          {p.sellable != null && p.sellable > 0 && p.sellable <= s.ordering.lowStockDisplay && (
            <p className="mt-3 font-semibold text-terracotta">Plus que {p.sellable} disponible{p.sellable > 1 ? "s" : ""} !</p>
          )}

          <div className="mt-6">
            <AddToCart
              soldOut={soldOut}
              product={{ id: p.id, slug: p.slug, name: p.name, imageId: p.imageId, priceCents: p.priceCents, maxQty: Math.min(p.maxPerOrder ?? 50, p.sellable ?? 50) }}
              groups={p.groups.map((g) => ({
                id: g.id,
                name: g.name,
                required: g.required,
                maxChoices: g.maxChoices,
                options: g.options.map((o) => ({ id: o.id, name: o.name, priceDeltaCents: o.priceDeltaCents })),
              }))}
            />
          </div>

          <div className="mt-8 space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            {p.ingredientsText && (
              <div>
                <h2 className="font-sans text-base font-bold">Ingrédients</h2>
                <p className="mt-1 text-[15px] text-muted">{p.ingredientsText}</p>
              </div>
            )}
            <div>
              <h2 className="flex items-center gap-2 font-sans text-base font-bold">
                <AlertTriangle className="size-4 text-amber-600" /> Allergènes
              </h2>
              {p.allergens.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.allergens.map((a) => (
                    <span key={a} className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
                      {allergenLabel(a)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[15px] text-muted">Aucun des 14 allergènes majeurs.</p>
              )}
              <p className="mt-2 text-xs text-muted">
                Nos plats sont préparés dans une cuisine où sont manipulés d’autres allergènes. <Link href="/allergenes" className="underline">En savoir plus</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
