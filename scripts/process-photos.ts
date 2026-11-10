/**
 * Prépare les photos des plats pour le site :
 * recadrage sur l'assiette, correction des couleurs, netteté, format WebP léger.
 *
 * Usage : npx tsx scripts/process-photos.ts [dossier-source] [dossier-sortie]
 *   par défaut : ./photos-source → ./assets/plats
 */
import sharp, { type Sharp, type OverlayOptions } from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.argv[2] ?? "photos-source");
const OUT = path.resolve(process.argv[3] ?? "assets/plats");
const SIZE = 1200;

/**
 * Cadrages mesurés sur les photos (coordonnées « affichées », converties par le facteur f).
 * - square : carré centré (cx, cy) de côté `side`
 * - fit    : rectangle (x, y, w, h) intégré entier dans un carré, fond flouté (rien n'est coupé)
 */
type Crop = { src: number; f: number } & ({ mode: "square"; cx: number; cy: number; side: number } | { mode: "fit"; x: number; y: number; w: number; h: number });

const L = 1.44; // photos 2160×2880 / 2880×2160 affichées en 1500×2000 / 2000×1500
const P = 1.104; // photos 1242×2208 affichées en 1125×2000

export const PHOTOS: Record<string, Crop> = {
  // Poisson en sauce
  "poisson-sauce-1": { src: 1, f: L, mode: "square", cx: 745, cy: 900, side: 1480 },
  "poisson-sauce-2": { src: 2, f: P, mode: "fit", x: 0, y: 320, w: 1125, h: 1410 },
  // Poulet braisé aux poivrons
  "poulet-braise-1": { src: 8, f: L, mode: "square", cx: 915, cy: 820, side: 1560 },
  "poulet-braise-2": { src: 4, f: L, mode: "square", cx: 980, cy: 735, side: 1400 },
  "poulet-braise-3": { src: 5, f: L, mode: "fit", x: 0, y: 260, w: 2000, h: 1050 },
  // Pilons de poulet seuls (grillade)
  "pilons-1": { src: 10, f: P, mode: "square", cx: 565, cy: 1140, side: 1090 },
  "pilons-2": { src: 10, f: P, mode: "square", cx: 450, cy: 1150, side: 700 },
  // Riz blanc seul (isolé de la photo pilons + riz)
  "riz-1": { src: 15, f: P, mode: "square", cx: 790, cy: 690, side: 600 },
  // Épinards sautés
  "epinards-1": { src: 3, f: L, mode: "square", cx: 945, cy: 760, side: 1480 },
  "epinards-2": { src: 9, f: L, mode: "square", cx: 1045, cy: 820, side: 1470 },
  // Alloco
  "alloco-1": { src: 11, f: P, mode: "square", cx: 520, cy: 1030, side: 1040 },
  "alloco-2": { src: 13, f: P, mode: "square", cx: 590, cy: 840, side: 1060 },
  "alloco-3": { src: 12, f: P, mode: "square", cx: 540, cy: 820, side: 1080 },
  // Pilons de poulet & riz
  "pilons-riz-1": { src: 15, f: P, mode: "square", cx: 550, cy: 822, side: 1100 },
  "pilons-riz-2": { src: 14, f: P, mode: "square", cx: 562, cy: 900, side: 1124 },
  "pilons-riz-3": { src: 16, f: P, mode: "square", cx: 562, cy: 960, side: 1124 },
  "pilons-riz-4": { src: 10, f: P, mode: "square", cx: 565, cy: 1205, side: 1030 },
  // Salade avocat & maïs
  "salade-1": { src: 18, f: L, mode: "square", cx: 745, cy: 1060, side: 1490 },
  "salade-2": { src: 17, f: P, mode: "square", cx: 550, cy: 930, side: 1100 },
  "salade-3": { src: 19, f: L, mode: "square", cx: 750, cy: 800, side: 1430 },
  // Poisson braisé entier
  "poisson-braise-1": { src: 21, f: P, mode: "square", cx: 562, cy: 890, side: 1124 },
  "poisson-braise-2": { src: 22, f: P, mode: "fit", x: 0, y: 330, w: 1125, h: 1390 },
  "poisson-braise-3": { src: 20, f: P, mode: "fit", x: 0, y: 380, w: 1125, h: 1340 },
  // Beignets
  "beignets-1": { src: 23, f: P, mode: "square", cx: 562, cy: 870, side: 1124 },
  "beignets-2": { src: 24, f: P, mode: "square", cx: 562, cy: 850, side: 1124 },
  // Photos d'ensemble (galeries des formules)
  "ensemble-poulet-epinards-alloco": { src: 7, f: L, mode: "fit", x: 0, y: 0, w: 2000, h: 1500 },
  "ensemble-poulet-epinards": { src: 6, f: L, mode: "fit", x: 0, y: 170, w: 2000, h: 1170 },
};

/** Visuels des formules : assiettes rondes assemblées sur un fond aux couleurs du site. */
export const COMPOSITES: Record<string, { plates: { photo: string; d: number; x: number; y: number }[] }> = {
  "formule-poisson-sauce-riz": {
    plates: [
      { photo: "poisson-sauce-1", d: 800, x: 40, y: 40 },
      { photo: "riz-1", d: 560, x: 600, y: 600 },
    ],
  },
  "formule-poulet-epinards-alloco": {
    plates: [
      { photo: "poulet-braise-1", d: 640, x: 30, y: 60 },
      { photo: "epinards-1", d: 560, x: 610, y: 40 },
      { photo: "alloco-1", d: 540, x: 360, y: 620 },
    ],
  },
  "formule-poisson-braise-epinards": {
    plates: [
      { photo: "poisson-braise-1", d: 800, x: 40, y: 40 },
      { photo: "epinards-1", d: 560, x: 600, y: 600 },
    ],
  },
};

/** Correction couleur : un peu plus lumineux, chaud et contrasté, puis netteté. */
function enhance(img: Sharp) {
  return img
    .normalise({ lower: 0.5, upper: 99.8 })
    .modulate({ brightness: 1.05, saturation: 1.1 })
    .linear(1.05, -128 * 0.05)
    .sharpen({ sigma: 0.9, m1: 0.6, m2: 2 });
}

async function processOne(name: string, c: Crop): Promise<Buffer> {
  const file = path.join(SRC, `${c.src}.jpg`);
  const meta = await sharp(file).rotate().metadata();
  const W = meta.width!;
  const H = meta.height!;
  const clampRect = (x: number, y: number, w: number, h: number) => {
    const left = Math.max(0, Math.round(x));
    const top = Math.max(0, Math.round(y));
    return { left, top, width: Math.min(W - left, Math.round(w)), height: Math.min(H - top, Math.round(h)) };
  };

  let out: Sharp;
  if (c.mode === "square") {
    const side = c.side * c.f;
    const rect = clampRect(c.cx * c.f - side / 2, c.cy * c.f - side / 2, side, side);
    out = sharp(await sharp(file).rotate().extract(rect).resize(SIZE, SIZE, { fit: "cover" }).toBuffer());
  } else {
    const rect = clampRect(c.x * c.f, c.y * c.f, c.w * c.f, c.h * c.f);
    const crop = await sharp(file).rotate().extract(rect).toBuffer();
    const fg = await sharp(crop).resize(SIZE, SIZE, { fit: "inside" }).toBuffer();
    const bg = await sharp(crop).resize(SIZE, SIZE, { fit: "cover" }).blur(40).modulate({ brightness: 0.85 }).toBuffer();
    const fgMeta = await sharp(fg).metadata();
    out = sharp(await sharp(bg).composite([{ input: fg, left: Math.round((SIZE - fgMeta.width!) / 2), top: Math.round((SIZE - fgMeta.height!) / 2) }]).toBuffer());
  }
  const buf = await enhance(out).webp({ quality: 82, effort: 5 }).toBuffer();
  fs.writeFileSync(path.join(OUT, `${name}.webp`), buf);
  return buf;
}

async function circle(buf: Buffer, d: number) {
  const mask = Buffer.from(`<svg width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="#fff"/></svg>`);
  return sharp(buf).resize(d, d).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

async function composite(name: string, def: (typeof COMPOSITES)[string], done: Map<string, Buffer>) {
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
    <defs>
      <radialGradient id="g" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#FBF6EE"/><stop offset="1" stop-color="#EADFCB"/></radialGradient>
      <pattern id="p" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M0 30 15 15l15 15-15 15zM30 30l15-15 15 15-15 15z" fill="none" stroke="#E0A526" stroke-opacity=".16" stroke-width="1.5"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#p)"/>
  </svg>`);
  const layers: OverlayOptions[] = [];
  for (const p of def.plates) {
    const shadow = Buffer.from(`<svg width="${p.d + 80}" height="${p.d + 80}"><circle cx="${p.d / 2 + 40}" cy="${p.d / 2 + 52}" r="${p.d / 2}" fill="#3b2a1a" fill-opacity=".35"/></svg>`);
    layers.push({ input: await sharp(shadow).blur(22).png().toBuffer(), left: p.x - 40, top: p.y - 40 });
    layers.push({ input: await circle(done.get(p.photo)!, p.d), left: p.x, top: p.y });
  }
  const buf = await sharp(bg).composite(layers).webp({ quality: 84, effort: 5 }).toBuffer();
  fs.writeFileSync(path.join(OUT, `${name}.webp`), buf);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const done = new Map<string, Buffer>();
  for (const [name, c] of Object.entries(PHOTOS)) {
    done.set(name, await processOne(name, c));
    console.log(`✓ ${name}`);
  }
  for (const [name, def] of Object.entries(COMPOSITES)) {
    await composite(name, def, done);
    console.log(`✓ ${name} (assemblage)`);
  }
  const total = fs.readdirSync(OUT).reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
  console.log(`\n${fs.readdirSync(OUT).length} images · ${(total / 1024 / 1024).toFixed(1)} Mo → ${OUT}`);
}

if (process.argv[1]?.includes("process-photos")) main();
