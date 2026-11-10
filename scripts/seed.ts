import "dotenv/config";
import { getDb, closeDb, schema } from "../src/db";
import { runMigrations } from "../src/db/migrate";
import { seed, seedProduction, truncateAll } from "../src/db/seed-data";
import { passwordProblem } from "../src/server/auth";

async function main() {
  await runMigrations();
  const db = getDb();
  const reset = process.argv.includes("--reset");
  const existing = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (existing.length && !reset) {
    console.log("ℹ La base contient déjà des données. Utilisez `npm run db:seed -- --reset` pour tout réinitialiser (⚠ efface tout).");
    return;
  }
  if (reset) await truncateAll(db);

  if (process.argv.includes("--prod")) {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Définissez SEED_ADMIN_EMAIL (email du propriétaire).");
    if (!password || password === "ChangezMoi-2026!") throw new Error("Définissez SEED_ADMIN_PASSWORD avec un mot de passe personnel.");
    const pb = passwordProblem(password);
    if (pb) throw new Error(pb);
    await seedProduction(db, { adminEmail: email, adminPassword: password });
    console.log("✓ Installation de production prête (sans données de démonstration)");
    console.log(`  Administrateur : ${email} → /admin`);
    console.log("  Les commandes sont en PAUSE : ajoutez vos plats, horaires, zones et profils cuisine, puis rouvrez-les dans « Horaires & créneaux ».");
    return;
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@chezjulie.fr";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangezMoi-2026!";
  await seed(db, { adminEmail, adminPassword });
  console.log("✓ Données de démonstration créées");
  console.log(`  Admin   : ${adminEmail} / ${adminPassword}   → http://localhost:3000/admin`);
  console.log("  Cuisine : profil « Awa », code 2580            → http://localhost:3000/cuisine");
  console.log("  ⚠ Changez ces accès avant la mise en ligne.");
}

main()
  .then(() => closeDb())
  .catch(async (e) => {
    console.error(e);
    await closeDb();
    process.exit(1);
  });
