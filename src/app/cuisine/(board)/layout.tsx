import Link from "next/link";
import { LogOut, ListChecks, ClipboardList } from "lucide-react";
import { requirePageRole } from "@/server/auth";
import { getSettings } from "@/server/settings";
import { runMaintenance } from "@/server/maintenance";
import { kitchenLogout } from "../actions";

export const metadata = {
  title: "Cuisine",
  robots: { index: false },
  manifest: "/cuisine/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Cuisine", statusBarStyle: "black-translucent" as const },
};

export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole(["kitchen", "admin"]);
  const s = await getSettings();
  void runMaintenance();
  return (
    <div className="min-h-dvh bg-stone-100">
      <header className="sticky top-0 z-30 bg-forest text-white shadow">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="size-9" />
          <div className="mr-auto leading-tight">
            <div className="font-display text-lg font-bold">{s.business.name} · Cuisine</div>
            <div className="text-sm text-white/70">Connecté : {user.name}</div>
          </div>
          <nav className="flex gap-2">
            <Link href="/cuisine" className="flex h-12 items-center gap-2 rounded-xl bg-white/10 px-4 text-[16px] font-semibold hover:bg-white/20">
              <ClipboardList className="size-5" /> <span className="hidden sm:inline">Commandes</span>
            </Link>
            <Link href="/cuisine/production" className="flex h-12 items-center gap-2 rounded-xl bg-white/10 px-4 text-[16px] font-semibold hover:bg-white/20">
              <ListChecks className="size-5" /> <span className="hidden sm:inline">Quantités</span>
            </Link>
            {user.role === "admin" ? (
              <Link href="/admin" className="flex h-12 items-center rounded-xl bg-gold px-4 font-semibold text-ink">
                Admin
              </Link>
            ) : (
              <form action={kitchenLogout}>
                <button className="flex h-12 items-center gap-2 rounded-xl bg-white/10 px-4 font-semibold hover:bg-white/20" aria-label="Se déconnecter">
                  <LogOut className="size-5" />
                </button>
              </form>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4">{children}</main>
    </div>
  );
}
