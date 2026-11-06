"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Copy } from "lucide-react";
import type { DaySchedule } from "@/lib/settings-schema";
import { WEEKDAYS } from "@/lib/time";
import { cn } from "@/lib/format";
import { btnClass } from "@/components/ui";
import { useToast } from "@/components/toast";
import { saveSchedule } from "../actions/planning";

export function ScheduleEditor({ initial, deliveryEnabled, pickupEnabled }: { initial: DaySchedule[]; deliveryEnabled: boolean; pickupEnabled: boolean }) {
  const [days, setDays] = useState(initial);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const both = deliveryEnabled && pickupEnabled;

  const upd = (i: number, d: Partial<DaySchedule>) => {
    setDirty(true);
    setDays((x) => x.map((y, j) => (j === i ? { ...y, ...d } : y)));
  };

  return (
    <div>
      <div className="space-y-2">
        {days.map((d, i) => (
          <div key={i} className={cn("rounded-2xl p-3 ring-1", d.open ? "bg-white ring-black/5" : "bg-stone-50 ring-stone-200")}>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex w-36 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={d.open}
                  onChange={(e) => upd(i, { open: e.target.checked, ranges: e.target.checked && !d.ranges.length ? [{ start: "18:00", end: "21:00", pickup: true, delivery: true }] : d.ranges })}
                  className="size-5 accent-forest"
                />
                <span className="font-semibold">{WEEKDAYS[i]}</span>
              </label>
              {!d.open && <span className="text-muted">Fermé</span>}
              {d.open && (
                <div className="flex flex-1 flex-col gap-2">
                  {d.ranges.map((r, ri) => (
                    <div key={ri} className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={r.start}
                        step={900}
                        onChange={(e) => upd(i, { ranges: d.ranges.map((x, k) => (k === ri ? { ...x, start: e.target.value } : x)) })}
                        className="h-11 rounded-xl px-2 ring-1 ring-sand-dark"
                        aria-label="Début"
                      />
                      <span>à</span>
                      <input
                        type="time"
                        value={r.end}
                        step={900}
                        onChange={(e) => upd(i, { ranges: d.ranges.map((x, k) => (k === ri ? { ...x, end: e.target.value } : x)) })}
                        className="h-11 rounded-xl px-2 ring-1 ring-sand-dark"
                        aria-label="Fin"
                      />
                      {both && (
                        <>
                          <label className="flex items-center gap-1.5 text-sm">
                            <input type="checkbox" checked={r.pickup} onChange={(e) => upd(i, { ranges: d.ranges.map((x, k) => (k === ri ? { ...x, pickup: e.target.checked } : x)) })} className="size-4 accent-forest" />
                            Retrait
                          </label>
                          <label className="flex items-center gap-1.5 text-sm">
                            <input type="checkbox" checked={r.delivery} onChange={(e) => upd(i, { ranges: d.ranges.map((x, k) => (k === ri ? { ...x, delivery: e.target.checked } : x)) })} className="size-4 accent-forest" />
                            Livraison
                          </label>
                        </>
                      )}
                      <button type="button" onClick={() => upd(i, { ranges: d.ranges.filter((_, k) => k !== ri), open: d.ranges.length > 1 })} className="grid size-9 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-700" aria-label="Retirer cette plage">
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-3">
                    <button type="button" onClick={() => upd(i, { ranges: [...d.ranges, { start: "12:00", end: "14:00", pickup: true, delivery: true }] })} className="flex items-center gap-1 text-sm font-semibold text-terracotta">
                      <Plus className="size-4" /> Ajouter une plage (ex. midi)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDirty(true);
                        setDays((x) => x.map((y) => (y.open ? { ...y, ranges: d.ranges.map((r) => ({ ...r })) } : y)));
                      }}
                      className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
                    >
                      <Copy className="size-4" /> Copier sur les autres jours ouverts
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        disabled={pending || !dirty}
        onClick={() =>
          start(async () => {
            const r = await saveSchedule(JSON.stringify(days));
            if (r.ok) {
              toast("success", r.message ?? "Enregistré");
              setDirty(false);
              router.refresh();
            } else toast("error", r.error);
          })
        }
        className={btnClass("secondary", "lg", "mt-4")}
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {dirty ? "Enregistrer les horaires" : "Horaires enregistrés"}
      </button>
    </div>
  );
}
