/**
 * Test de bout en bout dans un vrai navigateur (Edge ou Chrome installé sur la machine).
 * Prérequis : serveur lancé (npm run dev) avec les données de démonstration, en mode démo (sans Stripe).
 * Usage : npm run e2e   (captures d'écran dans ./e2e-screens ou E2E_SCREENS)
 */
import { chromium, type Page } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.E2E_URL ?? "http://localhost:3000";
const OUT = path.resolve(process.env.E2E_SCREENS ?? "./e2e-screens");
const BROWSER =
  process.env.E2E_BROWSER ??
  ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) =>
    fs.existsSync(p),
  );

fs.mkdirSync(OUT, { recursive: true });
let step = 0;
/** Jour de service de la commande passée par le client de test (AAAA-MM-JJ). */
let serviceDay = "";
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(OUT, `${String(++step).padStart(2, "0")}-${name}.png`), fullPage: false, caret: "initial" });
const ok = (msg: string) => console.log(`✓ ${msg}`);

async function customer(page: Page) {
  await page.goto(BASE);
  await shot(page, "accueil-mobile");
  await page.goto(`${BASE}/menu`);
  await shot(page, "carte-mobile");
  await page.goto(`${BASE}/plat/poulet-braise-aux-poivrons`);
  await shot(page, "fiche-plat");
  await page.getByRole("button", { name: /^Ajouter/ }).click();
  await page.waitForURL(/\/menu$/);
  ok("Plat avec options ajouté au panier");
  await page.getByRole("button", { name: /Ajouter Bissap/ }).click();
  await page.goto(`${BASE}/panier`);
  await page.getByText("Choisir mon créneau").waitFor();
  await page.waitForFunction(() => !document.querySelector('a[aria-disabled="true"]'));
  await shot(page, "panier");
  await page.getByText("Choisir mon créneau").click();
  await page.waitForURL(/\/commander/);
  await page.getByRole("button", { name: /Retrait/ }).click();
  const slot = page.locator("button:not([disabled])", { hasText: /^\d{2}h\d{2} – \d{2}h\d{2}$/ }).first();
  await slot.waitFor();
  serviceDay = (await slot.getAttribute("data-day")) ?? "";
  await slot.click();
  await shot(page, "choix-creneau");
  await page.getByRole("button", { name: /^Continuer/ }).click();
  await page.fill("#name", "Moussa Traoré");
  await page.fill("#email", "moussa@example.com");
  await page.fill("#phone", "0612345678");
  await page.fill("#kn", "Bien pimenté svp");
  await page.getByRole("button", { name: "Vérifier ma commande" }).click();
  await page.getByPlaceholder("Code promo").fill("BIENVENUE10");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await page.getByText(/Code BIENVENUE10 appliqué/).waitFor();
  ok("Code promo appliqué");
  await page.locator('input[type="checkbox"]').check();
  await shot(page, "verification");
  await page.getByRole("button", { name: /^Payer/ }).click();
  await page.waitForURL(/paiement-demo/);
  await shot(page, "paiement-demo");
  await page.getByRole("button", { name: /simulation/ }).click();
  await page.waitForURL(/\/commande\//);
  await page.getByText(/Commande n°\d+/).first().waitFor();
  await shot(page, "suivi-commande");
  ok("Commande client payée et suivie");
  return page.url();
}

async function kitchen(page: Page) {
  await page.goto(`${BASE}/cuisine/connexion`);
  await shot(page, "cuisine-connexion");
  const awa = page.getByRole("button", { name: "Awa" });
  if (await awa.isVisible().catch(() => false)) await awa.click();
  for (const d of "2580") await page.getByRole("button", { name: d, exact: true }).click();
  await page.waitForURL(/\/cuisine$/);
  // La commande de test peut tomber un autre jour (soir, jour de fermeture) : on ouvre le bon jour
  if (serviceDay) await page.goto(`${BASE}/cuisine?jour=${serviceDay}`);
  await page.getByText("Commencer la préparation").first().waitFor();
  await shot(page, "cuisine-commandes");
  await page.getByText("Commencer la préparation").first().click();
  await page.getByText("Commande prête").first().waitFor();
  ok("Cuisine : commande passée en préparation");
  await page.getByRole("button", { name: /Annuler mon clic/ }).first().click();
  await page.getByText("Commencer la préparation").first().waitFor();
  ok("Cuisine : retour arrière fonctionne");
  await page.getByRole("button", { name: /Un problème/ }).first().click();
  await page.getByRole("button", { name: "Ingrédient manquant" }).click();
  await page.getByRole("button", { name: "Prévenir le responsable" }).click();
  await page.getByText(/Le responsable a été prévenu/).waitFor();
  ok("Cuisine : problème signalé");
  await page.goto(`${BASE}/cuisine/production`);
  await shot(page, "cuisine-quantites");
}

async function admin(page: Page) {
  await page.goto(`${BASE}/admin/connexion`);
  await page.fill("#email", "admin@chezjulie.fr");
  await page.fill("#password", "ChangezMoi-2026!");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/admin$/);
  await page.getByText(/Problème signalé sur la commande/).first().waitFor();
  await shot(page, "admin-tableau-de-bord");
  ok("Admin : connexion + alerte problème visible");
  await page.getByRole("button", { name: "C’est réglé" }).first().click();
  await page.getByText("Marqué comme réglé").waitFor();
  await page.goto(`${BASE}/admin/commandes`);
  await shot(page, "admin-commandes");
  await page.locator('a[href^="/admin/commandes/"]').first().click();
  await page.getByText("Historique").waitFor();
  await shot(page, "admin-commande-detail");
  await page.goto(`${BASE}/admin/menu/1`);
  await page.fill("#price", "13,90");
  await page.getByRole("button", { name: "Enregistrer les modifications" }).click();
  await page.getByText("Plat enregistré ✓").waitFor();
  ok("Admin : prix d’un plat modifié");
  await shot(page, "admin-fiche-plat");
  await page.goto(`${BASE}/admin/planning`);
  await shot(page, "admin-planning");
  await page.goto(`${BASE}/admin/stocks`);
  await shot(page, "admin-stocks");
  await page.goto(`${BASE}/admin/statistiques`);
  await shot(page, "admin-statistiques");
  await page.goto(`${BASE}/admin/emails`);
  await shot(page, "admin-emails");
}

async function main() {
  if (!BROWSER) throw new Error("Aucun navigateur trouvé. Définissez E2E_BROWSER.");
  const browser = await chromium.launch({ executablePath: BROWSER, headless: true });
  const errors: string[] = [];
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p1 = await mobile.newPage();
  p1.on("pageerror", (e) => errors.push(`client: ${e.message}`));
  p1.on("console", (m) => m.type() === "error" && errors.push(`client console: ${m.text().slice(-700)}`));
  await customer(p1);
  // Panier « en attente » avec un plat à options, pour vérifier qu'il survit à une modification du plat par l'admin
  await p1.goto(`${BASE}/plat/poulet-braise-aux-poivrons`);
  await p1.getByRole("button", { name: /^Ajouter/ }).click();
  await p1.waitForURL(/\/menu$/);
  const tablet = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const p2 = await tablet.newPage();
  p2.on("pageerror", (e) => errors.push(`cuisine: ${e.message}`));
  p2.on("console", (m) => m.type() === "error" && errors.push(`cuisine console: ${m.text().slice(-700)}`));
  await kitchen(p2);
  const desktop = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const p3 = await desktop.newPage();
  p3.on("pageerror", (e) => errors.push(`admin: ${e.message}`));
  p3.on("console", (m) => m.type() === "error" && errors.push(`admin console (${p3.url()}): ${m.text().slice(-700)}`));
  await admin(p3);
  await p1.goto(`${BASE}/panier`);
  await p1.getByText("Choisir mon créneau").waitFor();
  await p1.waitForTimeout(1500);
  if (await p1.getByText(/n’existe plus|plus disponible/).count()) errors.push("panier client invalidé après modification du plat par l’admin");
  else ok("Panier client toujours valide après modification du plat par l’admin");
  await browser.close();
  if (errors.length) {
    console.log("⚠ Erreurs JavaScript dans le navigateur :\n" + errors.join("\n"));
    process.exit(1);
  }
  console.log(`\nTous les parcours sont OK. Captures : ${OUT}`);
}

main().catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
