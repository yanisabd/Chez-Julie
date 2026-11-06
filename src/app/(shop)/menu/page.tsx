import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { getMenu } from "@/server/catalog";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/ui";
import { UtensilsCrossed } from "lucide-react";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = { title: "La carte" };

export default async function MenuPage() {
  const [s, menu] = await Promise.all([getSettings(), getMenu()]);
  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-8">
        <h1 className="text-3xl font-bold sm:text-4xl">La carte</h1>
        <p className="mt-1 text-muted">
          Tout est cuisiné à la commande. Commandez au moins {s.ordering.minLeadHours} h avant votre créneau.
        </p>
      </div>
      <nav className="no-scrollbar sticky top-16 z-30 mt-4 overflow-x-auto border-b border-sand-dark/70 bg-sand/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-2 px-4 py-3">
          {menu.categories.map((c) => (
            <a key={c.id} href={`#cat-${c.id}`} className="shrink-0 rounded-full bg-white px-4 py-2 text-[15px] font-medium shadow-sm ring-1 ring-black/5 transition duration-200 hover:-translate-y-0.5 hover:bg-forest hover:text-white">
              {c.name}
            </a>
          ))}
        </div>
      </nav>
      <div className="mx-auto max-w-6xl space-y-12 px-4 pt-8">
        {menu.categories.length === 0 && (
          <EmptyState icon={<UtensilsCrossed className="size-10" />} title="La carte arrive bientôt">
            Revenez très vite pour découvrir nos plats.
          </EmptyState>
        )}
        {menu.categories.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-36">
            <h2 className="text-2xl font-bold">{c.name}</h2>
            {c.description && <p className="mt-0.5 text-muted">{c.description}</p>}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {c.products.map((p, i) => (
                <Reveal key={p.id} delay={(i % 4) * 90}>
                  <ProductCard p={p} lowStock={s.ordering.lowStockDisplay} />
                </Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
