"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { useCart } from "@/components/cart";
import { useToast } from "@/components/toast";
import { btnClass } from "@/components/ui";
import { customerCancel } from "../../actions";
import { productsForReorder } from "./reorder-action";

export function CancelOrderButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      className={btnClass("outline", "lg", "w-full text-red-700")}
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Voulez-vous vraiment annuler cette commande ? Vous serez remboursé intégralement.")) return;
        start(async () => {
          const r = await customerCancel(token);
          if (r.ok) toast("success", r.message ?? "Commande annulée");
          else toast("error", r.error);
          router.refresh();
        });
      }}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      Annuler ma commande
    </button>
  );
}

/** Remet les plats d'une ancienne commande dans le panier (les options doivent être re-choisies si besoin). */
export function ReorderButton({ items, label }: { items: { productId: number | null; name: string; qty: number }[]; label: string }) {
  const { add } = useCart();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className={btnClass("primary", "lg")}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const prods = await productsForReorder(items.map((i) => i.productId).filter((x): x is number => x != null));
          let added = 0;
          for (const i of items) {
            const p = prods.find((x) => x.id === i.productId);
            if (!p) continue;
            if (p.hasOptions) continue;
            add({ productId: p.id, slug: p.slug, name: p.name, imageId: p.imageId, unitPriceCents: p.priceCents, qty: i.qty, optionIds: [], optionLabels: [] });
            added++;
          }
          const skipped = items.length - added;
          if (added) toast("success", `${added} plat${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""} au panier`);
          if (skipped) toast("error", `${skipped} plat${skipped > 1 ? "s" : ""} avec options à re-choisir depuis la carte.`);
          router.push(added ? "/panier" : "/menu");
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-5" />}
      {label}
    </button>
  );
}
