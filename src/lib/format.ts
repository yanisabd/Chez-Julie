export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** "12,50" -> 1250 ; accepte virgule ou point. */
export function parsePriceToCents(input: unknown): number | null {
  if (input == null) return null;
  const s = String(input).trim().replace(/\s|€/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function formatQty(qty: number, unit: string): string {
  if (unit === "g" && Math.abs(qty) >= 1000) return `${(qty / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`;
  if (unit === "ml" && Math.abs(qty) >= 1000) return `${(qty / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} L`;
  if (unit === "pce") return `${qty} pièce${Math.abs(qty) > 1 ? "s" : ""}`;
  return `${qty.toLocaleString("fr-FR")} ${unit}`;
}

export function slugify(s: string): string {
  return s
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "Oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n > 1 ? many : one}`;
}

export function normalizePostalCode(s: string) {
  return s.replace(/\s/g, "").trim();
}

export function normalizeCity(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}
