"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";

/** Onglets des catégories : suivent le défilement et mettent en avant la catégorie affichée. */
export function CategoryNav({ categories }: { categories: { id: number; name: string; count: number }[] }) {
  const [active, setActive] = useState<number | null>(categories[0]?.id ?? null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = categories.map((c) => document.getElementById(`cat-${c.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(Number(visible.target.id.replace("cat-", "")));
      },
      { rootMargin: "-150px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    // En bas de page, la dernière catégorie (souvent courte) devient active
    const last = els[els.length - 1];
    const onScroll = () => {
      if (!last) return;
      const r = last.getBoundingClientRect();
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 400 && r.top < window.innerHeight) {
        setActive(Number(last.id.replace("cat-", "")));
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [categories]);

  // Garde l'onglet actif visible dans la barre (mobile)
  useEffect(() => {
    const btn = bar.current?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    btn?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  return (
    <nav className="no-scrollbar sticky top-16 z-30 overflow-x-auto border-b border-sand-dark/60 bg-sand/90 shadow-[0_8px_20px_-16px_rgba(0,0,0,0.25)] backdrop-blur">
      <div ref={bar} className="mx-auto flex max-w-6xl gap-2 px-4 py-3">
        {categories.map((c) => (
          <a
            key={c.id}
            data-cat={c.id}
            href={`#cat-${c.id}`}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[15px] font-semibold ring-1 transition duration-300",
              active === c.id ? "bg-forest text-white shadow-md ring-forest" : "bg-white text-ink ring-black/5 hover:-translate-y-0.5 hover:ring-terracotta/40",
            )}
          >
            {c.name}
            <span className={cn("rounded-full px-1.5 text-xs", active === c.id ? "bg-white/20" : "bg-sand text-muted")}>{c.count}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
