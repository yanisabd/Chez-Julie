import { sql } from "drizzle-orm";
import { schema, type DB } from "./index";
import { hashSecret } from "@/server/auth";
import { saveSettings } from "@/server/settings";
import { defaultSettings } from "@/lib/settings-schema";
import { seedCarte } from "./carte";

export async function seed(db: DB, opts: { adminEmail: string; adminPassword: string; withDemo?: boolean }) {
  const s = defaultSettings();
  s.notifications.adminEmail = opts.adminEmail;
  s.business.announcement = "🎉 -10 % sur votre première commande avec le code BIENVENUE10";
  await saveSettings(s, db);

  await db.insert(schema.users).values({ role: "admin", name: "Propriétaire", email: opts.adminEmail.toLowerCase(), passwordHash: await hashSecret(opts.adminPassword) });
  await db.insert(schema.users).values({ role: "kitchen", name: "Awa", pinHash: await hashSecret("2580") });

  await seedCarte(db);

  await db.insert(schema.deliveryZones).values([
    { name: "Zone 1 – Proximité", postalCodes: ["75011", "75012", "75020"], cities: [], feeCents: 250, minOrderCents: 1500, freeAboveCents: 4000 },
    { name: "Zone 2 – Proche banlieue", postalCodes: ["93100", "93170", "94300", "94160"], cities: [], feeCents: 490, minOrderCents: 2500, freeAboveCents: 6000 },
  ]);

  await db.insert(schema.promoCodes).values({ code: "BIENVENUE10", kind: "percent", value: 10, minOrderCents: 1500 });
}

/**
 * Installation de production : uniquement les réglages par défaut et le compte administrateur.
 * Aucune donnée de démonstration (plats, zones, codes promo, profil cuisine).
 */
export async function seedProduction(db: DB, opts: { adminEmail: string; adminPassword: string }) {
  const s = defaultSettings();
  s.notifications.adminEmail = opts.adminEmail;
  s.business.email = opts.adminEmail;
  s.business.phone = "";
  s.business.pickupAddress = "";
  s.business.pickupInstructions = "";
  s.ordering.deliveryEnabled = false; // à activer une fois les zones de livraison créées
  s.ordering.paused = true; // le site ouvre aux commandes quand le propriétaire le décide
  s.ordering.pauseMessage = "Ouverture très bientôt ! Les commandes ne sont pas encore ouvertes.";
  await saveSettings(s, db);
  await db.insert(schema.users).values({ role: "admin", name: "Propriétaire", email: opts.adminEmail.toLowerCase(), passwordHash: await hashSecret(opts.adminPassword) });
}

/** Vide toutes les tables (utilisé par les tests et `npm run db:seed -- --reset`). */
export async function truncateAll(db: DB) {
  await db.execute(sql`
    TRUNCATE users, sessions, password_resets, rate_limits, images, categories, products, option_groups, options,
      ingredients, recipe_items, stock_movements, product_day_usage, day_usage, slots, closures, delivery_zones,
      promo_codes, orders, order_items, order_events, payments, refunds, webhook_events, notifications, settings,
      audit_logs, system_logs RESTART IDENTITY CASCADE`);
  await db.execute(sql`ALTER SEQUENCE order_number_seq RESTART WITH 1001`);
}
