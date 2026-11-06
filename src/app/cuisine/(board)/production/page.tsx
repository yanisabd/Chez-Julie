import { getProduction } from "@/server/kitchen";
import { parisDay, relativeDayLabel, formatHour } from "@/lib/time";
import { DayPicker } from "@/components/day-picker";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ jour?: string }> }) {
  const sp = await searchParams;
  const day = sp.jour && /^\d{4}-\d{2}-\d{2}$/.test(sp.jour) ? sp.jour : parisDay();
  const p = await getProduction(day);
  return (
    <div>
      <AutoRefresh seconds={30} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quantités à préparer</h1>
          <p className="text-lg text-stone-600">
            {relativeDayLabel(day)} · {p.orderCount} commande{p.orderCount > 1 ? "s" : ""}
          </p>
        </div>
        <DayPicker day={day} basePath="/cuisine/production" />
      </div>
      {p.lines.length === 0 ? (
        <div className="mt-10 rounded-3xl border-4 border-dashed border-stone-300 p-12 text-center text-2xl font-semibold text-stone-500">Aucune commande ce jour-là</div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {p.lines.map((l) => (
              <div key={l.name} className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xl font-bold leading-tight">{l.name}</div>
                  <div className="text-right">
                    <div className="text-4xl font-black">{l.total}</div>
                    <div className="text-sm font-semibold text-stone-500">au total</div>
                  </div>
                </div>
                {l.todo > 0 && <div className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900">{l.todo} pas encore commencé{l.todo > 1 ? "s" : ""}</div>}
                {l.options.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-base">
                    {l.options.map(([name, n]) => (
                      <li key={name} className="flex justify-between">
                        <span className="text-stone-600">{name}</span>
                        <b>{n}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <h2 className="mt-10 text-2xl font-bold">Par créneau</h2>
          <div className="mt-3 overflow-x-auto rounded-3xl bg-white shadow-sm">
            <table className="w-full text-lg">
              <thead>
                <tr className="text-left text-stone-500">
                  <th className="p-4">Plat</th>
                  {p.slots.map((s) => (
                    <th key={s} className="p-4 text-center">
                      {formatHour(new Date(s))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.lines.map((l) => (
                  <tr key={l.name} className="border-t border-stone-100">
                    <td className="p-4 font-semibold">{l.name}</td>
                    {p.slots.map((s) => (
                      <td key={s} className="p-4 text-center font-bold">
                        {l.bySlot[s] ?? <span className="text-stone-300">–</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
