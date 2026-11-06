import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Flame, AlertTriangle, UtensilsCrossed, ArrowRight } from "lucide-react";
import { getSettings } from "@/server/settings";
import { getMenu } from "@/server/catalog";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { PageBanner, BannerChip, SectionTitle } from "@/components/page-banner";
import { CategoryNav } from "@/components/category-nav";

export const metadata: Metadata = { title: "La carte", description: "Plats africains faits maison : mafé, yassa, thiéboudienne, grillades, accompagnements, desserts et boissons maison." };

export default async function MenuPage() {
  const [s, menu] = await Promise.all([getSettings(), getMenu()]);
  return (
    <div>
      <PageBanner
        eyebrow="Cuisiné à la commande"
        title="La carte"
        subtitle="Des recettes d’Afrique de l’Ouest et Centrale, préparées pour vous à l’heure de votre choix."
      >
        <BannerChip>
          <Clock className="size-4 text-gold" /> Au moins {s.ordering.minLeadHours} h à l’avance
        </BannerChip>
        <BannerChip>
          <Flame className="size-4 text-gold" /> Fait maison
        </BannerChip>
        <BannerChip>
          <AlertTriangle className="size-4 text-gold" />
          <Link href="/allergenes" className="underline-offset-2 hover:underline">
            Allergènes
          </Link>
        </BannerChip>
      </PageBanner>

      {menu.categories.length > 0 && <CategoryNav categories={menu.categories.map((c) => ({ id: c.id, name: c.name, count: c.products.length }))} />}

      <div className="mx-auto max-w-6xl space-y-14 px-4 pt-10">
        {menu.categories.length === 0 && (
          <EmptyState icon={<UtensilsCrossed className="size-10" />} title="La carte arrive bientôt">
            Revenez très vite pour découvrir nos plats.
          </EmptyState>
        )}
        {menu.categories.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-36">
            <Reveal>
              <SectionTitle title={c.name} subtitle={c.description} count={c.products.length} />
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {c.products.map((p, i) => (
                <Reveal key={p.id} delay={(i % 4) * 90}>
                  <ProductCard p={p} lowStock={s.ordering.lowStockDisplay} />
                </Reveal>
              ))}
            </div>
          </section>
        ))}

        {menu.categories.length > 0 && (
          <Reveal>
            <div className="flex flex-col items-center gap-4 rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-black/5 sm:flex-row sm:text-left">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-terracotta to-gold text-white shadow-lg">
                <Clock className="size-7" />
              </div>
              <div className="flex-1">
                <div className="text-lg font-semibold">Retrait ou livraison, à l’heure qui vous arrange</div>
                <p className="text-muted">Découvrez nos horaires, nos zones de livraison et nos frais.</p>
              </div>
              <Link href="/infos" className="group inline-flex h-12 items-center gap-2 rounded-full bg-forest px-6 font-semibold text-white transition hover:bg-forest-dark">
                Infos pratiques <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}
