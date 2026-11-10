import { db } from "@/db";
import { getCurrentUser } from "@/server/auth";
import { exportAll } from "@/server/backup";
import { audit } from "@/server/log";

/** Téléchargement d'une sauvegarde complète (administrateur uniquement). */
export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return new Response("Non autorisé", { status: 401 });
  const backup = await exportAll(db);
  await audit({ id: user.id, label: user.name }, "backup.download", "backup");
  return new Response(JSON.stringify(backup), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="sauvegarde-chez-julie-${new Date().toISOString().slice(0, 16).replace(":", "h")}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
