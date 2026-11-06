import { ImageResponse } from "next/og";
import { IconImage } from "@/lib/brand-icon";

/** Icônes PNG de l'application installable : /api/app-icon/192, /512, /512-maskable */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const maskable = size.endsWith("-maskable");
  const n = Number(size.replace("-maskable", ""));
  if (![192, 512].includes(n)) return new Response("Not found", { status: 404 });
  const img = new ImageResponse(<IconImage size={n} maskable={maskable} />, { width: n, height: n });
  img.headers.set("Cache-Control", "public, max-age=604800");
  return img;
}
