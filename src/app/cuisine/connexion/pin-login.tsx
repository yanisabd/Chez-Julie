"use client";

import { useState, useTransition } from "react";
import { Delete, Loader2, ChefHat, ArrowLeft } from "lucide-react";
import { kitchenLogin } from "../actions";
import { cn } from "@/lib/format";

export function PinLogin({ staff }: { staff: { id: string; name: string }[] }) {
  const [who, setWho] = useState<{ id: string; name: string } | null>(staff.length === 1 ? staff[0] : null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (code: string) =>
    start(async () => {
      const r = await kitchenLogin(who!.id, code);
      if (r && !r.ok) {
        setError(r.error);
        setPin("");
      }
    });

  const press = (d: string) => {
    if (pending) return;
    setError(null);
    const next = (pin + d).slice(0, 8);
    setPin(next);
    if (next.length === 4) submit(next);
  };

  if (!staff.length)
    return <p className="mt-8 rounded-2xl bg-white p-6 text-center text-lg">Aucun profil cuisine n’a encore été créé. Le responsable peut en créer un dans Administration → Équipe.</p>;

  if (!who)
    return (
      <div className="mt-8">
        <p className="mb-4 text-center text-xl text-white">Qui êtes-vous ?</p>
        <div className="grid grid-cols-2 gap-3">
          {staff.map((s) => (
            <button key={s.id} onClick={() => setWho(s)} className="flex flex-col items-center gap-2 rounded-3xl bg-white p-6 text-xl font-bold shadow-lg active:scale-95">
              <span className="grid size-16 place-items-center rounded-full bg-terracotta-light text-terracotta">
                <ChefHat className="size-8" />
              </span>
              {s.name}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div className="mt-8 rounded-3xl bg-white p-6 shadow-xl">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
        {staff.length > 1 ? (
          <button onClick={() => (setWho(null), setPin(""), setError(null))} className="flex items-center gap-1 justify-self-start rounded-full px-3 py-2 text-muted hover:bg-sand">
            <ArrowLeft className="size-5" /> Changer
          </button>
        ) : (
          <span />
        )}
        <span className="text-center text-2xl font-bold">Bonjour {who.name} !</span>
        <span />
      </div>
      <p className="mt-4 text-center text-lg">Tapez votre code</p>
      <div className="my-4 flex justify-center gap-3" role="status" aria-label={`${pin.length} chiffre${pin.length > 1 ? "s" : ""} saisi${pin.length > 1 ? "s" : ""} sur 4`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("size-5 rounded-full border-2 border-forest", pin.length > i && "bg-forest")} />
        ))}
      </div>
      <div className="h-7 text-center font-semibold text-red-700">{pending ? <Loader2 className="mx-auto size-6 animate-spin text-forest" /> : error}</div>
      <div className="mt-2 grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)} className="h-20 rounded-2xl bg-sand text-3xl font-bold active:scale-95 active:bg-sand-dark">
            {d}
          </button>
        ))}
        <span />
        <button onClick={() => press("0")} className="h-20 rounded-2xl bg-sand text-3xl font-bold active:scale-95 active:bg-sand-dark">
          0
        </button>
        <button onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Effacer" className="grid h-20 place-items-center rounded-2xl text-muted active:scale-95">
          <Delete className="size-8" />
        </button>
      </div>
    </div>
  );
}
