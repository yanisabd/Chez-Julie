import { buildManifest } from "@/server/manifest";

export async function GET() {
  return Response.json(await buildManifest("shop"), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
