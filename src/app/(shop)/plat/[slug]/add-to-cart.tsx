"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Check } from "lucide-react";
import { useCart } from "@/components/cart";
import { useToast } from "@/components/toast";
import { formatPrice, cn } from "@/lib/format";
import { btnClass } from "@/components/ui";

type Group = { id: number; name: string; required: boolean; maxChoices: number; options: { id: number; name: string; priceDeltaCents: number }[] };

export function AddToCart({
  product,
  groups,
  soldOut,
}: {
  product: { id: number; slug: string; name: string; imageId: string | null; priceCents: number; maxQty: number };
  groups: Group[];
  soldOut: boolean;
}) {
  const { add } = useCart();
  const toast = useToast();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [sel, setSel] = useState<Record<number, number[]>>(() =>
    Object.fromEntries(groups.map((g) => [g.id, g.required && g.maxChoices === 1 && g.options[0] ? [g.options[0].id] : []])),
  );
  const [showErrors, setShowErrors] = useState(false);

  const chosen = groups.flatMap((g) => g.options.filter((o) => sel[g.id]?.includes(o.id)));
  const unit = product.priceCents + chosen.reduce((n, o) => n + o.priceDeltaCents, 0);
  const missing = groups.filter((g) => g.required && !(sel[g.id]?.length));

  const toggle = (g: Group, id: number) => {
    setSel((cur) => {
      const list = cur[g.id] ?? [];
      if (g.maxChoices === 1) return { ...cur, [g.id]: list.includes(id) && !g.required ? [] : [id] };
      if (list.includes(id)) return { ...cur, [g.id]: list.filter((x) => x !== id) };
      if (list.length >= g.maxChoices) return cur;
      return { ...cur, [g.id]: [...list, id] };
    });
  };

  if (soldOut)
    return <div className="rounded-2xl bg-stone-200 px-5 py-4 text-center text-lg font-semibold text-stone-700">Épuisé pour le moment</div>;

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <fieldset key={g.id} className={cn("rounded-2xl bg-white p-4 shadow-sm ring-1", showErrors && missing.includes(g) ? "ring-2 ring-red-400" : "ring-black/5")}>
          <legend className="sr-only">{g.name}</legend>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-lg font-semibold">{g.name}</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", g.required ? "bg-terracotta-light text-terracotta-dark" : "bg-stone-100 text-muted")}>
              {g.required ? "Obligatoire" : g.maxChoices > 1 ? `Jusqu’à ${g.maxChoices}` : "Facultatif"}
            </span>
          </div>
          <div className="space-y-1.5">
            {g.options.map((o) => {
              const on = sel[g.id]?.includes(o.id);
              return (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => toggle(g, o.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[16px] ring-1 transition",
                    on ? "bg-forest-light ring-forest" : "ring-sand-dark hover:bg-sand",
                  )}
                  aria-pressed={on}
                >
                  <span className={cn("grid size-6 shrink-0 place-items-center border-2", g.maxChoices === 1 ? "rounded-full" : "rounded-md", on ? "border-forest bg-forest text-white" : "border-stone-300")}>
                    {on && <Check className="size-4" />}
                  </span>
                  <span className="flex-1 font-medium">{o.name}</span>
                  {o.priceDeltaCents !== 0 && <span className="text-muted">+{formatPrice(o.priceDeltaCents)}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="flex items-center gap-3">
        <div className="flex h-14 items-center rounded-full bg-white shadow-sm ring-1 ring-black/10">
          <button type="button" aria-label="Moins" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-14 place-items-center rounded-full hover:bg-sand">
            <Minus className="size-5" />
          </button>
          <span className="w-8 text-center text-xl font-bold" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            aria-label="Plus"
            onClick={() => setQty((q) => Math.min(product.maxQty, q + 1))}
            disabled={qty >= product.maxQty}
            className="grid size-14 place-items-center rounded-full hover:bg-sand disabled:opacity-30"
          >
            <Plus className="size-5" />
          </button>
        </div>
        <button
          type="button"
          className={btnClass("primary", "lg", "flex-1 justify-between")}
          onClick={() => {
            if (missing.length) {
              setShowErrors(true);
              toast("error", `Merci de choisir : ${missing.map((g) => g.name).join(", ")}`);
              return;
            }
            add({
              productId: product.id,
              slug: product.slug,
              name: product.name,
              imageId: product.imageId,
              unitPriceCents: unit,
              qty,
              optionIds: chosen.map((o) => o.id),
              optionLabels: chosen.map((o) => o.name),
            });
            toast("success", `${qty} × ${product.name} ajouté${qty > 1 ? "s" : ""} au panier`);
            router.push("/menu");
          }}
        >
          <span>Ajouter</span>
          <span>{formatPrice(unit * qty)}</span>
        </button>
      </div>
      {product.maxQty < 50 && <p className="text-sm text-muted">Maximum {product.maxQty} par commande.</p>}
    </div>
  );
}
