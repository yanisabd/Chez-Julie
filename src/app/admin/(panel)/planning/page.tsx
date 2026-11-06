import Link from "next/link";
import { asc, gte } from "drizzle-orm";
import { PauseCircle, PlayCircle, Lock, LockOpen, Trash2, Sparkles } from "lucide-react";
import { db, schema } from "@/db";
import { getSettings } from "@/server/settings";
import { buildDay } from "@/server/slots";
import { addDays, parisDay, formatDayShort, relativeDayLabel, formatDayNumeric } from "@/lib/time";
import { cn } from "@/lib/format";
import { PageHeader, Help, Card, Field, Input, Check, Notice } from "@/components/ui";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action";
import { togglePause, saveRules, setSlotBlocked, setSlotCapacity, openExtraSlot, removeExtraSlot, addClosure, deleteClosure } from "../actions/planning";
import { ScheduleEditor } from "./schedule-editor";

export const metadata = { title: "Horaires & créneaux" };

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ jour?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const today = parisDay();
  const day = sp.jour && /^\d{4}-\d{2}-\d{2}$/.test(sp.jour) ? sp.jour : today;
  const view = await buildDay(s, day, { itemsCount: 1 });
  const closures = await db.select().from(schema.closures).where(gte(schema.closures.endDate, today)).orderBy(asc(schema.closures.startDate));
  const next14 = Array.from({ length: 15 }, (_, i) => addDays(today, i));
  const o = s.ordering;

  return (
    <div>
      <PageHeader title="Horaires & créneaux" subtitle="Quand les clients peuvent-ils commander, et combien de commandes pouvez-vous préparer ?" />

      {/* Pause */}
      <Card className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-center", o.paused ? "bg-red-50 ring-2 ring-red-300" : "")}>
        <div className="flex-1">
          <div className="text-lg font-bold">{o.paused ? "⏸ Les commandes sont en pause" : "✅ Les commandes sont ouvertes"}</div>
          <p className="text-[15px] text-muted">
            {o.paused ? "Les clients voient le site mais ne peuvent pas commander. Les commandes déjà passées ne sont pas touchées." : "En cas d’imprévu (maladie, rupture…), mettez en pause en un clic."}
          </p>
        </div>
        <ActionButton action={togglePause} variant={o.paused ? "secondary" : "danger"} size="lg" confirm={o.paused ? undefined : "Mettre les commandes en pause ? Plus aucun client ne pourra commander."}>
          {o.paused ? <PlayCircle className="size-5" /> : <PauseCircle className="size-5" />}
          {o.paused ? "Rouvrir les commandes" : "Mettre en pause"}
        </ActionButton>
      </Card>

      {/* Créneaux du jour */}
      <h2 className="mb-3 font-sans text-xl font-bold">Créneaux jour par jour</h2>
      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {next14.map((d) => (
          <Link
            key={d}
            href={`/admin/planning?jour=${d}`}
            className={cn("shrink-0 rounded-xl px-3 py-2 text-center text-sm font-semibold ring-1", d === day ? "bg-forest text-white ring-forest" : "bg-white ring-black/10 hover:bg-sand")}
          >
            {d === today ? "Aujourd’hui" : formatDayShort(d)}
          </Link>
        ))}
      </div>
      <Card className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-sans text-lg font-bold">{relativeDayLabel(day)}</h3>
          {view.closedReason && <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-600">{view.closedReason}</span>}
        </div>
        {view.slots.length === 0 ? (
          <p className="text-muted">Aucun créneau ce jour-là. Vous pouvez en ouvrir un exceptionnellement ci-dessous.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {view.slots.map((sl) => {
              const full = sl.bookedOrders >= sl.maxOrders || sl.bookedItems >= sl.maxItems;
              const pct = Math.min(100, Math.round((sl.bookedOrders / sl.maxOrders) * 100));
              return (
                <div key={sl.key} className={cn("rounded-2xl p-3 ring-1", sl.blocked ? "bg-stone-100 ring-stone-200" : full ? "bg-red-50 ring-red-200" : "bg-white ring-black/10", sl.state === "past" && "opacity-50")}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{sl.label}</span>
                    <span className="text-xs font-semibold text-muted">
                      {sl.forcedOpen && !sl.scheduled && <Sparkles className="mr-1 inline size-3" />}
                      {sl.modes.length === 2 ? "Retrait + livraison" : sl.modes[0] === "pickup" ? "Retrait" : "Livraison"}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                    <div className={cn("h-full rounded-full", full ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-forest")} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {sl.bookedOrders}/{sl.maxOrders} commandes · {sl.bookedItems}/{sl.maxItems} plats {sl.blocked ? "· fermé" : full ? "· complet" : ""}
                  </div>
                  {sl.state !== "past" && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <ActionButton action={setSlotBlocked.bind(null, sl.key, !sl.blocked)} size="sm" variant={sl.blocked ? "secondary" : "outline"}>
                        {sl.blocked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
                        {sl.blocked ? "Rouvrir" : "Fermer"}
                      </ActionButton>
                      <details className="relative">
                        <summary className="flex h-9 cursor-pointer list-none items-center rounded-full px-3 text-sm font-semibold ring-1 ring-sand-dark hover:bg-sand">Capacité</summary>
                        <Card className="absolute left-0 z-20 mt-1 w-64">
                          <ActionForm action={setSlotCapacity.bind(null, sl.key)} className="space-y-2">
                            <Field label="Commandes max">
                              <Input name="maxOrders" type="number" min={1} defaultValue={sl.maxOrders} />
                            </Field>
                            <Field label="Plats max">
                              <Input name="maxItems" type="number" min={1} defaultValue={sl.maxItems} />
                            </Field>
                            <SubmitButton size="sm">Enregistrer</SubmitButton>
                          </ActionForm>
                        </Card>
                      </details>
                      {sl.forcedOpen && !sl.scheduled && (
                        <ActionButton action={removeExtraSlot.bind(null, sl.key)} size="sm" variant="ghost">
                          <Trash2 className="size-4" />
                        </ActionButton>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-terracotta">+ Ouvrir un créneau exceptionnel ce jour-là</summary>
          <ActionForm action={openExtraSlot} className="mt-2 flex flex-wrap items-end gap-2">
            <input type="hidden" name="day" value={day} />
            <Field label="Heure de début">
              <Input type="time" name="time" step={900} required />
            </Field>
            <SubmitButton>Ouvrir</SubmitButton>
          </ActionForm>
        </details>
      </Card>

      {/* Horaires */}
      <h2 className="mb-3 font-sans text-xl font-bold">Horaires de la semaine</h2>
      <Help>
        Cochez les jours où vous cuisinez et indiquez les plages horaires. Elles sont découpées automatiquement en créneaux de {o.slotMinutes} minutes. Exemple : 18h00 à 21h00 = créneaux de 18h00, 18h30, 19h00…
      </Help>
      <ScheduleEditor initial={s.schedule} deliveryEnabled={o.deliveryEnabled} pickupEnabled={o.pickupEnabled} />

      {/* Fermetures */}
      <h2 className="mb-3 mt-10 font-sans text-xl font-bold">Jours de fermeture (vacances, jours fériés…)</h2>
      <Card>
        {closures.length > 0 && (
          <ul className="mb-4 divide-y divide-sand">
            {closures.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <b>{c.startDate === c.endDate ? formatDayNumeric(c.startDate) : `Du ${formatDayNumeric(c.startDate)} au ${formatDayNumeric(c.endDate)}`}</b>
                  {c.reason && <span className="text-muted"> – {c.reason}</span>}
                </span>
                <ActionButton action={deleteClosure.bind(null, c.id)} variant="ghost" size="sm" confirm="Supprimer cette fermeture ?">
                  <Trash2 className="size-4" />
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addClosure} reset className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
          <Field label="Du">
            <Input type="date" name="startDate" min={today} required />
          </Field>
          <Field label="Au (inclus)">
            <Input type="date" name="endDate" min={today} />
          </Field>
          <Field label="Motif (affiché aux clients)">
            <Input name="reason" placeholder="Congés d’été" />
          </Field>
          <SubmitButton>Ajouter</SubmitButton>
        </ActionForm>
      </Card>

      {/* Règles */}
      <h2 className="mb-3 mt-10 font-sans text-xl font-bold">Règles de commande</h2>
      <Card>
        <ActionForm action={saveRules} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Délai minimum (heures)" hint="Temps minimum entre la commande et le créneau.">
              <Input name="minLeadHours" type="number" min={0} step={0.5} defaultValue={o.minLeadHours} />
            </Field>
            <Field label="Commande jusqu’à (jours à l’avance)">
              <Input name="maxAdvanceDays" type="number" min={1} defaultValue={o.maxAdvanceDays} />
            </Field>
            <Field label="Durée d’un créneau (minutes)">
              <Input name="slotMinutes" type="number" min={10} step={5} defaultValue={o.slotMinutes} />
            </Field>
            <Field label="Commandes max par créneau">
              <Input name="defaultMaxOrdersPerSlot" type="number" min={1} defaultValue={o.defaultMaxOrdersPerSlot} />
            </Field>
            <Field label="Plats max par créneau">
              <Input name="defaultMaxItemsPerSlot" type="number" min={1} defaultValue={o.defaultMaxItemsPerSlot} />
            </Field>
            <Field label="Articles max par commande">
              <Input name="maxItemsPerOrder" type="number" min={1} defaultValue={o.maxItemsPerOrder} />
            </Field>
            <Field label="Commandes max par jour" hint="Vide = pas de limite.">
              <Input name="maxOrdersPerDay" type="number" min={1} defaultValue={o.maxOrdersPerDay ?? ""} />
            </Field>
            <Field label="Plats max par jour (capacité totale)" hint="Vide = pas de limite.">
              <Input name="maxItemsPerDay" type="number" min={1} defaultValue={o.maxItemsPerDay ?? ""} />
            </Field>
            <Field label="Temps de préparation (minutes)" hint="La cuisine voit « à commencer vers… ».">
              <Input name="prepMinutes" type="number" min={0} defaultValue={o.prepMinutes} />
            </Field>
            <Field label="Annulation possible jusqu’à (heures avant)">
              <Input name="cancelDeadlineHours" type="number" min={0} defaultValue={o.cancelDeadlineHours} />
            </Field>
            <Field label="Afficher « Plus que X » à partir de">
              <Input name="lowStockDisplay" type="number" min={0} defaultValue={o.lowStockDisplay} />
            </Field>
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            <Check name="autoAccept" defaultChecked={o.autoAccept} label="Accepter automatiquement les commandes payées" hint="Sinon, vous devez valider chaque commande à la main." />
            <Check name="allowCustomerCancel" defaultChecked={o.allowCustomerCancel} label="Le client peut annuler en ligne" hint="Avec remboursement automatique, avant le délai ci-dessus." />
          </div>
          <Field label="Message affiché pendant une pause">
            <Input name="pauseMessage" defaultValue={o.pauseMessage} />
          </Field>
          <SubmitButton size="lg">Enregistrer les règles</SubmitButton>
        </ActionForm>
      </Card>
      {o.minLeadHours < 6 && <Notice tone="warn" className="mt-3">Le cahier des charges recommande un délai minimum de 6 heures.</Notice>}
    </div>
  );
}
