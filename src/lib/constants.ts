/** Les 14 allergènes à déclaration obligatoire (règlement UE n°1169/2011). */
export const ALLERGENS: { code: string; label: string }[] = [
  { code: "gluten", label: "Gluten" },
  { code: "crustaces", label: "Crustacés" },
  { code: "oeufs", label: "Œufs" },
  { code: "poissons", label: "Poissons" },
  { code: "arachides", label: "Arachides" },
  { code: "soja", label: "Soja" },
  { code: "lait", label: "Lait" },
  { code: "fruits_a_coque", label: "Fruits à coque" },
  { code: "celeri", label: "Céleri" },
  { code: "moutarde", label: "Moutarde" },
  { code: "sesame", label: "Sésame" },
  { code: "sulfites", label: "Sulfites" },
  { code: "lupin", label: "Lupin" },
  { code: "mollusques", label: "Mollusques" },
];

export const allergenLabel = (code: string) => ALLERGENS.find((a) => a.code === code)?.label ?? code;

export type OrderStatus =
  | "pending_payment"
  | "new"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "expired";

export const STATUS: Record<OrderStatus, { label: string; short: string; color: string; dot: string; customer: string }> = {
  pending_payment: {
    label: "Paiement en cours",
    short: "Paiement",
    color: "bg-stone-100 text-stone-700 ring-stone-300",
    dot: "bg-stone-400",
    customer: "En attente de votre paiement",
  },
  new: {
    label: "Nouvelle commande",
    short: "Nouvelle",
    color: "bg-sky-100 text-sky-800 ring-sky-300",
    dot: "bg-sky-500",
    customer: "Commande reçue, en attente de validation",
  },
  accepted: {
    label: "À préparer",
    short: "À préparer",
    color: "bg-amber-100 text-amber-900 ring-amber-300",
    dot: "bg-amber-500",
    customer: "Commande acceptée",
  },
  preparing: {
    label: "En préparation",
    short: "En cours",
    color: "bg-orange-100 text-orange-900 ring-orange-300",
    dot: "bg-orange-500",
    customer: "En cuisine",
  },
  ready: {
    label: "Prête",
    short: "Prête",
    color: "bg-emerald-100 text-emerald-900 ring-emerald-300",
    dot: "bg-emerald-500",
    customer: "Prête",
  },
  out_for_delivery: {
    label: "En livraison",
    short: "Livraison",
    color: "bg-violet-100 text-violet-900 ring-violet-300",
    dot: "bg-violet-500",
    customer: "En route vers chez vous",
  },
  completed: {
    label: "Terminée",
    short: "Terminée",
    color: "bg-stone-200 text-stone-700 ring-stone-300",
    dot: "bg-stone-500",
    customer: "Terminée — bon appétit !",
  },
  cancelled: {
    label: "Annulée",
    short: "Annulée",
    color: "bg-red-100 text-red-800 ring-red-300",
    dot: "bg-red-500",
    customer: "Annulée",
  },
  expired: {
    label: "Non payée",
    short: "Non payée",
    color: "bg-stone-100 text-stone-500 ring-stone-200",
    dot: "bg-stone-300",
    customer: "Paiement non finalisé",
  },
};

export const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  unpaid: { label: "Non payée", color: "bg-stone-100 text-stone-600 ring-stone-300" },
  paid: { label: "Payée", color: "bg-emerald-100 text-emerald-800 ring-emerald-300" },
  failed: { label: "Échec", color: "bg-red-100 text-red-800 ring-red-300" },
  refunded: { label: "Remboursée", color: "bg-violet-100 text-violet-800 ring-violet-300" },
  partially_refunded: { label: "Remb. partiel", color: "bg-violet-50 text-violet-800 ring-violet-200" },
};

/** Commandes payées et non clôturées (visibles en cuisine). */
export const ACTIVE_STATUSES: OrderStatus[] = ["new", "accepted", "preparing", "ready", "out_for_delivery"];
/** Commandes payées (comptées dans le chiffre d'affaires). */
export const PAID_STATUSES: OrderStatus[] = ["new", "accepted", "preparing", "ready", "out_for_delivery", "completed"];

export const MODE_LABEL = { pickup: "Retrait", delivery: "Livraison" } as const;

export const UNITS = [
  { code: "g", label: "grammes (g)" },
  { code: "ml", label: "millilitres (ml)" },
  { code: "pce", label: "pièces" },
];

export const ISSUE_REASONS = [
  "Ingrédient manquant",
  "Retard de préparation",
  "Erreur dans la commande",
  "Problème de matériel",
  "Autre",
];
