import "dotenv/config";
import { getDb, closeDb, schema } from "../src/db";
import { runMigrations } from "../src/db/migrate";
import { seedCarte } from "../src/db/carte";

/**
 * Importe la carte de départ (plats, photos, options, recettes) dans une base sans plats.
 * N'ajoute aucune donnée de démonstration (comptes, zones, codes promo).
 * Usage : DOTENV_CONFIG_PATH=.env.neon npm run import:carte
 */
async function main() {
  await runMigrations();
  const db = getDb();
  const existing = await db.select({ id: schema.products.id }).from(schema.products).limit(1);
  if (existing.length) {
    console.log("ℹ Des plats existent déjà : import annulé pour ne rien écraser. Gérez la carte depuis l’administration.");
    return;
  }
  await seedCarte(db);
  const n = await db.select({ id: schema.products.id }).from(schema.products);
  console.log(`✓ Carte importée : ${n.length} plats avec leurs photos. Vérifiez les prix et allergènes dans Admin → Plats & catégories.`);
}

main()
  .then(() => closeDb())
  .catch(async (e) => {
    console.error("✗", e);
    await closeDb();
    process.exit(1);
  });
