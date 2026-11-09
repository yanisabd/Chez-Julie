import Link from "next/link";
import { ArrowRight, Clock, ChefHat, Flame, Star } from "lucide-react";
import { DishImage } from "./dish-image";
import { cn } from "@/lib/format";

type Dish = { id: number; name: string; slug: string; imageId: string | null };

/** Bloc d'accueil : fond dégradé animé + photos des plats mis en avant qui flottent. */
export function Hero({ dishes, tagline, about, minLeadHours, maxAdvanceDays }: { dishes: Dish[]; tagline: string; about: string; minLeadHours: number; maxAdvanceDays: number }) {
  const [main, ...others] = dishes;
  const sat = others.slice(0, 3);
  const words = ["La", "cuisine", "africaine,"];
  const satPos = [
    "left-0 top-6 size-32 sm:size-40 [--r:-6deg]",
    "right-0 top-0 size-28 sm:size-36 [--r:8deg]",
    "right-4 bottom-2 size-32 sm:size-40 [--r:-4deg]",
  ];

  return (
    <section className="relative isolate overflow-hidden text-white">
      {/* Fond */}
      <div className="hero-gradient absolute inset-0 -z-20" />
      <div className="blob -z-10 left-[-10%] top-[-10%] size-[420px] bg-gold" />
      <div className="blob -z-10 right-[-5%] top-[30%] size-[380px] bg-terracotta [animation-delay:-5s]" />
      <div className="blob -z-10 bottom-[-20%] left-[30%] size-[460px] bg-emerald-400/60 [animation-delay:-9s]" />
      <div className="pattern-african absolute inset-0 -z-10 opacity-60" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-24 pt-12 md:min-h-[86vh] md:grid-cols-[1.05fr_1fr] md:pb-28 md:pt-16">
        {/* Texte */}
        <div>
          <span className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-gold ring-1 ring-white/25 backdrop-blur">
            <ChefHat className="size-4" /> {tagline}
          </span>
          <h1 className="mt-5 text-[2.4rem] font-bold leading-[1.08] sm:text-5xl lg:text-[3.1rem] lg:[&>span]:whitespace-nowrap">
            <span className="block">
              {words.map((w, i) => (
                <span key={w} className="animate-fade-up mr-[0.25em] inline-block" style={{ animationDelay: `${150 + i * 120}ms` }}>
                  {w}
                </span>
              ))}
            </span>
            <span className="animate-fade-up block bg-gradient-to-r from-gold via-amber-200 to-gold bg-clip-text text-transparent" style={{ animationDelay: "520ms" }}>
              préparée pour vous,
            </span>
            <span className="animate-fade-up block" style={{ animationDelay: "650ms" }}>
              à l’heure qui vous va.
            </span>
          </h1>
          <p className="animate-fade-up mt-6 max-w-lg text-lg text-white/85" style={{ animationDelay: "800ms" }}>
            {about}
          </p>
          <div className="animate-fade-up mt-8 flex flex-wrap gap-3" style={{ animationDelay: "950ms" }}>
            <Link href="/menu" className="btn-shine group inline-flex h-14 items-center gap-2 rounded-full bg-terracotta px-7 text-base font-semibold shadow-xl shadow-black/20 transition hover:scale-[1.03] hover:bg-terracotta-dark">
              Commander maintenant <ArrowRight className="size-5 transition group-hover:translate-x-1" />
            </Link>
            <Link href="/infos" className="inline-flex h-14 items-center rounded-full bg-white/10 px-7 font-semibold ring-1 ring-white/30 backdrop-blur transition hover:bg-white/20">
              Retrait & livraison
            </Link>
          </div>
          <div className="animate-fade-up mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80" style={{ animationDelay: "1100ms" }}>
            <span className="flex items-center gap-2">
              <Clock className="size-4 text-gold" /> Commande {minLeadHours} h à {maxAdvanceDays} j à l’avance
            </span>
            <span className="flex items-center gap-2">
              <Flame className="size-4 text-gold" /> Cuisiné à la commande
            </span>
          </div>
        </div>

        {/* Plats qui flottent */}
        {main && (
          <div className="relative mx-auto aspect-square w-full max-w-[460px]">
            <div className="animate-spin-slow absolute inset-[6%] rounded-full border-2 border-dashed border-white/25" />
            <div className="animate-spin-reverse absolute inset-[16%] rounded-full border border-gold/40" />
            <Link
              href={`/plat/${main.slug}`}
              className="animate-scale-in group absolute inset-[18%] block rounded-full shadow-[0_30px_80px_-10px_rgba(0,0,0,0.55)] ring-8 ring-white/15"
              style={{ animationDelay: "300ms" }}
              aria-label={main.name}
            >
              <div className="animate-spin-slow size-full overflow-hidden rounded-full [animation-duration:90s]">
                <DishImage imageId={main.imageId} name={main.name} className="size-full transition duration-700 group-hover:scale-110" rounded="rounded-full" priority sizes="(min-width: 768px) 300px, 60vw" />
              </div>
              {/* vapeur */}
              <span className="steam absolute -top-6 left-[40%] h-10 w-3 rounded-full bg-white/50 blur-sm" />
              <span className="steam absolute -top-8 left-[52%] h-12 w-3 rounded-full bg-white/40 blur-sm [animation-delay:1.1s]" />
              <span className="steam absolute -top-5 left-[62%] h-9 w-3 rounded-full bg-white/40 blur-sm [animation-delay:2s]" />
            </Link>
            {sat.map((d, i) => (
              <Link
                key={d.id}
                href={`/plat/${d.slug}`}
                aria-label={d.name}
                className={cn("animate-scale-in absolute block", satPos[i])}
                style={{ animationDelay: `${600 + i * 180}ms` }}
              >
                <div className="animate-float group size-full" style={{ animationDelay: `${-i * 1.7}s` }}>
                  <DishImage imageId={d.imageId} name={d.name} className="size-full shadow-2xl ring-4 ring-white/30 transition duration-500 group-hover:scale-110" rounded="rounded-full" sizes="160px" />
                  <span className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-bold text-ink opacity-0 shadow-lg transition group-hover:opacity-100">
                    {d.name}
                  </span>
                </div>
              </Link>
            ))}
            {/* Badges flottants */}
            <div className="animate-float-slow absolute -left-2 bottom-[18%] flex items-center gap-2 rounded-2xl bg-white/90 px-3.5 py-2.5 text-sm font-semibold text-ink shadow-xl backdrop-blur [animation-delay:-2s]">
              <span className="grid size-8 place-items-center rounded-full bg-terracotta-light text-terracotta">
                <Flame className="size-4" />
              </span>
              Fait maison
            </div>
            <div className="animate-float-slow absolute -right-1 top-[42%] flex items-center gap-2 rounded-2xl bg-white/90 px-3.5 py-2.5 text-sm font-semibold text-ink shadow-xl backdrop-blur [animation-delay:-5s]">
              <span className="grid size-8 place-items-center rounded-full bg-gold-light text-amber-700">
                <Star className="size-4 fill-current" />
              </span>
              {main.name}
            </div>
          </div>
        )}
      </div>

      {/* Indication de défilement */}
      <div className="absolute bottom-16 left-1/2 hidden -translate-x-1/2 md:block">
        <div className="flex h-10 w-6 justify-center rounded-full border-2 border-white/50 pt-2">
          <span className="animate-scroll-hint h-2 w-1 rounded-full bg-white" />
        </div>
      </div>

      {/* Vague de transition */}
      <svg className="absolute -bottom-px left-0 w-full text-sand" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden>
        <path fill="currentColor" d="M0,40 C240,90 480,0 720,30 C960,60 1200,10 1440,45 L1440,90 L0,90 Z" />
      </svg>
    </section>
  );
}

/** Bande défilante avec le nom des plats. */
export function Marquee({ items }: { items: string[] }) {
  if (!items.length) return null;
  const row = [...items, ...items];
  return (
    <div className="marquee-pause relative overflow-hidden bg-terracotta py-4 text-white">
      <div className="animate-marquee flex w-max gap-8 whitespace-nowrap">
        {[...row, ...row].map((t, i) => (
          <span key={i} className="flex items-center gap-8 font-display text-2xl font-semibold">
            {t}
            <span className="text-gold">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
