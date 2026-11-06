import type { Settings } from "@/lib/settings-schema";
import { formatPrice } from "@/lib/format";
import { formatHour, relativeDayLabel, formatDayLong } from "@/lib/time";
import { MODE_LABEL } from "@/lib/constants";
import type { OrderItemOption } from "@/db/schema";

export const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export type EmailOrder = {
  number: number;
  publicToken: string;
  customerName: string;
  mode: "pickup" | "delivery";
  slotStart: Date;
  slotEnd: Date;
  serviceDay: string;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  discountCents: number;
  totalCents: number;
  items: { productName: string; quantity: number; lineTotalCents: number; options: OrderItemOption[] }[];
};

export type CustomerEmailType =
  | "order_confirmed"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "refunded"
  | "payment_failed";

const C = { green: "#1F4D3A", terracotta: "#B9532F", gold: "#E0A526", beige: "#F6EFE4", ink: "#1E1E1C", muted: "#6B645A" };

function layout(settings: Settings, title: string, body: string, preheader = "") {
  const b = settings.business;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:${C.beige};font-family:Helvetica,Arial,sans-serif;color:${C.ink}">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.beige};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:${C.green};padding:22px 28px;color:#fff">
  <div style="font-family:Georgia,serif;font-size:24px;font-weight:bold">${esc(b.name)}</div>
  <div style="font-size:13px;color:${C.gold};margin-top:2px">${esc(b.tagline)}</div>
</td></tr>
<tr><td style="height:6px;background:repeating-linear-gradient(90deg,${C.terracotta} 0 18px,${C.gold} 18px 30px,${C.green} 30px 42px)"></td></tr>
<tr><td style="padding:28px">${body}</td></tr>
<tr><td style="padding:18px 28px;background:#FBF7F0;font-size:12px;color:${C.muted};line-height:1.6">
  ${esc(b.name)} · ${esc(b.phone)} · <a href="mailto:${esc(b.email)}" style="color:${C.green}">${esc(b.email)}</a><br>
  Vous recevez cet email car vous avez passé commande sur notre site.
</td></tr></table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:${C.terracotta};color:#fff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:999px;font-size:15px">${esc(label)}</a>`;

function recap(o: EmailOrder, settings: Settings) {
  const rows = o.items
    .map(
      (i) => `<tr><td style="padding:6px 0;font-size:14px"><b>${i.quantity} ×</b> ${esc(i.productName)}${
        i.options.length ? `<div style="font-size:12px;color:${C.muted}">${i.options.map((x) => esc(x.name)).join(", ")}</div>` : ""
      }</td><td align="right" style="padding:6px 0;font-size:14px;white-space:nowrap">${formatPrice(i.lineTotalCents)}</td></tr>`,
    )
    .join("");
  const line = (l: string, v: string, bold = false) =>
    `<tr><td style="padding:3px 0;font-size:14px;${bold ? "font-weight:bold" : `color:${C.muted}`}">${l}</td><td align="right" style="padding:3px 0;font-size:14px;${bold ? "font-weight:bold" : ""}">${v}</td></tr>`;
  const where =
    o.mode === "pickup"
      ? `<b>Retrait</b> au ${esc(settings.business.pickupAddress)}<br><span style="color:${C.muted}">${esc(settings.business.pickupInstructions)}</span>`
      : `<b>Livraison</b> au ${esc(o.addressLine)}, ${esc(o.postalCode)} ${esc(o.city)}`;
  return `
<div style="background:${C.beige};border-radius:12px;padding:16px 18px;margin:18px 0">
  <div style="font-size:13px;color:${C.muted}">Commande</div>
  <div style="font-size:20px;font-weight:bold;color:${C.green}">n° ${o.number}</div>
  <div style="margin-top:10px;font-size:14px;line-height:1.5">
    📅 <b>${esc(formatDayLong(o.serviceDay))}</b>, entre <b>${formatHour(o.slotStart)}</b> et <b>${formatHour(o.slotEnd)}</b><br>
    📍 ${where}
  </div>
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<hr style="border:none;border-top:1px solid #eee;margin:10px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  ${line("Sous-total", formatPrice(o.subtotalCents))}
  ${o.discountCents ? line("Réduction", "− " + formatPrice(o.discountCents)) : ""}
  ${o.mode === "delivery" ? line("Livraison", o.deliveryFeeCents ? formatPrice(o.deliveryFeeCents) : "Offerte") : ""}
  ${line("Total payé", formatPrice(o.totalCents), true)}
</table>`;
}

export function renderCustomerEmail(
  type: CustomerEmailType,
  o: EmailOrder,
  settings: Settings,
  extra: { reason?: string; refundCents?: number; awaitingAcceptance?: boolean } = {},
) {
  const first = o.customerName.split(" ")[0];
  const track = `${appUrl()}/commande/${o.publicToken}`;
  const when = `${relativeDayLabel(o.serviceDay).toLowerCase()} entre ${formatHour(o.slotStart)} et ${formatHour(o.slotEnd)}`;
  const mode = MODE_LABEL[o.mode].toLowerCase();

  const map: Record<CustomerEmailType, { subject: string; title: string; intro: string; showRecap: boolean }> = {
    order_confirmed: {
      subject: `Commande n°${o.number} confirmée – paiement reçu`,
      title: `Merci ${first} !`,
      intro: extra.awaitingAcceptance
        ? `Votre paiement de <b>${formatPrice(o.totalCents)}</b> a bien été reçu. Votre commande est enregistrée et sera validée très rapidement par notre cuisine.`
        : `Votre paiement de <b>${formatPrice(o.totalCents)}</b> a bien été reçu et votre commande est <b>confirmée</b>. Nous la préparons pour ${esc(when)}.`,
      showRecap: true,
    },
    accepted: {
      subject: `Commande n°${o.number} acceptée`,
      title: "Votre commande est acceptée",
      intro: `Bonne nouvelle ${first} : la cuisine a validé votre commande. ${o.mode === "pickup" ? "Retrait" : "Livraison"} prévu(e) ${esc(when)}.`,
      showRecap: true,
    },
    preparing: {
      subject: `Commande n°${o.number} en préparation`,
      title: "C’est parti en cuisine 🔥",
      intro: `Votre commande est en cours de préparation. ${o.mode === "pickup" ? "Retrait" : "Livraison"} prévu(e) ${esc(when)}.`,
      showRecap: false,
    },
    ready: {
      subject: o.mode === "pickup" ? `Commande n°${o.number} prête à être retirée` : `Commande n°${o.number} prête`,
      title: "Votre commande est prête !",
      intro:
        o.mode === "pickup"
          ? `Vous pouvez venir la récupérer ${esc(when)} au <b>${esc(settings.business.pickupAddress)}</b>.<br>${esc(settings.business.pickupInstructions)}`
          : `Votre commande est prête et partira très bientôt en livraison.`,
      showRecap: false,
    },
    out_for_delivery: {
      subject: `Commande n°${o.number} en route`,
      title: "Votre commande est en route 🛵",
      intro: `Elle arrive au ${esc(o.addressLine)}, ${esc(o.postalCode)} ${esc(o.city)}. Gardez votre téléphone à portée de main.`,
      showRecap: false,
    },
    completed: {
      subject: `Merci pour votre commande n°${o.number}`,
      title: "Bon appétit !",
      intro: `Merci ${first} pour votre confiance. Nous espérons vous régaler à nouveau très bientôt.`,
      showRecap: false,
    },
    cancelled: {
      subject: `Commande n°${o.number} annulée`,
      title: "Votre commande a été annulée",
      intro: `Votre commande n°${o.number} (${mode}, ${esc(when)}) a été annulée.${extra.reason ? `<br><br><b>Motif :</b> ${esc(extra.reason)}` : ""}${
        extra.refundCents ? `<br><br>Un remboursement de <b>${formatPrice(extra.refundCents)}</b> a été lancé sur votre moyen de paiement (délai bancaire de 5 à 10 jours).` : ""
      }`,
      showRecap: true,
    },
    refunded: {
      subject: `Remboursement de votre commande n°${o.number}`,
      title: "Remboursement effectué",
      intro: `Nous avons remboursé <b>${formatPrice(extra.refundCents ?? 0)}</b> sur votre moyen de paiement. Selon votre banque, il apparaîtra sous 5 à 10 jours.${
        extra.reason ? `<br><br><b>Motif :</b> ${esc(extra.reason)}` : ""
      }`,
      showRecap: false,
    },
    payment_failed: {
      subject: `Paiement non abouti – commande n°${o.number}`,
      title: "Votre paiement n’a pas abouti",
      intro: `Le paiement de votre commande n°${o.number} n’a pas pu être finalisé : <b>aucun montant n’a été débité</b> et la commande n’a pas été enregistrée. Vous pouvez repasser commande à tout moment.`,
      showRecap: false,
    },
  };

  const m = map[type];
  const cta =
    type === "payment_failed" ? button(`${appUrl()}/menu`, "Repasser commande") : type === "completed" ? button(`${appUrl()}/menu`, "Voir le menu") : button(track, "Suivre ma commande");
  const body = `
<h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 10px;color:${C.ink}">${m.title}</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 6px">${m.intro}</p>
${m.showRecap ? recap(o, settings) : `<p style="font-size:14px;color:${C.muted}">Commande n°${o.number} · ${formatPrice(o.totalCents)} · ${MODE_LABEL[o.mode]} ${esc(when)}</p>`}
<div style="margin:22px 0 4px">${cta}</div>
<p style="font-size:13px;color:${C.muted};margin-top:18px">Une question ? Appelez-nous au ${esc(settings.business.phone)} ou répondez à cet email.</p>`;

  const text = [
    `${settings.business.name} – ${m.subject}`,
    "",
    m.intro.replace(/<br>/g, "\n").replace(/<[^>]+>/g, ""),
    "",
    `Commande n°${o.number} – ${MODE_LABEL[o.mode]} ${when}`,
    ...o.items.map((i) => `- ${i.quantity} x ${i.productName} : ${formatPrice(i.lineTotalCents)}`),
    `Total : ${formatPrice(o.totalCents)}`,
    "",
    `Suivi : ${track}`,
    `Contact : ${settings.business.phone} – ${settings.business.email}`,
  ].join("\n");

  return { subject: m.subject, html: layout(settings, m.subject, body, m.title), text };
}

export function renderAdminEmail(settings: Settings, subject: string, lines: string[], link?: { href: string; label: string }) {
  const body = `
<h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">${esc(subject)}</h1>
${lines.map((l) => `<p style="font-size:15px;line-height:1.6;margin:0 0 8px">${esc(l)}</p>`).join("")}
${link ? `<div style="margin-top:18px">${button(link.href, link.label)}</div>` : ""}`;
  return { subject: `[${settings.business.name}] ${subject}`, html: layout(settings, subject, body, subject), text: [subject, "", ...lines, link?.href ?? ""].join("\n") };
}

export function renderPasswordResetEmail(settings: Settings, name: string, link: string) {
  const body = `
<h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">Réinitialiser votre mot de passe</h1>
<p style="font-size:15px;line-height:1.6">Bonjour ${esc(name)}, cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable 1 heure.</p>
<div style="margin:20px 0">${button(link, "Choisir un nouveau mot de passe")}</div>
<p style="font-size:13px;color:${C.muted}">Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet email.</p>`;
  return {
    subject: `Réinitialisation de votre mot de passe – ${settings.business.name}`,
    html: layout(settings, "Mot de passe", body),
    text: `Réinitialisez votre mot de passe : ${link} (valable 1 heure)`,
  };
}

