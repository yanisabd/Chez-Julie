import { NextResponse } from "next/server";
import { runMaintenance } from "@/server/maintenance";

/**
 * Tâche planifiée (toutes les 5 minutes, cf. vercel.json) :
 * libère les réservations expirées, renvoie les emails en échec, anonymise les vieilles données.
 * Le site déclenche aussi ces tâches tout seul à chaque visite : cette route est une sécurité supplémentaire.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  await runMaintenance(true);
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
