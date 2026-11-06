import Link from "next/link";
import { AlertOctagon } from "lucide-react";
import { getSettings } from "@/server/settings";
import { getKitchenOrders } from "@/server/kitchen";
import { parisDay, relativeDayLabel, formatHour } from "@/lib/time";
import { DayPicker } from "@/components/day-picker";
import { AutoRefresh } from "@/components/auto-refresh";
import { cn } from "@/lib/format";
import { KitchenCard, NewOrderAlarm } from "./kitchen-card";

const TABS = [
  { k: "a-faire", label: "À faire", statuses: ["new", "accepted", "preparing"] },
  { k: "pretes", label: "Prêtes / en livraison", statuses: ["ready", "out_for_delivery"] },
  { k: "terminees", label: "Terminées", statuses: ["completed"] },
] as const;

export default async function KitchenBoard({ searchParams }: { searchParams: Promise<{ jour?: string; vue?: string }> }) {
  const sp = await searchParams;
  const day = sp.jour && /^\d{4}-\d{2}-\d{2}$/.test(sp.jour) ? sp.jour : parisDay();
  const tab = TABS.find((t) => t.k === sp.vue) ?? TABS[0];
  const s = await getSettings();
  const { orders, cancelled } = await getKitchenOrders(day, s.ordering.prepMinutes);
  const visible = orders.filter((o) => (tab.statuses as readonly string[]).includes(o.status));
  const count = (t: (typeof TABS)[number]) => orders.filter((o) => (t.statuses as readonly string[]).includes(o.status)).length;

  return (
    <div>
      <AutoRefresh seconds={20} />
      <NewOrderAlarm ids={orders.filter((o) => o.status === "new" || o.status === "accepted").map((o) => o.id)} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-3xl font-bold">{relativeDayLabel(day)}</h1>
        <DayPicker day={day} basePath="/cuisine" extra={{ vue: tab.k }} />
      </div>

      {cancelled.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-red-600 p-4 text-lg text-white">
          <AlertOctagon className="mt-0.5 size-7 shrink-0" />
          <div>
            <b>Commandes annulées – NE PAS préparer :</b>{" "}
            {cancelled.map((c) => `n°${c.number} (${formatHour(new Date(c.slotStart))})`).join(", ")}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.k}
            href={`/cuisine?jour=${day}&vue=${t.k}`}
            className={cn("flex h-14 shrink-0 items-center gap-2 rounded-2xl px-5 text-lg font-bold ring-1", t.k === tab.k ? "bg-terracotta text-white ring-terracotta" : "bg-white ring-black/10")}
          >
            {t.label}
            <span className={cn("grid min-w-8 place-items-center rounded-full px-2 text-base", t.k === tab.k ? "bg-white/25" : "bg-stone-100")}>{count(t)}</span>
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mt-10 rounded-3xl border-4 border-dashed border-stone-300 p-12 text-center text-2xl font-semibold text-stone-500">
          {tab.k === "a-faire" ? "Rien à préparer pour l’instant 👍" : "Aucune commande ici"}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((o) => (
            <KitchenCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}
