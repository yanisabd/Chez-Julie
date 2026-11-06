import "dotenv/config";
import { runMigrations } from "../src/db/migrate";
import { closeDb } from "../src/db";

runMigrations()
  .then(async () => {
    console.log("✓ Base de données à jour");
    await closeDb();
  })
  .catch(async (e) => {
    console.error("✗ Échec de la migration", e);
    await closeDb();
    process.exit(1);
  });
