import { cn } from "@/lib/format";

const PALETTES = [
  ["#B9532F", "#E0A526"],
  ["#1F4D3A", "#E0A526"],
  ["#9A4122", "#F0C766"],
  ["#2F6B50", "#B9532F"],
  ["#C9772E", "#1F4D3A"],
];

/** URL d'une photo à une largeur donnée (le serveur la redimensionne). */
export const imageUrl = (id: string, w?: number) => `/api/images/${id}${w ? `?w=${w}` : ""}`;

/** srcset standard : le navigateur choisit la taille adaptée à l'écran. */
export const imageSrcSet = (id: string) => [320, 640, 1200].map((w) => `${imageUrl(id, w)} ${w}w`).join(", ");

/** Photo du plat, ou une illustration élégante tant qu'aucune photo n'a été ajoutée. */
export function DishImage({
  imageId,
  name,
  className,
  rounded = "rounded-2xl",
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 120px",
  priority = false,
}: {
  imageId: string | null;
  name: string;
  className?: string;
  rounded?: string;
  /** Largeur d'affichage, pour que le navigateur télécharge la bonne taille */
  sizes?: string;
  /** Image importante en haut de page : chargée immédiatement */
  priority?: boolean;
}) {
  if (imageId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl(imageId, 640)}
        srcSet={imageSrcSet(imageId)}
        sizes={sizes}
        alt={name}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        className={cn("bg-sand-dark/60 object-cover", rounded, className)}
      />
    );
  }
  const h = [...name].reduce((n, c) => n + c.charCodeAt(0), 0);
  const [a, b] = PALETTES[h % PALETTES.length];
  return (
    <div role="img" aria-label={name} className={cn("relative overflow-hidden", rounded, className)} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      <div className="pattern-african absolute inset-0 opacity-80" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 m-auto h-3/5 w-3/5 opacity-90" aria-hidden>
        <ellipse cx="50" cy="62" rx="40" ry="10" fill="rgba(0,0,0,.18)" />
        <path d="M12 52h76a38 22 0 0 1-76 0z" fill="#F6EFE4" />
        <path d="M20 52a30 13 0 0 1 60 0z" fill="rgba(255,255,255,.85)" />
        <circle cx="40" cy="47" r="5" fill={b} />
        <circle cx="55" cy="45" r="6" fill={a} />
        <circle cx="64" cy="49" r="3.5" fill="#1F4D3A" />
        <path d="M40 30c0-6 6-6 6-12M54 30c0-6 6-6 6-12" stroke="#F6EFE4" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".8" />
      </svg>
    </div>
  );
}
