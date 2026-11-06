import { buildManifest } from "@/server/manifest";

/** L'écran cuisine s'installe comme une application à part entière sur la tablette. */
export async function GET() {
  return Response.json(await buildManifest("kitchen"), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
