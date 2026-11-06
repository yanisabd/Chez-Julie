import type { Metadata } from "next";
import Link from "next/link";
import { eq, gte } from "drizzle-orm";
import { Store, Bike, Clock, CalendarX, ChevronDown, MapPin, Phone, ArrowRight, Gift, ShoppingBag } from "lucide-react";
import { db, schema } from "@/db";
import { getSettings } from "@/server/settings";
import { scheduleSummary } from "@/server/catalog";
import { formatPrice, cn } from "@/lib/format";
import { formatDayNumeric, parisDay, isoWeekday } from "@/lib/time";
import { Reveal } from "@/components/reveal";
import { PageBanner, BannerChip, SectionTitle } from "@/components/page-banner";

export const metadata: Metadata = { title: "Retrait & livraison", description: "Horaires, retrait sur place, zones et frais de livraison, questions fréquentes." };

export default async function InfosPage() {
  const s = await getSettings();
  const zones = await db.select().from(schema.deliveryZones).where(eq(schema.deliveryZones.active, true));
  const closures = await db.select().from(schema.closures).where(gte(schema.closures.endDate, parisDay()));
  const hours = scheduleSummary(s);
  const todayIdx = isoWeekday(parisDay()) - 1;
  const both = s.ordering.pickupEnabled && s.ordering.deliveryEnabled;

  const faq = [
    { q: "Combien de temps à l’avance dois-je commander ?", a: `Au minimum ${s.ordering.minLeadHours} heures avant votre créneau, et jusqu’à ${s.ordering.maxAdvanceDays} jours à l’avance. Cela nous permet de cuisiner chaque plat frais, spécialement pour vous.` },
    { q: "Pourquoi certains créneaux sont « complets » ?", a: "Notre cuisine prépare un nombre limité de plats par créneau pour garantir la qualité. Quand un créneau est plein, il n’est plus proposé." },
    {
      q: "Puis-je annuler ma commande ?",
      a: s.ordering.allowCustomerCancel
        ? `Oui, gratuitement jusqu’à ${s.ordering.cancelDeadlineHours} h avant votre créneau, directement depuis le lien de suivi reçu par email. Vous êtes remboursé intégralement.`
        : `Contactez-nous au ${s.business.phone}.`,
    },
    { q: "Comment payer ?", a: "En ligne, par carte bancaire, Apple Pay ou Google Pay, via notre prestataire sécurisé. Nous ne voyons jamais vos données bancaires." },
    { q: "J’ai une allergie, que faire ?", a: "Les allergènes sont indiqués sur chaque plat. Précisez votre allergie dans le champ « Une demande pour la cuisine » au moment de commander, ou appelez-nous." },
  ];

  return (
    <div>
      <PageBanner eyebrow="Infos pratiques" title={both ? "Retrait & livraison" : s.ordering.deliveryEnabled ? "Livraison" : "Retrait sur place"} subtitle="Choisissez votre créneau au moment de commander : votre repas est prêt pile à l’heure.">
        <BannerChip>
          <Clock className="size-4 text-gold" /> Commande {s.ordering.minLeadHours} h à {s.ordering.maxAdvanceDays} j à l’avance
        </BannerChip>
        {s.business.phone && (
          <BannerChip>
            <Phone className="size-4 text-gold" /> {s.business.phone}
          </BannerChip>
        )}
      </PageBanner>

      <div className="mx-auto max-w-6xl px-4 pt-10">
        {/* Modes de réception */}
        <div className={cn("grid gap-5", both && "md:grid-cols-2")}>
          {s.ordering.pickupEnabled && (
            <Reveal className="h-full">
              <div className="group relative h-full overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="relative h-28 overflow-hidden bg-gradient-to-br from-forest to-[#2b6a4f]">
                  <div className="pattern-african absolute inset-0 opacity-70" />
                  <span className="absolute right-5 top-5 rounded-full bg-gold px-3 py-1 text-sm font-bold text-ink">Gratuit</span>
                </div>
                <div className="absolute left-6 top-20 z-10 grid size-16 place-items-center rounded-2xl bg-white text-forest shadow-lg ring-4 ring-white transition duration-500 group-hover:-rotate-6">
                  <Store className="size-8" />
                </div>
                <div className="p-6 pt-12">
                  <h2 className="text-2xl font-bold">Retrait sur place</h2>
                  {s.business.pickupAddress && (
                    <p className="mt-3 flex items-start gap-2 font-semibold">
                      <MapPin className="mt-0.5 size-5 shrink-0 text-terracotta" />
                      {s.business.pickupAddress}
                    </p>
                  )}
                  {s.business.pickupInstructions && <p className="mt-2 rounded-2xl bg-sand p-3 text-[15px] text-ink/80">{s.business.pickupInstructions}</p>}
                  <p className="mt-3 text-sm text-muted">Présentez-vous pendant votre créneau avec votre numéro de commande.</p>
                </div>
              </div>
            </Reveal>
          )}
          {s.ordering.deliveryEnabled && (
            <Reveal delay={120} className="h-full">
              <div className="group relative h-full overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="relative h-28 overflow-hidden bg-gradient-to-br from-terracotta-dark via-terracotta to-gold">
                  <div className="pattern-african absolute inset-0 opacity-70" />
                </div>
                <div className="absolute left-6 top-20 z-10 grid size-16 place-items-center rounded-2xl bg-white text-terracotta shadow-lg ring-4 ring-white transition duration-500 group-hover:rotate-6">
                  <Bike className="size-8" />
                </div>
                <div className="p-6 pt-12">
                  <h2 className="text-2xl font-bold">Livraison à domicile</h2>
                  <div className="mt-4 space-y-3">
                    {zones.map((z) => (
                      <div key={z.id} className="rounded-2xl bg-sand/70 p-4 ring-1 ring-sand-dark/60">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">{z.name}</span>
                          <span className="rounded-full bg-forest px-3 py-0.5 text-sm font-bold text-white">{z.feeCents ? formatPrice(z.feeCents) : "Offerte"}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {z.postalCodes.map((pc) => (
                            <span key={pc} className="rounded-lg bg-white px-2 py-0.5 text-sm font-semibold text-forest ring-1 ring-forest/15">
                              {pc}
                            </span>
                          ))}
                          {z.cities.length > 0 && <span className="text-sm text-muted">({z.cities.join(", ")})</span>}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                          {z.minOrderCents > 0 && (
                            <span className="flex items-center gap-1">
                              <ShoppingBag className="size-3.5" /> Minimum {formatPrice(z.minOrderCents)}
                            </span>
                          )}
                          {z.freeAboveCents != null && (
                            <span className="flex items-center gap-1 font-semibold text-terracotta-dark">
                              <Gift className="size-3.5" /> Offerte dès {formatPrice(z.freeAboveCents)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {zones.length === 0 && <p className="text-muted">Zones de livraison bientôt disponibles.</p>}
                  </div>
                </div>
              </div>
            </Reveal>
          )}
        </div>

        {/* Horaires + fermetures */}
        <div className={cn("mt-12 grid gap-5", closures.length > 0 && "lg:grid-cols-[1.4fr_1fr]")}>
          <Reveal>
            <SectionTitle title="Horaires de service" />
            <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-black/5">
              {hours.map((h, i) => (
                <div
                  key={h.day}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 border-b border-sand px-5 py-3.5 last:border-0",
                    i === todayIdx && "bg-gradient-to-r from-gold-light to-transparent",
                  )}
                >
                  <span className="flex items-center gap-3 font-semibold">
                    <span className={cn("size-2.5 rounded-full", h.open ? "bg-emerald-500" : "bg-stone-300")} />
                    {h.day}
                    {i === todayIdx && <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-ink">Aujourd’hui</span>}
                  </span>
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {h.open ? (
                      h.ranges.map((r) => (
                        <span key={r.start} className="rounded-full bg-forest-light px-3 py-1 text-sm font-semibold text-forest">
                          {r.start.replace(":", "h")} – {r.end.replace(":", "h")}
                          {both && !(r.pickup && r.delivery) && <span className="font-normal text-forest/70"> · {r.pickup ? "retrait" : "livraison"}</span>}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-stone-400">Fermé</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
          {closures.length > 0 && (
            <Reveal delay={120}>
              <SectionTitle title="Fermetures" />
              <div className="space-y-3">
                {closures.map((c) => (
                  <div key={c.id} className="flex gap-4 rounded-[1.5rem] bg-terracotta-light/60 p-5 ring-1 ring-terracotta/20">
                    <CalendarX className="size-7 shrink-0 text-terracotta" />
                    <div>
                      <div className="font-semibold">{c.startDate === c.endDate ? `Le ${formatDayNumeric(c.startDate)}` : `Du ${formatDayNumeric(c.startDate)} au ${formatDayNumeric(c.endDate)}`}</div>
                      {c.reason && <div className="text-[15px] text-ink/70">{c.reason}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          )}
        </div>

        {/* FAQ */}
        <div className="mt-12">
          <Reveal>
            <SectionTitle title="Questions fréquentes" />
          </Reveal>
          <div className="space-y-3">
            {faq.map((f, i) => (
              <Reveal key={f.q} delay={i * 60}>
                <details className="group rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition open:shadow-md open:ring-terracotta/30">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sand text-terracotta transition duration-300 group-open:rotate-180 group-open:bg-terracotta group-open:text-white">
                      <ChevronDown className="size-5" />
                    </span>
                  </summary>
                  <p className="px-5 pb-5 text-muted">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Appel final */}
        <Reveal className="mt-12">
          <div className="hero-gradient relative overflow-hidden rounded-[2rem] p-8 text-center text-white sm:p-12">
            <div className="pattern-african absolute inset-0 opacity-50" />
            <div className="relative">
              <h2 className="text-3xl font-bold">Prêt à vous régaler ?</h2>
              <p className="mx-auto mt-2 max-w-lg text-white/85">Choisissez vos plats et réservez votre créneau en quelques clics.</p>
              <Link href="/menu" className="btn-shine group mt-6 inline-flex h-14 items-center gap-2 rounded-full bg-gold px-8 font-bold text-ink shadow-xl transition hover:scale-105">
                Voir la carte <ArrowRight className="size-5 transition group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
