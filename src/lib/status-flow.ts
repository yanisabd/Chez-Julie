import type { OrderStatus } from "./constants";

type O = { status: OrderStatus; mode: "pickup" | "delivery" };

/** Étape suivante « normale » d'une commande (bouton principal de la cuisine). */
export function nextStatus(o: O): OrderStatus | null {
  switch (o.status) {
    case "new":
      return "accepted";
    case "accepted":
      return "preparing";
    case "preparing":
      return "ready";
    case "ready":
      return o.mode === "delivery" ? "out_for_delivery" : "completed";
    case "out_for_delivery":
      return "completed";
    default:
      return null;
  }
}

/** Retour en arrière (correction d'une erreur de clic). */
export function previousStatus(o: O): OrderStatus | null {
  switch (o.status) {
    case "preparing":
      return "accepted";
    case "ready":
      return "preparing";
    case "out_for_delivery":
      return "ready";
    case "completed":
      return o.mode === "delivery" ? "out_for_delivery" : "ready";
    default:
      return null;
  }
}

/** Libellé du gros bouton d'action selon l'étape. */
export function nextActionLabel(o: O): string | null {
  switch (o.status) {
    case "new":
      return "Accepter la commande";
    case "accepted":
      return "Commencer la préparation";
    case "preparing":
      return "Commande prête";
    case "ready":
      return o.mode === "delivery" ? "Partie en livraison" : "Remise au client";
    case "out_for_delivery":
      return "Livrée";
    default:
      return null;
  }
}
