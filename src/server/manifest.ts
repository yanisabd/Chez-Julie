import type { MetadataRoute } from "next";
import { getSettings } from "./settings";

const icons: MetadataRoute.Manifest["icons"] = [
  { src: "/api/app-icon/192", sizes: "192x192", type: "image/png" },
  { src: "/api/app-icon/512", sizes: "512x512", type: "image/png" },
  { src: "/api/app-icon/512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

/** Manifest d'application installable (site client ou écran cuisine). */
export async function buildManifest(kind: "shop" | "kitchen"): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  if (kind === "kitchen")
    return {
      id: "/cuisine",
      name: `${s.business.name} – Cuisine`,
      short_name: "Cuisine",
      description: "Écran des commandes à préparer",
      start_url: "/cuisine",
      scope: "/cuisine",
      display: "standalone",
      orientation: "any",
      background_color: "#F5F5F4",
      theme_color: "#1F4D3A",
      lang: "fr",
      icons,
    };
  return {
    id: "/",
    name: s.business.name,
    short_name: s.business.name.slice(0, 12),
    description: s.business.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F6EFE4",
    theme_color: "#1F4D3A",
    lang: "fr",
    icons,
  };
}
