import Link from "next/link";
import { salesStats } from "@/server/stats";
import { formatPrice, cn } from "@/lib/format";
import { parisDay, addDays, formatDayShort } from "@/lib/time";
import { PageHeader, Card, Stat, Table, Input, btnClass } from "@/components/ui";

export const metadata = { title: "Statistiques" };

const RANGES = [
  { k: "7", label: "7 jours" },
  { k: "30", label: "30 jours" },
  { k: "90", label: "3 mois" },
  { k: "365", label: "12 mois" },
];

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ p?: string; du?: string; au?: string }> }) {
  const sp = await searchParams;
  const today = parisDay();
  const custom = sp.du && sp.au && /^\d{4}-\d{2}-\d{2}$/.test(sp.du) && /^\d{4}-\d{2}-\d{2}$/.test(sp.au) && sp.du <= sp.au;
  const period = RANGES.find((r) => r.k === sp.p)?.k ?? "30";
  const to = custom ? sp.au! : today;
  const from = custom ? sp.du! : addDays(today, -(Number(period) - 1));
  const st = await salesStats(from, to);
  const max = Math.max(1, ...st.daily.map((d) => d.revenue));
  const maxQty = Math.max(1, ...st.products.map((p) => p.qty));
  const totalModes = st.modes.reduce((n, m) => n + m.n, 0) || 1;
  const pickup = st.modes.find((m) => m.mode === "pickup")?.n ?? 0;
  const maxSlot = Math.max(1, ...st.slots.map((s) => s.n));
  // Au-delà de 60 jours, on regroupe par semaine pour garder des barres lisibles
  const weekly = st.daily.length > 60;
  const bars = weekly
    ? st.daily.reduce<{ label: string; revenue: number; orders: number }[]>((acc, d, i) => {
        if (i % 7 === 0) acc.push({ label: `Sem. du ${formatDayShort(d.day)}`, revenue: 0, orders: 0 });
        acc[acc.length - 1].revenue += d.revenue;
        acc[acc.length - 1].orders += d.orders;
        return acc;
      }, [])
    : st.daily.map((d) => ({ label: formatDayShort(d.day), revenue: d.revenue, orders: d.orders }));
  const barMax = Math.max(1, ...bars.map((b) => b.revenue));

  return (
    <div>
      <PageHeader title="Statistiques" subtitle="Chiffre d’affaires calculé sur les commandes payées (remboursements déduits), par jour de service." />
      <div className="mb-6 flex flex-wrap items-end gap-2">
        {RANGES.map((r) => (
          <Link key={r.k} href={`/admin/statistiques?p=${r.k}`} className={btnClass(!custom && r.k === period ? "secondary" : "outline", "sm")}>
            {r.label}
          </Link>
        ))}
        <form className="flex flex-wrap items-end gap-2">
          <Input type="date" name="du" defaultValue={from} className="h-9 w-40 py-1" aria-label="Du" />
          <Input type="date" name="au" defaultValue={to} className="h-9 w-40 py-1" aria-label="Au" />
          <button className={btnClass("outline", "sm")}>OK</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Chiffre d’affaires" value={formatPrice(st.totalRevenue)} />
        <Stat label="Commandes" value={st.totalOrders} />
        <Stat label="Panier moyen" value={formatPrice(st.avgBasket)} />
        <Stat label="Clients fidèles" value={`${st.customers.returning} / ${st.customers.n}`} sub="ont commandé plusieurs fois" />
      </div>

      <Card className="mt-4">
        <h2 className="font-sans text-lg font-bold">Chiffre d’affaires {weekly ? "par semaine" : "par jour"}</h2>
        <div className="mt-4 flex h-56 items-end gap-[2px]" role="img" aria-label="Graphique du chiffre d’affaires, détail dans le tableau ci-dessous">
          {bars.map((b, i) => (
            <div key={i} className="group relative flex h-full flex-1 items-end">
              <div className="w-full rounded-t-[4px] bg-forest transition group-hover:bg-terracotta" style={{ height: `${Math.max(b.revenue ? 2 : 0, (b.revenue / barMax) * 100)}%` }} />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block">
                <div className="font-semibold">{b.label}</div>
                <div>{formatPrice(b.revenue)} · {b.orders} cmd</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between border-t border-stone-200 pt-1 text-xs text-muted">
          <span>{bars[0]?.label}</span>
          <span>max {formatPrice(barMax)}</span>
          <span>{bars[bars.length - 1]?.label}</span>
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-terracotta">Voir le détail jour par jour</summary>
          <div className="mt-2 max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {st.daily.filter((d) => d.orders > 0).map((d) => (
                  <tr key={d.day} className="border-t border-sand">
                    <td className="py-1.5">{formatDayShort(d.day)}</td>
                    <td className="py-1.5 text-right">{d.orders} cmd</td>
                    <td className="py-1.5 text-right font-semibold">{formatPrice(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        {max === 1 && <p className="mt-2 text-sm text-muted">Aucune vente sur la période.</p>}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-sans text-lg font-bold">Plats vendus</h2>
          <ul className="mt-3 space-y-2.5">
            {st.products.map((p) => (
              <li key={p.name}>
                <div className="flex justify-between gap-2 text-[15px]">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0">
                    <b>{p.qty}</b> <span className="text-muted">· {formatPrice(p.revenue)}</span>
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-terracotta" style={{ width: `${(p.qty / maxQty) * 100}%` }} />
                </div>
              </li>
            ))}
            {st.products.length === 0 && <li className="text-muted">Aucune vente.</li>}
          </ul>
        </Card>
        <div className="space-y-4">
          <Card>
            <h2 className="font-sans text-lg font-bold">Retrait / livraison</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-sand p-3">
                <div className="text-2xl font-bold">{Math.round((pickup / totalModes) * 100)} %</div>
                <div className="text-sm text-muted">Retrait ({pickup})</div>
              </div>
              <div className="rounded-xl bg-sand p-3">
                <div className="text-2xl font-bold">{Math.round(((totalModes - pickup) / totalModes) * 100)} %</div>
                <div className="text-sm text-muted">Livraison ({st.totalOrders - pickup})</div>
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="font-sans text-lg font-bold">Heures les plus demandées</h2>
            <ul className="mt-3 space-y-1.5">
              {st.slots.map((s) => (
                <li key={s.hour} className="flex items-center gap-3 text-sm">
                  <span className="w-12 font-semibold">{s.hour}</span>
                  <div className="h-2 flex-1 rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-forest" style={{ width: `${(s.n / maxSlot) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right">{s.n}</span>
                </li>
              ))}
              {st.slots.length === 0 && <li className="text-muted">Aucune donnée.</li>}
            </ul>
          </Card>
          <Card>
            <h2 className="font-sans text-lg font-bold">Annulations</h2>
            <p className={cn("mt-2 text-[15px]")}>
              {st.cancel.cancelled} commande(s) payée(s) annulée(s) · {formatPrice(st.cancel.refunded)} remboursé(s)
            </p>
          </Card>
        </div>
      </div>
      <div className="mt-4">
        <Table>
          <thead>
            <tr>
              <th>Plat</th>
              <th className="text-right">Quantité</th>
              <th className="text-right">Chiffre d’affaires</th>
            </tr>
          </thead>
          <tbody>
            {st.products.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td className="text-right">{p.qty}</td>
                <td className="text-right">{formatPrice(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
