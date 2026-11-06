import Link from "next/link";
import { CartProvider } from "@/components/cart";
import { ShopHeader, MobileCartBar, Logo } from "@/components/shop-chrome";
import { getSettings } from "@/server/settings";
import { getCurrentUser } from "@/server/auth";
import { scheduleSummary } from "@/server/catalog";
import { runMaintenance } from "@/server/maintenance";
import { Phone, Mail, MapPin, AtSign } from "lucide-react";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()]);
  void runMaintenance();
  const hours = scheduleSummary(s);
  return (
    <CartProvider>
      {s.ordering.paused ? (
        <div className="bg-red-700 px-4 py-2.5 text-center text-[15px] font-medium text-white">{s.ordering.pauseMessage}</div>
      ) : s.business.announcement ? (
        <div className="bg-forest px-4 py-2 text-center text-sm font-medium text-white">{s.business.announcement}</div>
      ) : null}
      <ShopHeader name={s.business.name} accountLabel={user?.role === "customer" ? user.name.split(" ")[0] : null} />
      <main className="min-h-[60vh] pb-24 md:pb-0">{children}</main>
      <footer className="mt-16 bg-forest-dark text-white/85">
        <div className="pattern-stripe h-2" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3">
          <div>
            <Logo name={s.business.name} light />
            <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-white/70">{s.business.about}</p>
          </div>
          <div>
            <div className="mb-3 font-display text-lg font-semibold text-white">Horaires de service</div>
            <ul className="space-y-1 text-[15px]">
              {hours.map((h) => (
                <li key={h.day} className="flex justify-between gap-4">
                  <span>{h.day}</span>
                  <span className={h.open ? "text-white" : "text-white/65"}>{h.text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-gold">Commandes au minimum {s.ordering.minLeadHours} h à l’avance.</p>
          </div>
          <div className="space-y-2 text-[15px]">
            <div className="mb-3 font-display text-lg font-semibold text-white">Contact</div>
            <a href={`tel:${s.business.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-white">
              <Phone className="size-4" /> {s.business.phone}
            </a>
            <a href={`mailto:${s.business.email}`} className="flex items-center gap-2 hover:text-white">
              <Mail className="size-4" /> {s.business.email}
            </a>
            {s.ordering.pickupEnabled && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-1 size-4 shrink-0" /> {s.business.pickupAddress}
              </div>
            )}
            {s.business.instagram && (
              <a href={s.business.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white">
                <AtSign className="size-4" /> Instagram
              </a>
            )}
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-5 text-sm text-white/60">
            <span>© {new Date().getFullYear()} {s.business.name}</span>
            <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
            <Link href="/cgv" className="hover:text-white">CGV</Link>
            <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
            <Link href="/allergenes" className="hover:text-white">Allergènes</Link>
            <Link href="/cuisine" className="ml-auto hover:text-white">Espace équipe</Link>
          </div>
        </div>
      </footer>
      <MobileCartBar />
    </CartProvider>
  );
}
