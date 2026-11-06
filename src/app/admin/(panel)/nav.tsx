"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  UtensilsCrossed,
  Boxes,
  CalendarClock,
  Bike,
  Tag,
  CreditCard,
  BarChart3,
  Users,
  Mail,
  Settings,
  ShieldCheck,
  ChefHat,
  ExternalLink,
  LogOut,
  Menu,
  X,
  PauseCircle,
} from "lucide-react";
import { cn } from "@/lib/format";
import { adminLogout } from "./actions/session";

const GROUPS = [
  {
    title: "Au quotidien",
    items: [
      { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/admin/commandes", label: "Commandes", icon: ClipboardList },
      { href: "/cuisine", label: "Écran cuisine", icon: ChefHat },
    ],
  },
  {
    title: "Ma carte",
    items: [
      { href: "/admin/menu", label: "Plats & catégories", icon: UtensilsCrossed },
      { href: "/admin/stocks", label: "Stocks & ingrédients", icon: Boxes },
      { href: "/admin/promotions", label: "Codes promo", icon: Tag },
    ],
  },
  {
    title: "Organisation",
    items: [
      { href: "/admin/planning", label: "Horaires & créneaux", icon: CalendarClock },
      { href: "/admin/livraison", label: "Retrait & livraison", icon: Bike },
      { href: "/admin/equipe", label: "Équipe", icon: Users },
    ],
  },
  {
    title: "Suivi",
    items: [
      { href: "/admin/paiements", label: "Paiements", icon: CreditCard },
      { href: "/admin/statistiques", label: "Statistiques", icon: BarChart3 },
      { href: "/admin/emails", label: "Emails envoyés", icon: Mail },
      { href: "/admin/journal", label: "Journal & sauvegardes", icon: ShieldCheck },
      { href: "/admin/parametres", label: "Paramètres du site", icon: Settings },
    ],
  },
];

export function AdminNav({ name, userName, badges, paused }: { name: string; userName: string; badges: Record<string, number>; paused: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" className="size-9" />
        <div className="leading-tight">
          <div className="font-display text-lg font-bold text-white">{name}</div>
          <div className="text-xs text-white/60">Administration</div>
        </div>
      </div>
      {paused && (
        <Link href="/admin/planning" onClick={() => setOpen(false)} className="mx-3 mb-2 flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white">
          <PauseCircle className="size-4" /> Commandes en pause
        </Link>
      )}
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-white/60">{g.title}</div>
            {g.items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-medium transition",
                  active(it.href) ? "bg-white text-forest-dark" : "text-white/85 hover:bg-white/10",
                )}
              >
                <it.icon className="size-5 shrink-0" />
                <span className="flex-1">{it.label}</span>
                {badges[it.href] ? <span className="grid min-w-6 place-items-center rounded-full bg-gold px-1.5 text-xs font-bold text-ink">{badges[it.href]}</span> : null}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t border-white/10 p-3">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/10">
          <ExternalLink className="size-4" /> Voir le site
        </Link>
        <form action={adminLogout}>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/10">
            <LogOut className="size-4" /> Déconnexion ({userName})
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between bg-forest-dark px-4 py-3 lg:hidden">
        <span className="font-display text-lg font-bold text-white">{name}</span>
        <button onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-xl text-white hover:bg-white/10" aria-label="Ouvrir le menu">
          <Menu />
        </button>
      </div>
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 bg-forest-dark lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-80 max-w-[85%] bg-forest-dark">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 grid size-10 place-items-center rounded-xl text-white hover:bg-white/10" aria-label="Fermer">
              <X />
            </button>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
