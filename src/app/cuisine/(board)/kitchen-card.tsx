"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bike, Store, Undo2, AlertTriangle, Loader2, Clock, MessageSquareWarning, Bell, BellOff, X } from "lucide-react";
import type { KitchenOrder } from "@/server/kitchen";
import { STATUS, ISSUE_REASONS } from "@/lib/constants";
import { nextStatus, previousStatus, nextActionLabel } from "@/lib/status-flow";
import { formatHour } from "@/lib/time";
import { cn } from "@/lib/format";
import { useToast } from "@/components/toast";
import { setOrderStatus, kitchenReportIssue } from "../actions";

const ACTION_COLOR: Record<string, string> = {
  new: "bg-sky-600 hover:bg-sky-700",
  accepted: "bg-orange-500 hover:bg-orange-600",
  preparing: "bg-emerald-600 hover:bg-emerald-700",
  ready: "bg-violet-600 hover:bg-violet-700",
  out_for_delivery: "bg-stone-700 hover:bg-stone-800",
};

const BORDER: Record<string, string> = {
  new: "border-sky-500",
  accepted: "border-amber-400",
  preparing: "border-orange-500",
  ready: "border-emerald-500",
  out_for_delivery: "border-violet-500",
  completed: "border-stone-300",
};

export function KitchenCard({ order }: { order: KitchenOrder }) {
  const [pending, start] = useTransition();
  const [issueOpen, setIssueOpen] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const next = nextStatus(order);
  const prev = previousStatus(order);
  const label = nextActionLabel(order);
  const now = Date.now();
  const late = order.status === "accepted" && now > new Date(order.startBy).getTime();
  const overdue = ["accepted", "preparing", "ready"].includes(order.status) && now > new Date(order.slotEnd).getTime();
  const totalItems = order.items.reduce((n, i) => n + i.qty, 0);

  const move = (to: string, from = order.status) =>
    start(async () => {
      const r = await setOrderStatus(order.id, from, to as typeof order.status);
      if (!r.ok) toast("error", r.error);
      router.refresh();
    });

  return (
    <article className={cn("flex flex-col rounded-3xl border-l-[10px] bg-white p-5 shadow-sm", BORDER[order.status], order.status === "new" && "animate-new")}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="text-4xl font-black tracking-tight">n°{order.number}</div>
          <div className="mt-0.5 text-lg font-semibold text-stone-600">{order.customer}</div>
        </div>
        <div className="text-right">
          <div className={cn("inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-lg font-bold", order.mode === "delivery" ? "bg-violet-100 text-violet-900" : "bg-sky-100 text-sky-900")}>
            {order.mode === "delivery" ? <Bike className="size-5" /> : <Store className="size-5" />}
            {order.mode === "delivery" ? "Livraison" : "Retrait"}
          </div>
          <div className="mt-1 text-2xl font-black">{formatHour(new Date(order.slotStart))}</div>
          {order.city && <div className="text-sm text-stone-500">{order.city}</div>}
        </div>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-3 py-1 text-base font-bold ring-1 ring-inset", STATUS[order.status].color)}>{STATUS[order.status].label}</span>
        {order.status === "accepted" && (
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-base font-semibold", late ? "bg-red-600 text-white" : "bg-stone-100 text-stone-700")}>
            <Clock className="size-4" />
            {late ? "À commencer maintenant !" : `Commencer vers ${formatHour(new Date(order.startBy))}`}
          </span>
        )}
        {overdue && <span className="rounded-full bg-red-100 px-3 py-1 text-base font-semibold text-red-800">En retard</span>}
        {order.openIssues > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-base font-semibold text-amber-900">
            <AlertTriangle className="size-4" /> Problème signalé
          </span>
        )}
      </div>

      <ul className="mt-4 flex-1 space-y-2 border-t-2 border-dashed border-stone-200 pt-4">
        {order.items.map((it, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid h-10 min-w-10 place-items-center rounded-xl bg-ink px-2 text-xl font-black text-white">{it.qty}</span>
            <div className="pt-1">
              <div className="text-xl font-bold leading-tight">{it.name}</div>
              {it.options.length > 0 && <div className="text-base font-medium text-stone-600">{it.options.join(" · ")}</div>}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-right text-sm font-semibold text-stone-500">{totalItems} article{totalItems > 1 ? "s" : ""}</div>

      {order.kitchenNotes && (
        <div className="mt-3 flex gap-2 rounded-2xl bg-yellow-200 p-3 text-lg font-semibold text-yellow-950">
          <MessageSquareWarning className="mt-0.5 size-6 shrink-0" />
          {order.kitchenNotes}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {order.status === "new" ? (
          <div className="rounded-2xl bg-sky-50 p-3 text-center text-lg font-semibold text-sky-900">En attente de validation par le responsable</div>
        ) : (
          next &&
          label && (
            <button
              disabled={pending}
              onClick={() => move(next)}
              className={cn("flex h-20 w-full items-center justify-center gap-3 rounded-2xl text-2xl font-black text-white shadow-md transition active:scale-[.98] disabled:opacity-60", ACTION_COLOR[order.status])}
            >
              {pending && <Loader2 className="size-7 animate-spin" />}
              {label}
            </button>
          )
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={!prev || pending}
            onClick={() => prev && move(prev)}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-stone-100 text-base font-semibold text-stone-700 hover:bg-stone-200 disabled:invisible"
          >
            <Undo2 className="size-5" /> Annuler mon clic
          </button>
          <button onClick={() => setIssueOpen(true)} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-amber-100 text-base font-semibold text-amber-900 hover:bg-amber-200">
            <AlertTriangle className="size-5" /> Un problème
          </button>
        </div>
      </div>
      {issueOpen && <IssueDialog orderId={order.id} number={order.number} onClose={() => setIssueOpen(false)} />}
    </article>
  );
}

function IssueDialog({ orderId, number, onClose }: { orderId: string; number: number; onClose: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="animate-pop w-full max-w-lg rounded-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Problème – n°{number}</h2>
          <button onClick={onClose} aria-label="Fermer" className="grid size-12 place-items-center rounded-full hover:bg-stone-100">
            <X className="size-6" />
          </button>
        </div>
        <p className="mt-1 text-lg text-stone-600">Que se passe-t-il ? Le responsable sera prévenu tout de suite.</p>
        <div className="mt-4 grid gap-2">
          {ISSUE_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={cn("h-14 rounded-2xl px-4 text-left text-lg font-semibold ring-2", reason === r ? "bg-amber-100 ring-amber-500" : "ring-stone-200 hover:bg-stone-50")}
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Précisez si besoin (facultatif)"
          rows={2}
          className="mt-3 w-full rounded-2xl p-3 text-lg ring-2 ring-stone-200 focus:ring-amber-500 focus:outline-none"
        />
        <button
          disabled={!reason || pending}
          onClick={() =>
            start(async () => {
              const r = await kitchenReportIssue(orderId, reason!, msg);
              if (r.ok) {
                toast("success", r.message ?? "Envoyé");
                onClose();
              } else toast("error", r.error);
              router.refresh();
            })
          }
          className="mt-4 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-xl font-bold text-white disabled:opacity-40"
        >
          {pending && <Loader2 className="size-6 animate-spin" />}
          Prévenir le responsable
        </button>
      </div>
    </div>
  );
}

/** Sonnerie quand une nouvelle commande apparaît (le son doit être activé une fois par un clic). */
export function NewOrderAlarm({ ids }: { ids: string[] }) {
  const [enabled, setEnabled] = useState(false);
  const known = useRef<Set<string> | null>(null);
  const ctx = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem("mk_kitchen_sound") === "1");
    } catch {}
  }, []);

  useEffect(() => {
    if (known.current === null) {
      known.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !known.current!.has(id));
    ids.forEach((id) => known.current!.add(id));
    if (fresh.length && enabled) beep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(","), enabled]);

  const beep = () => {
    try {
      ctx.current ??= new AudioContext();
      const c = ctx.current;
      [0, 0.25, 0.5].forEach((t) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.25, c.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + 0.2);
        o.connect(g).connect(c.destination);
        o.start(c.currentTime + t);
        o.stop(c.currentTime + t + 0.2);
      });
    } catch {}
  };

  return (
    <button
      onClick={() => {
        const v = !enabled;
        setEnabled(v);
        try {
          localStorage.setItem("mk_kitchen_sound", v ? "1" : "0");
        } catch {}
        if (v) beep();
      }}
      className={cn("fixed bottom-4 right-4 z-40 flex h-14 items-center gap-2 rounded-full px-5 text-base font-bold shadow-lg", enabled ? "bg-forest text-white" : "bg-white text-stone-700 ring-1 ring-black/10")}
    >
      {enabled ? <Bell className="size-5" /> : <BellOff className="size-5" />}
      {enabled ? "Son activé" : "Activer le son"}
    </button>
  );
}
