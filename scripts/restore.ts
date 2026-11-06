import "dotenv/config";
import fs from "node:fs";
import readline from "node:readline/promises";
import { getDb, closeDb } from "../src/db";
import { runMigrations } from "../src/db/migrate";
import { restoreAll, type Backup } from "../src/server/backup";

/** Usage : npm run restore -- chemin/vers/sauvegarde.json [--yes] */
async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!file || !fs.existsSync(file)) throw new Error("Indiquez le fichier de sauvegarde : npm run restore -- backups/sauvegarde-xxx.json");
  const backup = JSON.parse(fs.readFileSync(file, "utf8")) as Backup;
  console.log(`Sauvegarde du ${backup.createdAt} – ${backup.tables.orders?.length ?? 0} commandes, ${backup.tables.products?.length ?? 0} plats.`);
  if (!process.argv.includes("--yes")) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question("⚠ Toutes les données actuelles seront REMPLACÉES. Taper « RESTAURER » pour confirmer : ");
    rl.close();
    if (answer.trim() !== "RESTAURER") return console.log("Annulé.");
  }
  await runMigrations();
  await restoreAll(getDb(), backup);
  console.log("✓ Restauration terminée.");
}

main()
  .then(() => closeDb())
  .catch(async (e) => {
    console.error("✗", e instanceof Error ? e.message : e);
    await closeDb();
    process.exit(1);
  });
