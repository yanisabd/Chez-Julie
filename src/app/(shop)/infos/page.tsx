import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Store, Bike, Clock, CalendarX, HelpCircle } from "lucide-react";
import { db, schema } from "@/db";
import { getSettings } from "@/server/settings";
import { scheduleSummary } from "@/server/catalog";
import { formatPrice } from "@/lib/format";
import { formatDayNumeric, parisDay } from "@/lib/time";
import { gte } from "drizzle-orm";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Retrait & livraison" };

export default async function InfosPage() {
  const s = await getSettings();
  const zones = await db.select().from(schema.deliveryZones).where(eq(schema.deliveryZones.active, true));
  const closures = await db.select().from(schema.closures).where(gte(schema.closures.endDate, parisDay()));
  const hours = scheduleSummary(s);

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
    <div className="mx-auto max-w-4xl px-4 pt-8">
      <h1 className="text-3xl font-bold sm:text-4xl">Retrait & livraison</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {s.ordering.pickupEnabled && (
          <Card>
            <Store className="size-7 text-forest" />
            <h2 className="mt-2 text-xl font-semibold">Retrait sur place</h2>
            <p className="mt-1 font-medium">{s.business.pickupAddress}</p>
            <p className="mt-1 text-muted">{s.business.pickupInstructions}</p>
            <p className="mt-2 text-sm text-muted">Gratuit. Présentez-vous pendant votre créneau avec votre numéro de commande.</p>
          </Card>
        )}
        {s.ordering.deliveryEnabled && (
          <Card>
            <Bike className="size-7 text-forest" />
            <h2 className="mt-2 text-xl font-semibold">Livraison à domicile</h2>
            <div className="mt-2 space-y-3">
              {zones.map((z) => (
                <div key={z.id} className="rounded-xl bg-sand p-3 text-[15px]">
                  <div className="font-semibold">{z.name}</div>
                  <div className="text-muted">Codes postaux : {z.postalCodes.join(", ")}{z.cities.length ? ` (${z.cities.join(", ")})` : ""}</div>
                  <div>
                    Frais : <b>{z.feeCents ? formatPrice(z.feeCents) : "offerts"}</b>
                    {z.minOrderCents > 0 && <> · minimum {formatPrice(z.minOrderCents)}</>}
                    {z.freeAboveCents != null && <> · offerte dès {formatPrice(z.freeAboveCents)}</>}
                  </div>
                </div>
              ))}
              {zones.length === 0 && <p className="text-muted">Zones de livraison bientôt disponibles.</p>}
            </div>
          </Card>
        )}
        <Card>
          <Clock className="size-7 text-forest" />
          <h2 className="mt-2 text-xl font-semibold">Horaires de service</h2>
          <ul className="mt-2 space-y-1 text-[15px]">
            {hours.map((h) => (
              <li key={h.day} className="flex justify-between gap-2">
                <span className="text-muted">{h.day}</span>
                <span className={h.open ? "font-medium" : "text-stone-400"}>
                  {h.open
                    ? h.ranges.map((r) => `${r.start.replace(":", "h")}–${r.end.replace(":", "h")}${s.ordering.deliveryEnabled && s.ordering.pickupEnabled && !(r.pickup && r.delivery) ? (r.pickup ? " (retrait)" : " (livraison)") : ""}`).join(" · ")
                    : "Fermé"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        {closures.length > 0 && (
          <Card>
            <CalendarX className="size-7 text-terracotta" />
            <h2 className="mt-2 text-xl font-semibold">Fermetures exceptionnelles</h2>
            <ul className="mt-2 space-y-1 text-[15px]">
              {closures.map((c) => (
                <li key={c.id}>
                  {c.startDate === c.endDate ? `Le ${formatDayNumeric(c.startDate)}` : `Du ${formatDayNumeric(c.startDate)} au ${formatDayNumeric(c.endDate)}`}
                  {c.reason && <span className="text-muted"> – {c.reason}</span>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <h2 className="mt-12 flex items-center gap-2 text-2xl font-bold">
        <HelpCircle className="size-6" /> Questions fréquentes
      </h2>
      <div className="mt-4 space-y-2">
        {faq.map((f) => (
          <details key={f.q} className="group rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <summary className="cursor-pointer list-none text-lg font-semibold">{f.q}</summary>
            <p className="mt-2 text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
