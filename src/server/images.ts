import { db, schema } from "@/db";
import { UserError } from "./action";

const MAX = 8 * 1024 * 1024;

/**
 * Enregistre une photo : vérifie qu'il s'agit bien d'une image, la redimensionne (1200 px max)
 * et la convertit en WebP pour un site rapide sur mobile. Retourne l'identifiant.
 */
export async function saveImage(file: File): Promise<string> {
  if (file.size > MAX) throw new UserError("La photo est trop lourde (8 Mo maximum).");
  if (!["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type)) throw new UserError("Format de photo non accepté (JPEG, PNG ou WebP).");
  const input = Buffer.from(await file.arrayBuffer());
  let data: Buffer;
  let mime = "image/webp";
  try {
    const sharp = (await import("sharp")).default;
    data = await sharp(input).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch {
    // sharp indisponible : on garde l'original après une vérification minimale de la signature
    const sig = input.subarray(0, 12).toString("hex");
    const ok = sig.startsWith("ffd8ff") || sig.startsWith("89504e47") || (sig.startsWith("52494646") && input.subarray(8, 12).toString() === "WEBP");
    if (!ok) throw new UserError("Ce fichier n’est pas une image valide.");
    if (file.size > 3 * 1024 * 1024) throw new UserError("La photo est trop lourde (3 Mo maximum).");
    data = input;
    mime = file.type;
  }
  const [row] = await db.insert(schema.images).values({ data: new Uint8Array(data), mime }).returning({ id: schema.images.id });
  return row.id;
}
