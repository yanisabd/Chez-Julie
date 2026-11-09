"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/format";
import { imageUrl, imageSrcSet } from "./dish-image";

/** Galerie de la fiche plat : grande photo + miniatures, flèches et glisser sur mobile. */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);
  const go = (n: number) => setI((n + images.length) % images.length);
  const many = images.length > 1;

  return (
    <div className="md:sticky md:top-24">
      <div
        className="group relative aspect-square w-full overflow-hidden rounded-3xl bg-sand-dark shadow-md"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current == null || !many) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
          touch.current = null;
        }}
      >
        {images.map((id, n) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={id}
            src={imageUrl(id, 800)}
            srcSet={imageSrcSet(id)}
            sizes="(min-width: 768px) 45vw, 100vw"
            alt={n === 0 ? name : `${name} – photo ${n + 1}`}
            loading={n === 0 ? "eager" : "lazy"}
            className={cn("absolute inset-0 size-full object-cover transition duration-500", n === i ? "scale-100 opacity-100" : "scale-105 opacity-0")}
          />
        ))}
        {many && (
          <>
            <button
              type="button"
              aria-label="Photo précédente"
              onClick={() => go(i - 1)}
              className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 max-md:opacity-100"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              aria-label="Photo suivante"
              onClick={() => go(i + 1)}
              className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink opacity-0 shadow-lg backdrop-blur transition group-hover:opacity-100 max-md:opacity-100"
            >
              <ChevronRight className="size-6" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-2.5 py-1.5 backdrop-blur">
              {images.map((id, n) => (
                <span key={id} className={cn("h-2 rounded-full bg-white transition-all", n === i ? "w-5" : "w-2 opacity-60")} />
              ))}
            </div>
          </>
        )}
      </div>
      {many && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
          {images.map((id, n) => (
            <button
              key={id}
              type="button"
              onClick={() => setI(n)}
              aria-label={`Voir la photo ${n + 1}`}
              className={cn("aspect-square overflow-hidden rounded-xl ring-2 transition", n === i ? "ring-terracotta" : "opacity-70 ring-transparent hover:opacity-100")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(id, 320)} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
