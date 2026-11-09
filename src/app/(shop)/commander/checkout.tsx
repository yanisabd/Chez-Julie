"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Store, Bike, Check, ChevronLeft, Loader2, Lock, MapPin, CalendarDays, AlertTriangle, Pencil, Tag } from "lucide-react";
import { useCart } from "@/components/cart";
import { useToast } from "@/components/toast";
import { btnClass, Field, Input, Textarea, Notice } from "@/components/ui";
import { formatPrice, cn } from "@/lib/format";
import { formatDayShort, relativeDayLabel } from "@/lib/time";
import { getAvailability, checkDeliveryAddress, quote, placeOrder, type ClientDay } from "../actions";

type Config = {
  paused: boolean;
  pauseMessage: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  promoEnabled: boolean;
  minLeadHours: number;
  pickupAddress: string;
  cancelDeadlineHours: number | null;
  loggedIn: boolean;
};

type Details = {
  name: string;
  email: string;
  phone: string;
  addressLine: string;
  postalCode: string;
  city: string;
  deliveryInstructions: string;
  kitchenNotes: string;
};

const DETAILS_KEY = "mk_details_v1";
const STEPS = ["Quand ?", "Coordonnées", "Paiement"];

export function Checkout({ config, prefill }: { config: Config; prefill: { name: string; email: string; phone: string } | null }) {
  const { items, ready, clear } = useCart();
  const toast = useToast();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"pickup" | "delivery">(config.pickupEnabled ? "pickup" : "delivery");
  const [days, setDays] = useState<ClientDay[] | null>(null);
  const [availError, setAvailError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<{ key: string; label: string; day: string } | null>(null);
  const [details, setDetails] = useState<Details>({ name: "", email: "", phone: "", addressLine: "", postalCode: "", city: "", deliveryInstructions: "", kitchenNotes: "" });
  const [zone, setZone] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const [promo, setPromo] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [q, setQ] = useState<Awaited<ReturnType<typeof quote>> | null>(null);
  const [terms, setTerms] = useState(false);
  const [paying, startPay] = useTransition();
  const [loadingSlots, setLoadingSlots] = useState(false);

  const lines = useMemo(() => items.map((i) => ({ productId: i.productId, qty: i.qty, optionIds: i.optionIds })), [items]);

  // Coordonnées mémorisées sur cet appareil pour aller plus vite la prochaine fois
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DETAILS_KEY) ?? "null");
      setDetails((d) => ({ ...d, ...(saved ?? {}), ...(prefill ?? {}), kitchenNotes: "" }));
    } catch {
      if (prefill) setDetails((d) => ({ ...d, ...prefill }));
    }
  }, [prefill]);

  const loadSlots = async () => {
    setLoadingSlots(true);
    const r = await getAvailability(mode, lines);
    setLoadingSlots(false);
    if (!r.ok) {
      setAvailError(r.error);
      setDays([]);
      return;
    }
    setAvailError(null);
    setDays(r.days);
    const firstOpen = r.days.find((d) => d.slots.some((s) => s.state === "available"));
    setDay((cur) => (cur && r.days.some((d) => d.day === cur && d.slots.some((s) => s.state === "available")) ? cur : (firstOpen?.day ?? r.days[0]?.day ?? null)));
    setSlot((cur) => (cur && r.days.some((d) => d.slots.some((s) => s.key === cur.key && s.state === "available")) ? cur : null));
  };

  useEffect(() => {
    if (ready && lines.length) void loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ready, lines.length]);

  // Total à jour dès l'étape de paiement
  useEffect(() => {
    if (step !== 2) return;
    void quote({ mode, lines, postalCode: details.postalCode, city: details.city, promoCode: appliedPromo }).then(setQ);
  }, [step, mode, lines, details.postalCode, details.city, appliedPromo]);

  if (!ready) return <div className="grid h-64 place-items-center"><Loader2 className="size-8 animate-spin text-muted" /></div>;
  if (!items.length)
    return (
      <div className="mx-auto max-w-xl px-4 pt-12 text-center">
        <p className="text-lg">Votre panier est vide.</p>
        <Link href="/menu" className={btnClass("primary", "lg", "mt-4")}>Voir la carte</Link>
      </div>
    );
  if (config.paused) return <div className="mx-auto max-w-xl px-4 pt-12"><Notice tone="warn">{config.pauseMessage}</Notice></div>;

  const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDetails((d) => ({ ...d, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
    if (k === "postalCode" || k === "city") setZone(null);
  };

  const checkZone = async () => {
    if (mode !== "delivery" || details.postalCode.replace(/\s/g, "").length < 5) return;
    const r = await checkDeliveryAddress(details.postalCode, details.city);
    setZone(
      r.ok
        ? { ok: true, text: `Livraison possible (${r.zone.name}) : ${r.zone.feeCents ? formatPrice(r.zone.feeCents) : "offerte"}${r.zone.minOrderCents ? ` · minimum ${formatPrice(r.zone.minOrderCents)}` : ""}${r.zone.freeAboveCents != null ? ` · offerte dès ${formatPrice(r.zone.freeAboveCents)}` : ""}` }
        : { ok: false, text: r.error },
    );
  };

  const validateDetails = () => {
    const e: typeof errors = {};
    if (details.name.trim().length < 2) e.name = "Indiquez votre nom.";
    if (!/^\S+@\S+\.\S+$/.test(details.email.trim())) e.email = "Adresse email invalide.";
    if (!/^\+?[0-9 .-]{9,20}$/.test(details.phone.trim())) e.phone = "Numéro de téléphone invalide.";
    if (mode === "delivery") {
      if (details.addressLine.trim().length < 5) e.addressLine = "Indiquez votre adresse.";
      if (!/^\d{5}$/.test(details.postalCode.replace(/\s/g, ""))) e.postalCode = "5 chiffres.";
      if (details.city.trim().length < 2) e.city = "Indiquez la ville.";
      if (zone && !zone.ok) e.postalCode = zone.text;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const pay = () =>
    startPay(async () => {
      const r = await placeOrder({ items: lines, mode, slot: slot!.key, ...details, promoCode: appliedPromo, acceptTerms: terms });
      if (r.ok) {
        try {
          const { kitchenNotes: _k, ...keep } = details;
          void _k;
          localStorage.setItem(DETAILS_KEY, JSON.stringify(keep));
        } catch {}
        clear();
        window.location.href = r.redirectUrl;
        return;
      }
      toast("error", r.error);
      if (r.code === "slot" || r.code === "slot_full" || r.code === "day_full" || r.code === "daily_limit") {
        setSlot(null);
        setStep(0);
        await loadSlots();
      } else if (r.code === "cart" || r.code === "stock" || r.code === "ingredient" || r.code === "unavailable") {
        router.push("/panier");
      } else if (r.field && r.field in details) {
        setErrors({ [r.field]: r.error });
        setStep(1);
      }
    });

  const currentDay = days?.find((d) => d.day === day);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      {/* Étapes */}
      <ol className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              className={cn(
                "flex items-center gap-2 text-sm font-semibold sm:text-[15px]",
                i === step ? "text-ink" : i < step ? "text-forest" : "text-stone-400",
              )}
            >
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-sm", i < step ? "bg-forest text-white" : i === step ? "bg-terracotta text-white" : "bg-sand-dark text-stone-500")}>
                {i < step ? <Check className="size-4" /> : i + 1}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && <span className={cn("h-0.5 flex-1 rounded", i < step ? "bg-forest" : "bg-sand-dark")} />}
          </li>
        ))}
      </ol>

      {/* ÉTAPE 1 : mode + créneau */}
      {step === 0 && (
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Comment et quand ?</h1>
            <p className="text-muted">Commande au minimum {config.minLeadHours} h à l’avance. Seuls les créneaux encore disponibles sont proposés.</p>
          </div>
          {config.pickupEnabled && config.deliveryEnabled && (
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { m: "pickup", icon: Store, t: "Retrait", d: "Gratuit, sur place" },
                  { m: "delivery", icon: Bike, t: "Livraison", d: "À votre porte" },
                ] as const
              ).map((o) => (
                <button
                  key={o.m}
                  type="button"
                  onClick={() => setMode(o.m)}
                  aria-pressed={mode === o.m}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-2 transition",
                    mode === o.m ? "ring-forest" : "ring-transparent hover:ring-sand-dark",
                  )}
                >
                  <o.icon className={cn("size-7", mode === o.m ? "text-forest" : "text-muted")} />
                  <span>
                    <span className="block text-lg font-semibold">{o.t}</span>
                    <span className="text-sm text-muted">{o.d}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {mode === "pickup" && (
            <p className="flex items-start gap-2 text-[15px] text-muted">
              <MapPin className="mt-0.5 size-4 shrink-0" /> Retrait au {config.pickupAddress}
            </p>
          )}

          <div>
            <h2 className="mb-3 flex items-center gap-2 font-sans text-lg font-semibold">
              <CalendarDays className="size-5" /> Choisissez le jour
              {loadingSlots && <Loader2 className="size-4 animate-spin text-muted" />}
            </h2>
            {availError && <Notice tone="warn">{availError}</Notice>}
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {days?.map((d) => {
                const free = d.slots.filter((s) => s.state === "available").length;
                return (
                  <button
                    key={d.day}
                    type="button"
                    onClick={() => setDay(d.day)}
                    className={cn(
                      "flex w-[92px] shrink-0 flex-col items-center rounded-2xl px-2 py-3 ring-2 transition",
                      day === d.day ? "bg-forest text-white ring-forest" : "bg-white ring-transparent shadow-sm hover:ring-sand-dark",
                      free === 0 && day !== d.day && "opacity-50",
                    )}
                  >
                    <span className="text-xs font-semibold uppercase">{relativeDayLabel(d.day).length <= 12 ? relativeDayLabel(d.day) : formatDayShort(d.day).split(" ")[0]}</span>
                    <span className="text-lg font-bold">{formatDayShort(d.day).split(" ").slice(1).join(" ")}</span>
                    <span className={cn("text-xs", day === d.day ? "text-white/80" : free ? "text-forest" : "text-stone-500")}>{free ? `${free} créneau${free > 1 ? "x" : ""}` : d.closedReason ? "Fermé" : "Complet"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {currentDay && (
            <div>
              <h2 className="mb-3 font-sans text-lg font-semibold">Choisissez l’heure</h2>
              {currentDay.productIssue && <Notice tone="warn" className="mb-3">{currentDay.productIssue}. Choisissez un autre jour ou modifiez votre panier.</Notice>}
              {currentDay.closedReason && !currentDay.slots.some((s) => s.state === "available") ? (
                <Notice tone="info">{currentDay.closedReason}.</Notice>
              ) : currentDay.slots.length === 0 ? (
                <Notice tone="info">Aucun créneau ce jour-là.</Notice>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {currentDay.slots.map((s) => {
                    const ok = s.state === "available";
                    const sel = slot?.key === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        disabled={!ok}
                        data-day={currentDay.day}
                        onClick={() => setSlot({ key: s.key, label: s.label, day: currentDay.day })}
                        className={cn(
                          "rounded-xl px-2 py-3 text-center ring-2 transition",
                          sel ? "bg-terracotta text-white ring-terracotta" : ok ? "bg-white ring-transparent shadow-sm hover:ring-terracotta/40" : "bg-stone-100 text-stone-400 ring-transparent",
                        )}
                      >
                        <span className="block font-semibold">{s.label}</span>
                        {!ok && <span className="text-xs">{s.state === "full" ? "Complet" : s.state === "too_soon" ? "Trop tôt" : "Indisponible"}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button type="button" disabled={!slot} onClick={() => setStep(1)} className={btnClass("primary", "lg", "w-full")}>
            {slot ? `Continuer · ${relativeDayLabel(slot.day)} ${slot.label}` : "Choisissez un créneau"}
          </button>
        </section>
      )}

      {/* ÉTAPE 2 : coordonnées */}
      {step === 1 && (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (validateDetails()) setStep(2);
          }}
        >
          <div>
            <h1 className="text-2xl font-bold">Vos coordonnées</h1>
            <p className="text-muted">
              Pour vous envoyer la confirmation et vous joindre si besoin.
              {!config.loggedIn && (
                <>
                  {" "}
                  Déjà client ? <Link href="/compte/connexion?retour=/commander" className="font-semibold text-terracotta underline">Connectez-vous</Link> (facultatif).
                </>
              )}
            </p>
          </div>
          <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:grid-cols-2">
            <Field label="Nom et prénom" error={errors.name} className="sm:col-span-2" htmlFor="name">
              <Input id="name" autoComplete="name" value={details.name} onChange={set("name")} required />
            </Field>
            <Field label="Email" error={errors.email} htmlFor="email">
              <Input id="email" type="email" autoComplete="email" inputMode="email" value={details.email} onChange={set("email")} required />
            </Field>
            <Field label="Téléphone mobile" error={errors.phone} hint="Vous recevrez un SMS quand votre commande sera prête." htmlFor="phone">
              <Input id="phone" type="tel" autoComplete="tel" inputMode="tel" value={details.phone} onChange={set("phone")} required />
            </Field>
          </div>
          {mode === "delivery" && (
            <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:grid-cols-6">
              <h2 className="font-sans text-lg font-semibold sm:col-span-6">Adresse de livraison</h2>
              <Field label="Adresse" error={errors.addressLine} className="sm:col-span-6" htmlFor="addr">
                <Input id="addr" autoComplete="street-address" value={details.addressLine} onChange={set("addressLine")} placeholder="N° et rue, bâtiment, étage…" />
              </Field>
              <Field label="Code postal" error={errors.postalCode} className="sm:col-span-2" htmlFor="pc">
                <Input id="pc" autoComplete="postal-code" inputMode="numeric" value={details.postalCode} onChange={set("postalCode")} onBlur={checkZone} />
              </Field>
              <Field label="Ville" error={errors.city} className="sm:col-span-4" htmlFor="city">
                <Input id="city" autoComplete="address-level2" value={details.city} onChange={set("city")} onBlur={checkZone} />
              </Field>
              {zone && (
                <p className={cn("text-[15px] font-medium sm:col-span-6", zone.ok ? "text-forest" : "text-red-700")}>
                  {zone.ok ? "✓ " : "✗ "}
                  {zone.text}
                </p>
              )}
              <Field label="Instructions pour le livreur (facultatif)" className="sm:col-span-6" htmlFor="di">
                <Input id="di" value={details.deliveryInstructions} onChange={set("deliveryInstructions")} placeholder="Code d’accès, interphone…" />
              </Field>
            </div>
          )}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <Field label="Une demande pour la cuisine ? (facultatif)" hint="Allergie, sans oignon, couverts… Nous ferons notre possible." htmlFor="kn">
              <Textarea id="kn" value={details.kitchenNotes} onChange={set("kitchenNotes")} maxLength={300} />
            </Field>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(0)} className={btnClass("outline", "lg")}>
              <ChevronLeft className="size-5" /> Retour
            </button>
            <button type="submit" className={btnClass("primary", "lg", "flex-1")}>
              Vérifier ma commande
            </button>
          </div>
        </form>
      )}

      {/* ÉTAPE 3 : vérification + paiement */}
      {step === 2 && slot && (
        <section className="space-y-5">
          <h1 className="text-2xl font-bold">Vérifiez et payez</h1>
          <div className="divide-y divide-sand rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-3 p-4">
              <div>
                <div className="text-sm font-medium text-muted">{mode === "pickup" ? "Retrait" : "Livraison"}</div>
                <div className="text-lg font-semibold">
                  {relativeDayLabel(slot.day)}, {slot.label}
                </div>
                <div className="text-[15px] text-muted">
                  {mode === "pickup" ? config.pickupAddress : `${details.addressLine}, ${details.postalCode} ${details.city}`}
                </div>
              </div>
              <button onClick={() => setStep(0)} className="flex items-center gap-1 text-sm font-semibold text-terracotta"><Pencil className="size-4" />Modifier</button>
            </div>
            <div className="flex items-start justify-between gap-3 p-4">
              <div>
                <div className="text-sm font-medium text-muted">Coordonnées</div>
                <div className="font-semibold">{details.name}</div>
                <div className="text-[15px] text-muted">{details.email} · {details.phone}</div>
              </div>
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm font-semibold text-terracotta"><Pencil className="size-4" />Modifier</button>
            </div>
            <ul className="space-y-2 p-4">
              {items.map((i) => (
                <li key={i.key} className="flex justify-between gap-3 text-[15px]">
                  <span>
                    <b>{i.qty} ×</b> {i.name}
                    {i.optionLabels.length > 0 && <span className="block text-sm text-muted">{i.optionLabels.join(" · ")}</span>}
                  </span>
                  <span className="shrink-0">{formatPrice(i.unitPriceCents * i.qty)}</span>
                </li>
              ))}
            </ul>
            {config.promoEnabled && (
              <div className="p-4">
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setAppliedPromo(promo.trim());
                  }}
                >
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                    <Input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="Code promo" className="pl-9 uppercase" />
                  </div>
                  <button className={btnClass("outline", "md", "h-auto")}>Appliquer</button>
                </form>
                {q?.ok && appliedPromo && (q.promoError ? <p className="mt-1.5 text-sm font-medium text-red-700">{q.promoError}</p> : <p className="mt-1.5 text-sm font-medium text-forest">✓ Code {appliedPromo} appliqué ({q.promoLabel})</p>)}
              </div>
            )}
            <div className="space-y-1 p-4 text-[15px]">
              {!q ? (
                <div className="flex justify-center py-2"><Loader2 className="size-5 animate-spin text-muted" /></div>
              ) : q.ok ? (
                <>
                  <div className="flex justify-between"><span className="text-muted">Sous-total</span><span>{formatPrice(q.subtotalCents)}</span></div>
                  {q.discountCents > 0 && <div className="flex justify-between text-forest"><span>Réduction</span><span>−{formatPrice(q.discountCents)}</span></div>}
                  {mode === "delivery" && <div className="flex justify-between"><span className="text-muted">Livraison</span><span>{q.deliveryFeeCents ? formatPrice(q.deliveryFeeCents) : "Offerte"}</span></div>}
                  <div className="flex justify-between pt-2 text-xl font-bold"><span>Total</span><span>{formatPrice(q.totalCents)}</span></div>
                </>
              ) : (
                <Notice tone="error">{q.error}</Notice>
              )}
            </div>
          </div>
          {q?.ok && (q.deliveryError || q.issues.length > 0) && (
            <Notice tone="error">
              {q.deliveryError}
              {q.issues.map((x) => <div key={x}>{x}</div>)}
            </Notice>
          )}
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 size-5 accent-forest" />
            <span className="text-[15px]">
              J’accepte les <Link href="/cgv" target="_blank" className="font-semibold underline">conditions générales de vente</Link> et la{" "}
              <Link href="/confidentialite" target="_blank" className="font-semibold underline">politique de confidentialité</Link>.
              {config.cancelDeadlineHours != null && <span className="block text-sm text-muted">Annulation gratuite en ligne jusqu’à {config.cancelDeadlineHours} h avant votre créneau.</span>}
            </span>
          </label>
          {!terms && q?.ok && (
            <p className="flex items-center gap-2 text-sm text-muted"><AlertTriangle className="size-4" />Cochez la case ci-dessus pour pouvoir payer.</p>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className={btnClass("outline", "lg")}>
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={pay}
              disabled={!terms || paying || !q?.ok || !!q.deliveryError || q.issues.length > 0}
              className={btnClass("primary", "xl", "flex-1")}
            >
              {paying ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
              {q?.ok ? `Payer ${formatPrice(q.totalCents)}` : "Payer"}
            </button>
          </div>
          <p className="text-center text-sm text-muted">Paiement 100 % sécurisé · Carte bancaire, Apple Pay, Google Pay</p>
        </section>
      )}
    </div>
  );
}
