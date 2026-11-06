import Link from "next/link";
import { addDays, parisDay, formatDayShort } from "@/lib/time";
import { cn } from "@/lib/format";

/** Sélecteur de jour simple : Hier / Aujourd'hui / Demain / Après-demain + calendrier. */
export function DayPicker({ day, basePath, extra = {} }: { day: string; basePath: string; extra?: Record<string, string> }) {
  const today = parisDay();
  const opts = [
    { d: addDays(today, -1), label: "Hier" },
    { d: today, label: "Aujourd’hui" },
    { d: addDays(today, 1), label: "Demain" },
    { d: addDays(today, 2), label: formatDayShort(addDays(today, 2)) },
  ];
  const href = (d: string) => `${basePath}?${new URLSearchParams({ ...extra, jour: d }).toString()}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {opts.map((o) => (
        <Link
          key={o.d}
          href={href(o.d)}
          className={cn(
            "flex h-12 items-center rounded-xl px-4 text-[16px] font-semibold ring-1 transition",
            o.d === day ? "bg-ink text-white ring-ink" : "bg-white text-ink ring-black/10 hover:bg-sand",
          )}
        >
          {o.label}
        </Link>
      ))}
      <form action={basePath} className="flex items-center gap-2">
        {Object.entries(extra).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="date" name="jour" defaultValue={day} className="h-12 rounded-xl bg-white px-3 text-[16px] ring-1 ring-black/10" aria-label="Choisir une date" />
        <button className="h-12 rounded-xl bg-white px-4 font-semibold ring-1 ring-black/10 hover:bg-sand">Voir</button>
      </form>
    </div>
  );
}
