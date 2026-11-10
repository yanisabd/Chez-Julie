import fs from "node:fs";
import path from "node:path";
import { schema, type DB } from "./index";
import { slugify } from "@/lib/format";

/**
 * Carte de départ : les plats réellement cuisinés, avec leurs photos (dossier assets/plats).
 * Les prix et allergènes sont indicatifs : à vérifier et ajuster dans l'administration.
 */

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
  /** Photo principale puis photos de la galerie (noms de fichiers sans extension) */
  photos?: string[];
};

export const CATEGORIES = [
  { name: "Plats", description: "Mijotés et préparés à la commande, comme à la maison." },
  { name: "Grillades", description: "Braisés et grillés, marinades maison." },
  { name: "Accompagnements", description: "Pour compléter votre assiette." },
  { name: "Menus & formules", description: "Les bons assortiments, à petit prix." },
  { name: "Desserts", description: "Une touche sucrée pour finir." },
  { name: "Boissons", description: "Jus naturels faits maison." },
];

const ACCOMP = {
  name: "Accompagnement",
  required: true,
  max: 1,
  choices: [
    ["Alloco (bananes plantain)", 0],
    ["Riz blanc", 0],
    ["Salade avocat & maïs", 1.5],
  ] as [string, number][],
};
const PIMENT = { name: "Piment", required: true, max: 1, choices: [["Sans piment", 0], ["Doux", 0], ["Fort 🌶️", 0]] as [string, number][] };
const BOISSON = { name: "Boisson", required: true, max: 1, choices: [["Bissap", 0], ["Gingembre", 0], ["Bouye (baobab)", 0.5]] as [string, number][] };

export const PRODUCTS: ProductSeed[] = [
  // ---------------------------------------------------------------- Grillades
  {
    name: "Poulet braisé aux poivrons",
    cat: "Grillades",
    price: 8,
    featured: true,
    description: "Morceaux de poulet marinés, braisés et caramélisés, puis sautés aux poivrons, oignons et herbes fraîches.",
    ingredients: "Poulet, poivrons rouges et verts, oignons, ail, persil, moutarde, épices.",
    allergens: ["moutarde"],
    spicy: 1,
    daily: 15,
    options: [ACCOMP, PIMENT],
    recipe: [["Poulet", 350]],
    photos: ["poulet-braise-1", "poulet-braise-2"],
  },
  {
    name: "Pilons de poulet grillés",
    cat: "Grillades",
    price: 8,
    featured: true,
    description: "Pilons de poulet marinés aux épices puis grillés jusqu’à être bien dorés, servis avec poivrons et oignon rouge.",
    ingredients: "Poulet, poivrons, oignon rouge, ail, gingembre, épices.",
    allergens: [],
    daily: 20,
    options: [ACCOMP, PIMENT],
    recipe: [["Poulet", 300]],
    photos: ["pilons-1", "pilons-2"],
  },
  {
    name: "Poisson braisé entier",
    cat: "Grillades",
    price: 9.5,
    featured: true,
    description: "Tilapia entier mariné aux épices et braisé, servi sur un lit de salade avec oignons rouges, poivrons et citron.",
    ingredients: "Tilapia, oignon rouge, poivrons, salade, citron, ail, moutarde, épices.",
    allergens: ["poissons", "moutarde"],
    spicy: 1,
    daily: 10,
    options: [ACCOMP, PIMENT],
    recipe: [["Poisson", 450]],
    photos: ["poisson-braise-1", "poisson-braise-2", "poisson-braise-3"],
  },
  // ---------------------------------------------------------------- Plats
  {
    name: "Pilons de poulet & riz parfumé",
    cat: "Plats",
    price: 8,
    featured: true,
    description: "Pilons de poulet marinés puis dorés, servis avec un riz blanc parfumé, lamelles de poivrons et d’oignon rouge.",
    ingredients: "Poulet, riz, poivrons, oignon rouge, ail, gingembre, épices.",
    allergens: [],
    daily: 20,
    options: [{ name: "Sauce", required: true, max: 1, choices: [["Sans sauce", 0], ["Sauce pimentée maison", 0]] }],
    recipe: [["Poulet", 300], ["Riz", 150]],
    photos: ["pilons-riz-1", "pilons-riz-2", "pilons-riz-3", "pilons-riz-4"],
  },
  {
    name: "Poisson en sauce",
    cat: "Plats",
    price: 9.5,
    featured: true,
    description: "Poisson mijoté dans un bouillon doré aux oignons, tomate et herbes fraîches. Le court-bouillon comme à la maison.",
    ingredients: "Poisson, oignons, tomate, ail, céleri, persil, épices.",
    allergens: ["poissons", "celeri"],
    daily: 12,
    options: [ACCOMP],
    recipe: [["Poisson", 350]],
    photos: ["poisson-sauce-1", "poisson-sauce-2"],
  },
  // ---------------------------------------------------------------- Accompagnements (seuls)
  {
    name: "Alloco",
    cat: "Accompagnements",
    price: 3,
    featured: true,
    description: "Bananes plantain bien mûres, frites et caramélisées : dorées dehors, fondantes dedans.",
    ingredients: "Banane plantain, huile, sel.",
    allergens: [],
    photos: ["alloco-1", "alloco-2", "alloco-3"],
  },
  {
    name: "Riz blanc parfumé",
    cat: "Accompagnements",
    price: 2.5,
    description: "Riz blanc parfumé, léger et bien détaché, avec quelques lamelles de poivrons et d’oignon rouge.",
    ingredients: "Riz, poivrons, oignon rouge, sel.",
    allergens: [],
    recipe: [["Riz", 150]],
    photos: ["riz-1"],
  },
  {
    name: "Épinards sautés",
    cat: "Accompagnements",
    price: 3,
    description: "Épinards fondants sautés aux oignons et à la cébette, dans un bouillon doux et parfumé.",
    ingredients: "Épinards, oignons, cébette, huile, épices.",
    allergens: [],
    photos: ["epinards-1", "epinards-2"],
  },
  {
    name: "Salade avocat & maïs",
    cat: "Accompagnements",
    price: 3,
    description: "Laitue croquante, avocat, maïs, poivron rouge et cébette, nappés d’une sauce crémeuse maison.",
    ingredients: "Laitue, avocat, maïs, poivron rouge, cébette, sauce maison (œuf, moutarde, huile).",
    allergens: ["oeufs", "moutarde"],
    photos: ["salade-1", "salade-2", "salade-3"],
  },
  // ---------------------------------------------------------------- Formules
  {
    name: "Formule Poulet braisé, épinards & alloco",
    cat: "Menus & formules",
    price: 15.5,
    featured: true,
    description: "Le grand classique : poulet braisé aux poivrons, épinards sautés, alloco et une boisson maison.",
    ingredients: "Voir le détail de chaque plat.",
    allergens: ["moutarde"],
    spicy: 1,
    daily: 10,
    options: [PIMENT, BOISSON],
    recipe: [["Poulet", 350]],
    photos: ["formule-poulet-epinards-alloco", "ensemble-poulet-epinards-alloco", "ensemble-poulet-epinards", "poulet-braise-3"],
  },
  {
    name: "Formule Poisson en sauce & riz",
    cat: "Menus & formules",
    price: 14,
    description: "Poisson en sauce, riz blanc parfumé et une boisson maison.",
    ingredients: "Voir le détail de chaque plat.",
    allergens: ["poissons", "celeri"],
    daily: 10,
    options: [BOISSON],
    recipe: [["Poisson", 350], ["Riz", 150]],
    photos: ["formule-poisson-sauce-riz", "poisson-sauce-1", "riz-1"],
  },
  {
    name: "Formule Poisson braisé & épinards",
    cat: "Menus & formules",
    price: 14.5,
    description: "Poisson braisé entier, épinards sautés et une boisson maison.",
    ingredients: "Voir le détail de chaque plat.",
    allergens: ["poissons", "moutarde"],
    spicy: 1,
    daily: 8,
    options: [PIMENT, BOISSON],
    recipe: [["Poisson", 450]],
    photos: ["formule-poisson-braise-epinards", "poisson-braise-2", "epinards-1"],
  },
  // ---------------------------------------------------------------- Desserts
  {
    name: "Beignets maison",
    cat: "Desserts",
    price: 4.5,
    description: "8 beignets moelleux et dorés, légèrement sucrés. Parfaits pour finir le repas… ou pour le goûter.",
    ingredients: "Farine de blé, levure, sucre, eau, huile.",
    allergens: ["gluten"],
    daily: 25,
    photos: ["beignets-1", "beignets-2"],
  },
  // ---------------------------------------------------------------- Boissons
  { name: "Bissap maison 50 cl", cat: "Boissons", price: 3.5, description: "Infusion glacée de fleurs d’hibiscus, menthe et vanille.", ingredients: "Hibiscus, sucre, menthe, vanille.", allergens: [], stock: 40, alert: 8, maxPerOrder: 10 },
  { name: "Jus de gingembre 50 cl", cat: "Boissons", price: 3.5, description: "Gingembre frais pressé, citron et ananas. Ça pique !", ingredients: "Gingembre, citron, ananas, sucre.", allergens: [], stock: 40, alert: 8, maxPerOrder: 10 },
  { name: "Bouye (jus de baobab) 50 cl", cat: "Boissons", price: 4, description: "Jus onctueux de pain de singe, lait et vanille.", ingredients: "Fruit du baobab, lait, sucre, vanille.", allergens: ["lait"], stock: 20, alert: 5, maxPerOrder: 10 },
];

export const INGREDIENTS: [string, string, number, number][] = [
  // nom, unité, stock (g), seuil d'alerte
  ["Poulet", "g", 10000, 2000],
  ["Poisson", "g", 8000, 1500],
  ["Riz", "g", 15000, 3000],
  ["Oignons", "g", 6000, 1000],
];

/** Dossier des photos préparées (scripts/process-photos.ts). */
export const PHOTOS_DIR = path.resolve(process.cwd(), "assets/plats");

/** Crée catégories, ingrédients et plats (avec photos et galeries). */
export async function seedCarte(db: DB) {
  const imageIds = new Map<string, string>();
  const photo = async (name: string) => {
    if (imageIds.has(name)) return imageIds.get(name)!;
    const file = path.join(PHOTOS_DIR, `${name}.webp`);
    if (!fs.existsSync(file)) return null;
    const [row] = await db.insert(schema.images).values({ data: new Uint8Array(fs.readFileSync(file)), mime: "image/webp" }).returning({ id: schema.images.id });
    imageIds.set(name, row.id);
    return row.id;
  };

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
    const ids = (await Promise.all((p.photos ?? []).map(photo))).filter((x): x is string => !!x);
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
        imageId: ids[0] ?? null,
        galleryImageIds: ids.slice(1),
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
}
