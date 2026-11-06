"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, User, Menu as MenuIcon, X } from "lucide-react";
import { useState } from "react";
import { useCart } from "./cart";
import { formatPrice, cn } from "@/lib/format";

export function Logo({ name, light }: { name: string; light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" className="size-9" />
      <span className={cn("font-display text-xl font-bold leading-none", light ? "text-white" : "text-forest")}>{name}</span>
    </Link>
  );
}

export function ShopHeader({ name, accountLabel }: { name: string; accountLabel: string | null }) {
  const { count, ready } = useCart();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/menu", label: "La carte" },
    { href: "/infos", label: "Retrait & livraison" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-sand-dark/70 bg-sand/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo name={name} />
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn("rounded-full px-4 py-2 text-[15px] font-medium hover:bg-black/5", path.startsWith(l.href) && "bg-white shadow-sm")}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/compte" className="hidden items-center gap-2 rounded-full px-3 py-2 text-[15px] font-medium hover:bg-black/5 sm:flex">
            <User className="size-5" />
            {accountLabel ?? "Mon compte"}
          </Link>
          <Link
            href="/panier"
            className="relative flex h-11 items-center gap-2 rounded-full bg-forest px-4 font-semibold text-white shadow-sm hover:bg-forest-dark"
            aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`}
          >
            <ShoppingBag className="size-5" />
            <span className="hidden sm:inline">Panier</span>
            {ready && count > 0 && (
              <span key={count} className="animate-bounce-in grid min-w-6 place-items-center rounded-full bg-gold px-1.5 text-sm font-bold text-ink">
                {count}
              </span>
            )}
          </Link>
          <button className="grid size-11 place-items-center rounded-full hover:bg-black/5 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X /> : <MenuIcon />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-sand-dark bg-sand px-4 py-3 md:hidden">
          {[...links, { href: "/compte", label: accountLabel ?? "Mon compte" }].map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-lg font-medium hover:bg-white">
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

/** Barre panier fixe en bas d'écran sur mobile. */
export function MobileCartBar() {
  const { count, subtotalCents, ready } = useCart();
  const path = usePathname();
  if (!ready || count === 0 || ["/panier", "/commander"].some((p) => path.startsWith(p)) || path.startsWith("/commande/")) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 md:hidden" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
      <Link href="/panier" className="animate-page btn-shine flex h-14 items-center justify-between rounded-full bg-terracotta px-5 font-semibold text-white shadow-xl">
        <span className="grid min-w-7 place-items-center rounded-full bg-white/20 px-2 py-0.5">{count}</span>
        <span>Voir le panier</span>
        <span>{formatPrice(subtotalCents)}</span>
      </Link>
    </div>
  );
}
