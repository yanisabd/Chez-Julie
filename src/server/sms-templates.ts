import type { Settings } from "@/lib/settings-schema";
import { formatPrice } from "@/lib/format";
import { formatHour, relativeDayLabel } from "@/lib/time";
import { appUrl, type EmailOrder } from "./email-templates";

export type CustomerSmsType = "order_confirmed" | "ready" | "out_for_delivery" | "cancelled";

/**
 * SMS clients : courts (≈ 1 SMS facturé), sans caractères spéciaux coûteux,
 * avec le lien de suivi quand il est utile.
 */
export function renderCustomerSms(type: CustomerSmsType, o: EmailOrder, settings: Settings, extra: { refundCents?: number } = {}): string {
  const name = settings.business.name;
  const when = `${relativeDayLabel(o.serviceDay).toLowerCase()} ${formatHour(o.slotStart)}-${formatHour(o.slotEnd)}`;
  const track = `${appUrl()}/commande/${o.publicToken}`;
  switch (type) {
    case "order_confirmed":
      return `${name} : commande n°${o.number} confirmée, merci ! ${o.mode === "pickup" ? "Retrait" : "Livraison"} ${when}. Suivi : ${track}`;
    case "ready":
      return o.mode === "pickup"
        ? `${name} : votre commande n°${o.number} est prête ! Vous pouvez venir la récupérer (${formatHour(o.slotStart)}-${formatHour(o.slotEnd)}).`
        : `${name} : votre commande n°${o.number} est prête et part bientôt en livraison.`;
    case "out_for_delivery":
      return `${name} : votre commande n°${o.number} est en route ! Gardez votre téléphone à proximité.`;
    case "cancelled":
      return `${name} : votre commande n°${o.number} a été annulée.${extra.refundCents ? ` Remboursement de ${formatPrice(extra.refundCents)} en cours.` : ""}${settings.business.phone ? ` Infos : ${settings.business.phone}` : ""}`;
  }
}
