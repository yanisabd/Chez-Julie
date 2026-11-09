/**
 * Met un numéro au format international sans « + » (ex. 33612345678), comme l'attend Brevo.
 * Accepte : 06 12 34 56 78, 06.12.34.56.78, +33 6 12 34 56 78, 0033612345678, +32 470 12 34 56…
 * Retourne null si le numéro est inexploitable.
 */
export function toInternational(phone: string, defaultCountry = "33"): string | null {
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  let n: string;
  if (raw.startsWith("+")) n = digits;
  else if (digits.startsWith("00")) n = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 10) n = defaultCountry + digits.slice(1);
  else n = digits;
  return n.length >= 10 && n.length <= 15 ? n : null;
}

/** Vrai pour un mobile français (06 / 07), qui peut recevoir des SMS. Les numéros étrangers sont acceptés tels quels. */
export function canReceiveSms(phone: string): boolean {
  const n = toInternational(phone);
  if (!n) return false;
  if (n.startsWith("33")) return /^33[67]\d{8}$/.test(n);
  return true;
}

/** Nom d'expéditeur SMS : 3 à 11 caractères, lettres et chiffres uniquement. */
export function smsSenderName(name: string): string {
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 11);
  return clean.length >= 3 ? clean : "Commande";
}
