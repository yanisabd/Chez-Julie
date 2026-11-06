import { ImageResponse } from "next/og";
import { getSettings } from "@/server/settings";
import { ICON_DATA_URI } from "@/lib/brand-icon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Cuisine africaine faite maison";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image affichée quand le lien du site est partagé (WhatsApp, Facebook, Instagram, SMS…). */
export default async function OgImage() {
  const s = await getSettings();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "white",
          background: "linear-gradient(120deg, #102a1f 0%, #1F4D3A 35%, #9A4122 70%, #E0A526 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={ICON_DATA_URI} width={96} height={96} style={{ borderRadius: 24 }} />
          <div style={{ fontSize: 56, fontWeight: 700 }}>{s.business.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1, maxWidth: 950 }}>{s.business.tagline}</div>
          <div style={{ fontSize: 34, marginTop: 24, color: "#FBEFD2" }}>Commandez en ligne · Retrait ou livraison à l’heure choisie</div>
        </div>
        <div style={{ display: "flex", height: 14, width: "100%" }}>
          <div style={{ flex: 3, background: "#B9532F" }} />
          <div style={{ flex: 2, background: "#E0A526" }} />
          <div style={{ flex: 2, background: "#F6EFE4" }} />
          <div style={{ flex: 3, background: "#E0A526" }} />
        </div>
      </div>
    ),
    size,
  );
}
