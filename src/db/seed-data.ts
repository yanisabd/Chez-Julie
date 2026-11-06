import { sql } from "drizzle-orm";
import { schema, type DB } from "./index";
import { hashSecret } from "@/server/auth";
import { saveSettings } from "@/server/settings";
import { defaultSettings } from "@/lib/settings-schema";
import { slugify } from "@/lib/format";

type ProductSeed = {
  name: string;
  cat: string;
  price: number;
  description: string;
  ingredients: string;
  allergens: string[];
  spicy?: number;
  featured?: boolean;
  stock?: number | null;
  daily?: number | null;
  alert?: number | null;
  maxPerOrder?: number | null;
  days?: number[];
  options?: { name: string; required: boolean; max: number; choices: [string, number][] }[];
  recipe?: [string, number][];
};

const CATEGORIES = [
  { name: "Plats africains", description: "Nos grands classiques mijotés comme à la maison." },
  { name: "Grillades", description: "Braisé au charbon, marinades maison." },
  { name: "Accompagnements", description: "Pour compléter votre assiette." },
  { name: "Menus & formules", description: "Plat + accompagnement + boisson, le bon plan." },
  { name: "Desserts", description: "Une touche sucrée pour finir." },
  { name: "Boissons", description: "Jus naturels faits maison." },
];

const ACCOMP = { name: "Accompagnement", required: true, max: 1, choices: [["Riz blanc", 0], ["Attiéké", 0.5], ["Alloco (bananes plantain)", 1], ["Foutou banane", 1]] as [string, number][] };
const PIMENT = { name: "Piment", required: true, max: 1, choices: [["Sans piment", 0], ["Doux", 0], ["Fort 🌶️", 0]] as [string, number][] };

const PRODUCTS: ProductSeed[] = [
  {
    name: "Mafé de bœuf",
    cat: "Plats africains",
    price: 13.5,
    featured: true,
    description: "Bœuf fondant mijoté dans une sauce onctueuse à la pâte d’arachide, carottes et patate douce. Le réconfort sénégalais par excellence.",
    ingredients: "Bœuf, pâte d’arachide, tomate, oignon, carotte, patate douce, ail, piment, bouillon.",
    allergens: ["arachides", "celeri"],
    spicy: 1,
    daily: 20,
    options: [ACCOMP, PIMENT],
    recipe: [["Bœuf", 180], ["Pâte d’arachide", 60], ["Riz", 150]],
  },
  {
    name: "Poulet yassa",
    cat: "Plats africains",
    price: 12.5,
    featured: true,
    description: "Poulet mariné au citron vert puis mijoté avec une montagne d’oignons confits et olives. Acidulé, doux et parfumé.",
    ingredients: "Poulet fermier, oignons, citron vert, moutarde, olives, ail, poivre.",
    allergens: ["moutarde"],
    daily: 20,
    options: [ACCOMP, PIMENT],
    recipe: [["Poulet", 250], ["Oignons", 150], ["Riz", 150]],
  },
  {
    name: "Thiéboudienne",
    cat: "Plats africains",
    price: 15,
    description: "Le plat national sénégalais : riz cassé au poisson, cuit dans un bouillon de tomate avec légumes (chou, manioc, aubergine).",
    ingredients: "Poisson (thiof ou dorade), riz brisé, tomate, chou, manioc, aubergine, carotte, persil, ail.",
    allergens: ["poissons"],
    spicy: 1,
    daily: 12,
    days: [5, 6, 7],
    options: [PIMENT],
    recipe: [["Poisson", 200], ["Riz", 180]],
  },
  {
    name: "Poulet DG",
    cat: "Plats africains",
    price: 14,
    description: "Spécialité camerounaise : poulet sauté avec bananes plantain mûres, poivrons, carottes et haricots verts.",
    ingredients: "Poulet, banane plantain, poivron, carotte, haricots verts, tomate, oignon, ail, gingembre.",
    allergens: ["celeri"],
    daily: 15,
    options: [PIMENT],
    recipe: [["Poulet", 250]],
  },
  {
    name: "Ndolé crevettes & bœuf",
    cat: "Plats africains",
    price: 16,
    description: "Feuilles de ndolé mijotées à la pâte d’arachide, bœuf et crevettes. Servi avec miondo ou plantain.",
    ingredients: "Feuilles de ndolé, arachides, bœuf, crevettes, oignon, ail, huile.",
    allergens: ["arachides", "crustaces"],
    daily: 10,
    days: [6, 7],
    recipe: [["Bœuf", 120], ["Pâte d’arachide", 50]],
  },
  {
    name: "Attiéké poisson braisé",
    cat: "Grillades",
    price: 15.5,
    featured: true,
    description: "Poisson entier braisé, mariné aux épices, servi avec attiéké, oignons et tomates fraîches. Un incontournable ivoirien.",
    ingredients: "Poisson (tilapia ou bar), attiéké (semoule de manioc), oignon, tomate, citron, épices.",
    allergens: ["poissons"],
    spicy: 2,
    daily: 10,
    options: [PIMENT],
    recipe: [["Poisson", 400]],
  },
  {
    name: "Brochettes suya",
    cat: "Grillades",
    price: 11,
    description: "Brochettes de bœuf marinées au yaji (épices et cacahuète grillée), oignons rouges et tomates.",
    ingredients: "Bœuf, épices yaji, arachides, gingembre, oignon rouge, tomate.",
    allergens: ["arachides"],
    spicy: 2,
    daily: 25,
    options: [PIMENT],
    recipe: [["Bœuf", 160]],
  },
  {
    name: "Poulet braisé",
    cat: "Grillades",
    price: 12,
    description: "Demi-poulet mariné 24 h puis braisé, sauce oignon-tomate pimentée.",
    ingredients: "Poulet, oignon, ail, gingembre, moutarde, épices, piment.",
    allergens: ["moutarde"],
    spicy: 1,
    daily: 15,
    options: [ACCOMP, PIMENT],
    recipe: [["Poulet", 450]],
  },
  { name: "Alloco", cat: "Accompagnements", price: 4, description: "Bananes plantain mûres frites, dorées et fondantes.", ingredients: "Banane plantain, huile, sel.", allergens: [] },
  { name: "Riz jollof", cat: "Accompagnements", price: 4.5, description: "Riz cuit dans une sauce tomate épicée, à la nigériane.", ingredients: "Riz, tomate, poivron, oignon, épices.", allergens: ["celeri"], recipe: [["Riz", 150]] },
  { name: "Attiéké", cat: "Accompagnements", price: 3.5, description: "Semoule de manioc fermentée, légère et acidulée.", ingredients: "Manioc.", allergens: [] },
  {
    name: "Formule Mafé",
    cat: "Menus & formules",
    price: 17.5,
    featured: true,
    description: "Mafé de bœuf + accompagnement au choix + boisson maison 33 cl.",
    ingredients: "Voir le détail du mafé et des boissons.",
    allergens: ["arachides", "celeri"],
    daily: 10,
    options: [ACCOMP, { name: "Boisson", required: true, max: 1, choices: [["Bissap", 0], ["Gingembre", 0], ["Bouye (baobab)", 0.5]] }],
    recipe: [["Bœuf", 180], ["Pâte d’arachide", 60], ["Riz", 150]],
  },
  {
    name: "Formule Yassa",
    cat: "Menus & formules",
    price: 16.5,
    description: "Poulet yassa + accompagnement au choix + boisson maison 33 cl.",
    ingredients: "Voir le détail du yassa et des boissons.",
    allergens: ["moutarde"],
    daily: 10,
    options: [ACCOMP, { name: "Boisson", required: true, max: 1, choices: [["Bissap", 0], ["Gingembre", 0], ["Bouye (baobab)", 0.5]] }],
    recipe: [["Poulet", 250], ["Oignons", 150], ["Riz", 150]],
  },
  { name: "Thiakry", cat: "Desserts", price: 4.5, description: "Couscous de mil au yaourt sucré, vanille et muscade.", ingredients: "Mil, yaourt, lait concentré, sucre, vanille, muscade.", allergens: ["lait"], stock: 20, alert: 5 },
  { name: "Beignets puff-puff", cat: "Desserts", price: 4, description: "6 beignets moelleux saupoudrés de sucre.", ingredients: "Farine de blé, levure, sucre, muscade, huile.", allergens: ["gluten"], stock: 30, alert: 6 },
  { name: "Bissap maison 50 cl", cat: "Boissons", price: 3.5, description: "Infusion glacée de fleurs d’hibiscus, menthe et vanille.", ingredients: "Hibiscus, sucre, menthe, vanille.", allergens: [], stock: 40, alert: 8, maxPerOrder: 10 },
  { name: "Jus de gingembre 50 cl", cat: "Boissons", price: 3.5, description: "Gingembre frais pressé, citron et ananas. Ça pique !", ingredients: "Gingembre, citron, ananas, sucre.", allergens: [], stock: 40, alert: 8, maxPerOrder: 10 },
  { name: "Bouye (jus de baobab) 50 cl", cat: "Boissons", price: 4, description: "Jus onctueux de pain de singe, lait et vanille.", ingredients: "Fruit du baobab, lait, sucre, vanille.", allergens: ["lait"], stock: 20, alert: 5, maxPerOrder: 10 },
];

const INGREDIENTS: [string, string, number, number][] = [
  // nom, unité, stock, seuil d'alerte
  ["Bœuf", "g", 8000, 1500],
  ["Poulet", "g", 10000, 2000],
  ["Poisson", "g", 6000, 1200],
  ["Riz", "g", 15000, 3000],
  ["Oignons", "g", 6000, 1000],
  ["Pâte d’arachide", "g", 3000, 500],
];

export async function seed(db: DB, opts: { adminEmail: string; adminPassword: string; withDemo?: boolean }) {
  const s = defaultSettings();
  s.notifications.adminEmail = opts.adminEmail;
  s.business.announcement = "🎉 -10 % sur votre première commande avec le code BIENVENUE10";
  await saveSettings(s, db);

  await db.insert(schema.users).values({ role: "admin", name: "Propriétaire", email: opts.adminEmail.toLowerCase(), passwordHash: await hashSecret(opts.adminPassword) });
  await db.insert(schema.users).values({ role: "kitchen", name: "Awa", pinHash: await hashSecret("2580") });

  const catIds = new Map<string, number>();
  for (const [i, c] of CATEGORIES.entries()) {
    const [row] = await db.insert(schema.categories).values({ ...c, position: i }).returning();
    catIds.set(c.name, row.id);
  }

  const ingIds = new Map<string, number>();
  for (const [name, unit, stock, alert] of INGREDIENTS) {
    const [row] = await db.insert(schema.ingredients).values({ name, unit, stock, alertThreshold: alert }).returning();
    ingIds.set(name, row.id);
  }

  for (const [i, p] of PRODUCTS.entries()) {
    const [row] = await db
      .insert(schema.products)
      .values({
        categoryId: catIds.get(p.cat)!,
        name: p.name,
        slug: slugify(p.name),
        description: p.description,
        ingredientsText: p.ingredients,
        allergens: p.allergens,
        priceCents: Math.round(p.price * 100),
        featured: p.featured ?? false,
        spicy: p.spicy ?? 0,
        availableDays: p.days ?? [],
        stockQty: p.stock ?? null,
        alertThreshold: p.alert ?? null,
        dailyLimit: p.daily ?? null,
        maxPerOrder: p.maxPerOrder ?? null,
        position: i,
      })
      .returning();
    for (const [gi, g] of (p.options ?? []).entries()) {
      const [grp] = await db.insert(schema.optionGroups).values({ productId: row.id, name: g.name, required: g.required, maxChoices: g.max, position: gi }).returning();
      await db.insert(schema.options).values(g.choices.map(([name, delta], oi) => ({ groupId: grp.id, name, priceDeltaCents: Math.round(delta * 100), position: oi })));
    }
    for (const [ing, qty] of p.recipe ?? []) {
      await db.insert(schema.recipeItems).values({ productId: row.id, ingredientId: ingIds.get(ing)!, quantity: qty });
    }
  }

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
