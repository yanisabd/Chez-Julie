import Link from "next/link";
import { ArrowRight, CalendarClock, UtensilsCrossed, Bike, Store, Leaf, HeartHandshake, Timer } from "lucide-react";
import { eq } from "drizzle-orm";
import { getSettings } from "@/server/settings";
import { getMenu, scheduleSummary } from "@/server/catalog";
import { ProductCard } from "@/components/product-card";
import { DishImage } from "@/components/dish-image";
import { Hero, Marquee } from "@/components/hero";
import { Reveal } from "@/components/reveal";
import { db, schema } from "@/db";
import { formatPrice } from "@/lib/format";

export default async function HomePage() {
  const [s, menu] = await Promise.all([getSettings(), getMenu()]);
  const featured = menu.products.filter((p) => p.featured);
  const showcase = (featured.length ? featured : menu.products).slice(0, 4);
  // Photos du bloc d'accueil : les plats « mis en avant », en priorité ceux qui ont une vraie photo
  const heroDishes = [...(featured.length ? featured : menu.products)].sort((a, b) => Number(!!b.imageId) - Number(!!a.imageId)).slice(0, 4);
  const zones = await db.select().from(schema.deliveryZones).where(eq(schema.deliveryZones.active, true));
  const hours = scheduleSummary(s);

  const steps = [
    { icon: UtensilsCrossed, t: "Choisissez vos plats", d: "Parcourez la carte, ajoutez vos plats et vos accompagnements." },
    { icon: CalendarClock, t: "Réservez votre créneau", d: `Le jour et l’heure qui vous arrangent, au moins ${s.ordering.minLeadHours} h à l’avance. Paiement sécurisé.` },
    { icon: s.ordering.deliveryEnabled ? Bike : Store, t: "Régalez-vous", d: "On cuisine pour vous. Retrait ou livraison, à l’heure prévue." },
  ];

  // Données structurées pour Google (fiche « Restaurant » dans les résultats de recherche)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: s.business.name,
    description: s.business.about,
    servesCuisine: "Africaine",
    telephone: s.business.phone || undefined,
    email: s.business.email || undefined,
    address: s.business.pickupAddress || undefined,
    url: process.env.APP_URL,
    acceptsReservations: false,
    hasMenu: `${process.env.APP_URL ?? ""}/menu`,
    openingHoursSpecification: s.schedule.flatMap((d, i) =>
      d.open ? d.ranges.map((r) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i], opens: r.start, closes: r.end })) : [],
    ),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Hero dishes={heroDishes} tagline={s.business.tagline} about={s.business.about} minLeadHours={s.ordering.minLeadHours} maxAdvanceDays={s.ordering.maxAdvanceDays} />
      <Marquee items={menu.products.slice(0, 10).map((p) => p.name)} />

      {/* Comment ça marche */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <p className="text-center text-sm font-bold uppercase tracking-[0.2em] text-terracotta">Simple comme bonjour</p>
          <h2 className="mt-2 text-center text-3xl font-bold sm:text-4xl">Comment ça marche ?</h2>
        </Reveal>
        <div className="relative mt-10 grid gap-5 sm:grid-cols-3">
          <div className="absolute left-[16%] right-[16%] top-10 hidden h-0.5 border-t-2 border-dashed border-sand-dark sm:block" />
          {steps.map((x, i) => (
            <Reveal key={x.t} delay={i * 150}>
              <div className="group relative h-full rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl">
                <div className="relative mx-auto grid size-20 place-items-center rounded-full bg-gradient-to-br from-terracotta to-gold text-white shadow-lg transition duration-500 group-hover:rotate-[10deg] group-hover:scale-110">
                  <x.icon className="size-9" />
                  <span className="absolute -right-1 -top-1 grid size-7 place-items-center rounded-full bg-forest text-sm font-bold ring-4 ring-white">{i + 1}</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold">{x.t}</h3>
                <p className="mt-1.5 text-muted">{x.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Spécialités */}
      {showcase.length > 0 && (
        <section className="mx-auto max-w-6xl px-4">
          <Reveal className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-terracotta">Les favoris</p>
              <h2 className="mt-1 text-3xl font-bold sm:text-4xl">Nos spécialités</h2>
            </div>
            <Link href="/menu" className="group hidden shrink-0 items-center gap-1 font-semibold text-terracotta sm:flex">
              Toute la carte <ArrowRight className="size-4 transition group-hover:translate-x-1" />
            </Link>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {showcase.map((p, i) => (
              <Reveal key={p.id} delay={i * 100}>
                <ProductCard p={p} lowStock={s.ordering.lowStockDisplay} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Nos engagements */}
      <section className="mx-auto max-w-6xl px-4 pt-16">
        <div className="relative overflow-hidden rounded-[2rem] bg-forest px-6 py-12 text-white sm:px-12">
          <div className="pattern-african absolute inset-0 opacity-50" />
          <div className="blob right-[-10%] top-[-30%] size-80 bg-gold/70" />
          <div className="relative grid gap-8 sm:grid-cols-3">
            {[
              { icon: Leaf, t: "Produits frais", d: "Cuisinés le jour même, jamais réchauffés de la veille." },
              { icon: HeartHandshake, t: "Recettes de famille", d: "Les saveurs authentiques d’Afrique de l’Ouest et Centrale." },
              { icon: Timer, t: "À l’heure", d: "Un nombre de commandes limité par créneau pour être prêts pile à temps." },
            ].map((x, i) => (
              <Reveal key={x.t} delay={i * 150} className="flex gap-4">
                <x.icon className="size-10 shrink-0 text-gold" />
                <div>
                  <h3 className="text-xl font-semibold">{x.t}</h3>
                  <p className="mt-1 text-white/75">{x.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Catégories */}
      {menu.categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-16">
          <Reveal>
            <h2 className="text-3xl font-bold sm:text-4xl">La carte</h2>
          </Reveal>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {menu.categories.map((c, i) => (
              <Reveal key={c.id} delay={i * 80}>
                <Link href={`/menu#cat-${c.id}`} className="group block rounded-3xl bg-white p-3 shadow-sm ring-1 ring-black/5 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl">
                  <div className="overflow-hidden rounded-2xl">
                    <DishImage imageId={c.products.find((p) => p.imageId)?.imageId ?? null} name={c.name} className="aspect-square w-full transition duration-500 group-hover:scale-110" rounded="rounded-2xl" />
                  </div>
                  <div className="mt-3 flex items-center justify-between px-1">
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-sm text-muted">{c.products.length} plat{c.products.length > 1 ? "s" : ""}</div>
                    </div>
                    <ArrowRight className="size-4 -translate-x-2 text-terracotta opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Infos pratiques */}
      <section className="mx-auto max-w-6xl px-4 pt-16">
        <div className="grid gap-4 md:grid-cols-3">
          {s.ordering.pickupEnabled && (
            <Reveal className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <Store className="size-8 text-forest" />
              <h3 className="mt-3 text-xl font-semibold">Retrait sur place</h3>
              <p className="mt-1 text-muted">{s.business.pickupAddress}</p>
              <p className="mt-2 text-sm text-muted">Gratuit · à l’heure de votre créneau</p>
            </Reveal>
          )}
          {s.ordering.deliveryEnabled && (
            <Reveal delay={120} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <Bike className="size-8 text-forest" />
              <h3 className="mt-3 text-xl font-semibold">Livraison</h3>
              <ul className="mt-1 space-y-1 text-muted">
                {zones.map((z) => (
                  <li key={z.id}>
                    {z.postalCodes.join(", ")} : {formatPrice(z.feeCents)}
                    {z.freeAboveCents != null && <span className="text-sm"> (offerte dès {formatPrice(z.freeAboveCents)})</span>}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
          <Reveal delay={240} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <CalendarClock className="size-8 text-forest" />
            <h3 className="mt-3 text-xl font-semibold">Horaires</h3>
            <ul className="mt-1 space-y-0.5 text-sm">
              {hours.map((h) => (
                <li key={h.day} className="flex justify-between gap-2">
                  <span className="text-muted">{h.day}</span>
                  <span className={h.open ? "" : "text-stone-400"}>{h.text}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* Appel final */}
        <Reveal className="mt-12">
          <div className="hero-gradient relative overflow-hidden rounded-[2rem] p-8 text-center text-white sm:p-14">
            <div className="pattern-african absolute inset-0 opacity-50" />
            <div className="relative">
              <h2 className="text-3xl font-bold sm:text-4xl">Une petite faim pour ce soir ou demain ?</h2>
              <p className="mx-auto mt-3 max-w-xl text-white/85">Les places sont limitées à chaque créneau pour garantir des plats frais et faits maison. Réservez le vôtre !</p>
              <Link href="/menu" className="btn-shine group mt-7 inline-flex h-14 items-center gap-2 rounded-full bg-gold px-8 font-bold text-ink shadow-xl transition hover:scale-105">
                Voir la carte <ArrowRight className="size-5 transition group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
