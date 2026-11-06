import Link from "next/link";
import { Plus, Flame } from "lucide-react";
import { DishImage } from "./dish-image";
import { formatPrice } from "@/lib/format";
import type { MenuProduct } from "@/server/catalog";
import { daysLabel } from "@/server/catalog";
import { QuickAdd } from "./quick-add";

export function ProductCard({ p, lowStock }: { p: MenuProduct; lowStock: number }) {
  const soldOut = p.sellable === 0;
  const few = p.sellable != null && p.sellable > 0 && p.sellable <= lowStock;
  const days = daysLabel(p.availableDays);
  return (
    <div className={`group relative flex h-full gap-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:flex-col sm:p-0 ${soldOut ? "opacity-60" : ""}`}>
      <Link href={`/plat/${p.slug}`} className="absolute inset-0 z-0 rounded-2xl" aria-label={`Voir ${p.name}`} />
      <div className="relative w-28 shrink-0 overflow-hidden rounded-xl sm:w-full sm:rounded-b-none sm:rounded-t-2xl">
        <DishImage imageId={p.imageId} name={p.name} className="aspect-square w-full transition duration-700 ease-out group-hover:scale-110 sm:aspect-[4/3]" rounded="rounded-none" />
        {p.featured && (
          <span className="absolute left-2 top-2 hidden rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-ink shadow sm:inline-block">★ Favori</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col sm:px-4 sm:pb-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold leading-snug">{p.name}</h3>
          {p.spicy > 0 && (
            <span className="mt-1 flex shrink-0 text-terracotta" title="Pimenté">
              {Array.from({ length: p.spicy }).map((_, i) => (
                <Flame key={i} className="size-4" />
              ))}
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {soldOut && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-700">Épuisé</span>}
          {few && <span className="rounded-full bg-terracotta-light px-2 py-0.5 text-xs font-semibold text-terracotta-dark">Plus que {p.sellable}</span>}
          {days && <span className="rounded-full bg-forest-light px-2 py-0.5 text-xs font-semibold text-forest">Le {days}</span>}
        </div>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-lg font-bold">{formatPrice(p.priceCents)}</span>
          {!soldOut &&
            (p.hasOptions ? (
              <Link href={`/plat/${p.slug}`} className="relative z-10 grid size-10 place-items-center rounded-full bg-terracotta text-white shadow-sm hover:bg-terracotta-dark" aria-label={`Choisir ${p.name}`}>
                <Plus className="size-5" />
              </Link>
            ) : (
              <QuickAdd product={{ productId: p.id, slug: p.slug, name: p.name, imageId: p.imageId, unitPriceCents: p.priceCents }} />
            ))}
        </div>
      </div>
    </div>
  );
}
