import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** Largeurs autorisées (évite de générer des milliers de variantes). */
const WIDTHS = [160, 320, 480, 640, 800, 1200];

// Petit cache mémoire des variantes redimensionnées (le CDN de l'hébergeur met aussi en cache)
const g = globalThis as unknown as { __imgCache?: Map<string, { data: Buffer; mime: string }> };
const cache = (g.__imgCache ??= new Map());
const MAX_CACHE = 150;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const wParam = Number(new URL(req.url).searchParams.get("w"));
  const w = WIDTHS.includes(wParam) ? wParam : null;
  const key = `${id}:${w ?? "orig"}`;

  let hit = cache.get(key);
  if (!hit) {
    const img = await db.query.images.findFirst({ where: eq(schema.images.id, id) });
    if (!img) return new Response("Not found", { status: 404 });
    let data = Buffer.from(img.data);
    let mime = img.mime;
    if (w) {
      try {
        const sharp = (await import("sharp")).default;
        data = await sharp(data).resize({ width: w, height: w, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        mime = "image/webp";
      } catch {
        /* sharp indisponible : on sert l'original */
      }
    }
    hit = { data, mime };
    cache.set(key, hit);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
  }

  return new Response(new Uint8Array(hit.data), {
    headers: {
      "Content-Type": hit.mime,
      "Content-Length": String(hit.data.length),
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
