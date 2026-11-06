"use client";

import { Plus, Check } from "lucide-react";
import { useState } from "react";
import { useCart } from "./cart";
import { useToast } from "./toast";

export function QuickAdd({ product }: { product: { productId: number; slug: string; name: string; imageId: string | null; unitPriceCents: number } }) {
  const { add } = useCart();
  const toast = useToast();
  const [done, setDone] = useState(false);
  return (
    <button
      className="relative z-10 grid size-10 place-items-center rounded-full bg-terracotta text-white shadow-sm transition hover:bg-terracotta-dark active:scale-95"
      aria-label={`Ajouter ${product.name} au panier`}
      onClick={() => {
        add({ ...product, qty: 1, optionIds: [], optionLabels: [] });
        toast("success", `${product.name} ajouté au panier`);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? <Check className="animate-bounce-in size-5" /> : <Plus className="size-5 transition duration-300 group-hover:rotate-90" />}
    </button>
  );
}
