"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Minus, Plus, Trash2, ShoppingBag, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { useCart } from "@/components/cart";
import { DishImage } from "@/components/dish-image";
import { formatPrice } from "@/lib/format";
import { btnClass, EmptyState } from "@/components/ui";
import { validateCart } from "../actions";

type Check = Awaited<ReturnType<typeof validateCart>>;

export default function CartPage() {
  const { items, ready, setQty, remove, subtotalCents } = useCart();
  const [check, setCheck] = useState<Check | null>(null);
  const [loading, setLoading] = useState(false);

  // Vérification automatique des prix et disponibilités à chaque modification
  const sig = JSON.stringify(items.map((i) => [i.productId, i.qty, i.optionIds]));
  useEffect(() => {
    if (!ready || !items.length) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await validateCart(items.map((i) => ({ productId: i.productId, qty: i.qty, optionIds: i.optionIds })));
      if (alive) {
        setCheck(r);
        setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, ready]);

  if (!ready) return <div className="grid h-64 place-items-center"><Loader2 className="size-8 animate-spin text-muted" /></div>;

  if (!items.length)
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10">
        <EmptyState icon={<ShoppingBag className="size-10" />} title="Votre panier est vide">
          Découvrez nos plats et ajoutez vos favoris.
          <div className="mt-5">
            <Link href="/menu" className={btnClass("primary", "lg")}>
              Voir la carte
            </Link>
          </div>
        </EmptyState>
      </div>
    );

  const serverLine = (i: (typeof items)[number], idx: number) => (check?.ok ? check.lines[idx] : undefined);
  const issues = check?.ok ? check.lines.filter((l) => l.issue) : [];
  const total = check?.ok ? check.subtotalCents : subtotalCents;
  const priceChanged = check?.ok && items.some((i, idx) => check.lines[idx] && check.lines[idx].unitPriceCents !== i.unitPriceCents);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8">
      <h1 className="text-3xl font-bold">Votre panier</h1>
      {issues.length > 0 && (
        <div className="mt-4 flex gap-3 rounded-2xl bg-red-50 p-4 text-red-900 ring-1 ring-red-200">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <div className="font-semibold">Certains plats ne sont plus disponibles comme demandé</div>
            <div className="text-[15px]">Modifiez les quantités ou retirez-les pour continuer.</div>
          </div>
        </div>
      )}
      {priceChanged && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[15px] text-amber-900 ring-1 ring-amber-200">Certains prix ont été mis à jour depuis votre ajout au panier.</p>}

      <ul className="mt-5 space-y-3">
        {items.map((i, idx) => {
          const sl = serverLine(i, idx);
          return (
            <li key={i.key} className={`flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ${sl?.issue ? "ring-2 ring-red-300" : "ring-black/5"}`}>
              <DishImage imageId={i.imageId} name={i.name} className="size-20 shrink-0" rounded="rounded-xl" />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/plat/${i.slug}`} className="font-semibold leading-snug hover:underline">
                    {i.name}
                  </Link>
                  <span className="shrink-0 font-semibold">{formatPrice((sl?.unitPriceCents ?? i.unitPriceCents) * i.qty)}</span>
                </div>
                {i.optionLabels.length > 0 && <div className="text-sm text-muted">{i.optionLabels.join(" · ")}</div>}
                {sl?.issue && <div className="mt-1 text-sm font-semibold text-red-700">{sl.issue}</div>}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center rounded-full ring-1 ring-sand-dark">
                    <button aria-label="Moins" onClick={() => setQty(i.key, i.qty - 1)} className="grid size-10 place-items-center rounded-full hover:bg-sand">
                      <Minus className="size-4" />
                    </button>
                    <span className="w-7 text-center font-bold">{i.qty}</span>
                    <button
                      aria-label="Plus"
                      onClick={() => setQty(i.key, i.qty + 1)}
                      disabled={sl?.maxQty != null && i.qty >= sl.maxQty}
                      className="grid size-10 place-items-center rounded-full hover:bg-sand disabled:opacity-30"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <button onClick={() => remove(i.key)} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="size-4" /> Retirer
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center justify-between text-lg">
          <span className="font-semibold">Sous-total</span>
          <span className="flex items-center gap-2 font-bold">
            {loading && <Loader2 className="size-4 animate-spin text-muted" />}
            {formatPrice(total)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">Frais de livraison et code promo éventuels calculés à l’étape suivante.</p>
        <Link
          href="/commander"
          aria-disabled={issues.length > 0 || loading}
          className={btnClass("primary", "lg", `mt-4 w-full ${issues.length > 0 || loading || !check ? "pointer-events-none opacity-50" : ""}`)}
        >
          Choisir mon créneau <ArrowRight className="size-5" />
        </Link>
        <Link href="/menu" className="mt-3 block text-center font-medium text-muted hover:text-ink">
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}
