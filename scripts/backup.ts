import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getDb, closeDb } from "../src/db";
import { exportAll } from "../src/server/backup";

/**
 * Sauvegarde complète en JSON dans ./backups (à planifier chaque jour, cf. README).
 * Conserve les 30 dernières sauvegardes.
 * ⚠ En local (base embarquée), arrêtez le serveur avant de lancer ce script.
 */
async function main() {
  const dir = path.resolve(process.env.BACKUP_DIR ?? "./backups");
  fs.mkdirSync(dir, { recursive: true });
  const data = await exportAll(getDb());
  const file = path.join(dir, `sauvegarde-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(data));
  const counts = Object.entries(data.tables).map(([t, r]) => `${t}:${r.length}`).join(" ");
  console.log(`✓ Sauvegarde écrite : ${file}\n  ${counts}`);
  const files = fs.readdirSync(dir).filter((f) => f.startsWith("sauvegarde-")).sort();
  for (const f of files.slice(0, Math.max(0, files.length - 30))) fs.unlinkSync(path.join(dir, f));
}

main()
  .then(() => closeDb())
  .catch(async (e) => {
    console.error("✗ Échec de la sauvegarde", e);
    await closeDb();
    process.exit(1);
  });
