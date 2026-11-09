import Link from "next/link";
import { AlertTriangle, ArrowRight, Boxes, CalendarClock, MailWarning, Bug, FlaskConical, Trophy } from "lucide-react";
import { dashboardStats } from "@/server/stats";
import { getSettings } from "@/server/settings";
import { stripeEnabled } from "@/server/payments";
import { emailsEnabled, smsEnabled } from "@/server/notifications";
import { isEmbeddedDb } from "@/db";
import { formatPrice, formatQty } from "@/lib/format";
import { formatHour, relativeDayLabel, formatDateTime, parisDay, parisTime } from "@/lib/time";
import { Card, PageHeader, Stat, Notice } from "@/components/ui";
import { AutoRefresh } from "@/components/auto-refresh";
import { resolveIssueAction } from "./actions/orders";
import { ActionButton } from "@/components/action";

export default async function Dashboard() {
  const [st, s] = await Promise.all([dashboardStats(), getSettings()]);
  const nearlyFull = st.fullSlots.filter((x) => {
    const mo = x.max_orders ?? s.ordering.defaultMaxOrdersPerSlot;
    const mi = x.max_items ?? s.ordering.defaultMaxItemsPerSlot;
    return x.booked_orders / mo >= 0.75 || x.booked_items / mi >= 0.75;
  });
  const demo = !stripeEnabled() || !emailsEnabled() || !smsEnabled() || isEmbeddedDb();
  const hour = Number(parisTime(new Date()).slice(0, 2));

  return (
    <div>
      <AutoRefresh seconds={60} />
      <PageHeader title={`${hour >= 5 && hour < 18 ? "Bonjour" : "Bonsoir"} 👋`} subtitle="Voici votre activité du jour." />

      {demo && (
        <Notice tone="warn" className="mb-6">
          <div className="flex items-start gap-2">
            <FlaskConical className="mt-0.5 size-4 shrink-0" />
            <div>
              <b>Mode démonstration actif :</b>{" "}
              {[!stripeEnabled() && "paiements simulés", !emailsEnabled() && "emails non envoyés", !smsEnabled() && "SMS non envoyés (visibles dans « Emails & SMS »)", isEmbeddedDb() && "base de données locale"].filter(Boolean).join(", ")}. Voir le guide de mise en ligne
              (README) pour passer en production.
            </div>
          </div>
        </Notice>
      )}

      {/* Actions requises */}
      {(st.counts.new > 0 || st.issues.length > 0 || st.failedEmails > 0 || st.errors > 0) && (
        <div className="mb-6 space-y-2">
          {st.counts.new > 0 && (
            <Link href="/admin/commandes?statut=new" className="flex items-center gap-3 rounded-2xl bg-sky-600 p-4 text-white shadow-sm hover:bg-sky-700">
              <AlertTriangle className="size-6" />
              <span className="flex-1 text-lg font-semibold">
                {st.counts.new} commande{st.counts.new > 1 ? "s" : ""} à valider
              </span>
              <ArrowRight />
            </Link>
          )}
          {st.issues.map((i) => (
            <div key={i.id} className="flex flex-col gap-3 rounded-2xl bg-amber-100 p-4 ring-1 ring-amber-300 sm:flex-row sm:items-center">
              <AlertTriangle className="size-6 shrink-0 text-amber-700" />
              <div className="flex-1">
                <div className="font-semibold">
                  Problème signalé sur la commande <Link href={`/admin/commandes/${i.order_id}`} className="underline">n°{i.number}</Link>
                </div>
                <div className="text-[15px]">
                  {i.message} — <span className="text-muted">{i.actor_label}, {formatDateTime(new Date(i.created_at))}</span>
                </div>
              </div>
              <ActionButton action={resolveIssueAction.bind(null, i.id)} size="sm" success="Marqué comme réglé">
                C’est réglé
              </ActionButton>
            </div>
          ))}
          {st.failedEmails > 0 && (
            <Link href="/admin/emails?statut=failed" className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-red-900 ring-1 ring-red-200">
              <MailWarning className="size-6" />
              <span className="flex-1 font-semibold">{st.failedEmails} message(s) (email ou SMS) n’ont pas pu être envoyés</span>
              <ArrowRight />
            </Link>
          )}
          {st.errors > 0 && (
            <Link href="/admin/journal?vue=erreurs" className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-red-900 ring-1 ring-red-200">
              <Bug className="size-6" />
              <span className="flex-1 font-semibold">{st.errors} erreur(s) technique(s) à consulter</span>
              <ArrowRight />
            </Link>
          )}
        </div>
      )}

      <h2 className="mb-3 font-sans text-lg font-bold">Commandes du jour</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total" value={st.counts.total} />
        <Stat label="À valider" value={st.counts.new} tone={st.counts.new ? "warn" : undefined} />
        <Stat label="À préparer" value={st.counts.accepted} />
        <Stat label="En préparation" value={st.counts.preparing} />
        <Stat label="Prêtes / livraison" value={st.counts.ready} />
        <Stat label="Terminées" value={st.counts.completed} sub={st.counts.cancelled ? `${st.counts.cancelled} annulée(s)` : undefined} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Stat label="Chiffre d’affaires encaissé aujourd’hui" value={formatPrice(st.revenue.today)} sub={`${st.revenue.orders_today} paiement(s)`} />
        <Stat label="Chiffre d’affaires du mois" value={formatPrice(st.revenue.month)} sub={<Link href="/admin/statistiques" className="underline">Voir les statistiques</Link>} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="flex items-center gap-2 font-sans font-bold">
            <Trophy className="size-5 text-gold" /> Plats les plus vendus (30 j)
          </h3>
          {st.top.length ? (
            <ol className="mt-3 space-y-2">
              {st.top.map((t, i) => (
                <li key={t.name} className="flex justify-between gap-2 text-[15px]">
                  <span>
                    <b className="mr-2 text-muted">{i + 1}.</b>
                    {t.name}
                  </span>
                  <b>{t.qty}</b>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-muted">Pas encore de ventes.</p>
          )}
        </Card>
        <Card>
          <h3 className="flex items-center gap-2 font-sans font-bold">
            <Boxes className="size-5 text-terracotta" /> Alertes de stock
          </h3>
          {st.lowProducts.length + st.lowIngredients.length === 0 ? (
            <p className="mt-3 text-muted">Tout va bien ✓</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-[15px]">
              {st.lowProducts.map((p) => (
                <li key={`p${p.id}`} className="flex justify-between gap-2">
                  <span>{p.name}</span>
                  <b className={p.left <= 0 ? "text-red-700" : "text-amber-700"}>{p.left <= 0 ? "Épuisé" : `${p.left} restant(s)`}</b>
                </li>
              ))}
              {st.lowIngredients.map((p) => (
                <li key={`i${p.id}`} className="flex justify-between gap-2">
                  <span>{p.name} <span className="text-xs text-muted">(ingrédient)</span></span>
                  <b className={p.left <= 0 ? "text-red-700" : "text-amber-700"}>{formatQty(p.left, p.unit)}</b>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/stocks" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-terracotta">
            Gérer les stocks <ArrowRight className="size-4" />
          </Link>
        </Card>
        <Card>
          <h3 className="flex items-center gap-2 font-sans font-bold">
            <CalendarClock className="size-5 text-forest" /> Créneaux presque complets
          </h3>
          {nearlyFull.length === 0 ? (
            <p className="mt-3 text-muted">Aucun créneau saturé dans les 3 prochains jours.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-[15px]">
              {nearlyFull.slice(0, 8).map((x) => {
                const d = new Date(x.starts_at);
                const mo = x.max_orders ?? s.ordering.defaultMaxOrdersPerSlot;
                return (
                  <li key={x.starts_at} className="flex justify-between gap-2">
                    <span>
                      {relativeDayLabel(parisDay(d))} {formatHour(d)}
                    </span>
                    <b className={x.booked_orders >= mo ? "text-red-700" : "text-amber-700"}>
                      {x.booked_orders}/{mo} {x.booked_orders >= mo ? "· complet" : ""}
                    </b>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/admin/planning" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-terracotta">
            Gérer les créneaux <ArrowRight className="size-4" />
          </Link>
        </Card>
      </div>
    </div>
  );
}
