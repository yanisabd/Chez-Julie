import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { CheckCircle2, Clock, MapPin, Phone, XCircle, ChefHat, PackageCheck, Bike, Store, PartyPopper, CreditCard } from "lucide-react";
import { db, schema } from "@/db";
import { getSettings } from "@/server/settings";
import { canCustomerCancel, customerCancelDeadline, markOrderPaid } from "@/server/orders";
import { retrieveCheckoutSession, stripeEnabled } from "@/server/payments";
import { logSystem } from "@/server/log";
import { formatPrice, cn } from "@/lib/format";
import { formatDateTime, formatHour, relativeDayLabel } from "@/lib/time";
import { STATUS } from "@/lib/constants";
import { Card, Notice, btnClass } from "@/components/ui";
import { AutoRefresh } from "@/components/auto-refresh";
import { CancelOrderButton, ReorderButton } from "./client";

export const metadata: Metadata = { title: "Suivi de commande", robots: { index: false } };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ session_id?: string; paiement?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  let order = await db.query.orders.findFirst({ where: eq(schema.orders.publicToken, token) });
  if (!order) notFound();

  // Retour de Stripe : on vérifie le paiement directement auprès de Stripe (sans attendre le webhook)
  if (sp.session_id && stripeEnabled() && order.paymentStatus === "unpaid") {
    try {
      const s = await retrieveCheckoutSession(sp.session_id);
      if (s.payment_status === "paid" && s.metadata?.orderId === order.id) {
        await markOrderPaid({
          orderId: order.id,
          provider: "stripe",
          reference: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null),
          sessionId: s.id,
          amountCents: s.amount_total ?? order.totalCents,
        });
        order = (await db.query.orders.findFirst({ where: eq(schema.orders.id, order.id) }))!;
      }
    } catch (e) {
      await logSystem("warn", "Vérification de session Stripe impossible au retour client", e);
    }
  }

  const s = await getSettings();
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
  const cancellable = await canCustomerCancel(order);
  const deadline = customerCancelDeadline(order, s.ordering.cancelDeadlineHours);
  const isPending = order.status === "pending_payment";
  const active = ["new", "accepted", "preparing", "ready", "out_for_delivery"].includes(order.status);

  const steps =
    order.mode === "delivery"
      ? [
          { k: "accepted", label: "Confirmée", icon: CheckCircle2 },
          { k: "preparing", label: "En cuisine", icon: ChefHat },
          { k: "ready", label: "Prête", icon: PackageCheck },
          { k: "out_for_delivery", label: "En route", icon: Bike },
          { k: "completed", label: "Livrée", icon: PartyPopper },
        ]
      : [
          { k: "accepted", label: "Confirmée", icon: CheckCircle2 },
          { k: "preparing", label: "En cuisine", icon: ChefHat },
          { k: "ready", label: "Prête", icon: Store },
          { k: "completed", label: "Retirée", icon: PartyPopper },
        ];
  const order_ = ["new", "accepted", "preparing", "ready", "out_for_delivery", "completed"];
  const curIdx = order_.indexOf(order.status);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8">
      {(isPending || active) && <AutoRefresh seconds={isPending ? 5 : 30} />}

      {/* En-tête de statut */}
      {isPending ? (
        <Card className="text-center">
          <CreditCard className="mx-auto size-12 text-gold" />
          <h1 className="mt-3 text-2xl font-bold">{sp.paiement === "annule" ? "Paiement interrompu" : "Paiement en cours de vérification…"}</h1>
          <p className="mt-2 text-muted">
            {sp.paiement === "annule"
              ? `Votre créneau reste réservé jusqu’à ${formatHour(order.holdExpiresAt)}. Vous pouvez reprendre le paiement.`
              : "Cette page se met à jour automatiquement dès la confirmation de votre banque."}
          </p>
          {sp.paiement === "annule" && (
            <form action={`/api/checkout/${order.publicToken}`} method="post" className="mt-5">
              <button className={btnClass("primary", "lg")}>Reprendre le paiement</button>
            </form>
          )}
        </Card>
      ) : order.status === "expired" ? (
        <Card className="text-center">
          <XCircle className="mx-auto size-12 text-stone-400" />
          <h1 className="mt-3 text-2xl font-bold">Commande non finalisée</h1>
          <p className="mt-2 text-muted">Le paiement n’a pas abouti : aucun montant n’a été débité.</p>
          <div className="mt-5">
            <ReorderButton items={items.map((i) => ({ productId: i.productId, name: i.productName, qty: i.quantity }))} label="Repasser la même commande" />
          </div>
        </Card>
      ) : order.status === "cancelled" ? (
        <Card className="text-center">
          <XCircle className="mx-auto size-12 text-red-500" />
          <h1 className="mt-3 text-2xl font-bold">Commande annulée</h1>
          {order.cancelReason && <p className="mt-2 text-muted">{order.cancelReason}</p>}
          {(order.paymentStatus === "refunded" || order.paymentStatus === "partially_refunded") && (
            <p className="mt-2 font-medium text-forest">Remboursement effectué sur votre moyen de paiement (5 à 10 jours selon votre banque).</p>
          )}
        </Card>
      ) : (
        <Card>
          <div className="text-center">
            <div className="text-sm font-semibold uppercase tracking-wide text-terracotta">Commande n°{order.number}</div>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              {order.status === "completed" ? "Merci et bon appétit !" : order.status === "new" ? "Commande reçue !" : STATUS[order.status].customer}
            </h1>
            {order.status === "new" && <p className="mt-1 text-muted">Paiement reçu. La cuisine va valider votre commande très vite.</p>}
            {order.status === "accepted" && <p className="mt-1 text-muted">Paiement reçu, votre commande est confirmée. Un email de confirmation vous a été envoyé.</p>}
          </div>
          <ol className="mt-6 flex justify-between">
            {steps.map((st, i) => {
              const idx = order_.indexOf(st.k);
              const done = curIdx >= idx;
              const current = order.status === st.k || (order.status === "new" && i === 0);
              return (
                <li key={st.k} className="flex flex-1 flex-col items-center text-center">
                  <div className="flex w-full items-center">
                    <span className={cn("h-1 flex-1", i === 0 ? "invisible" : done ? "bg-forest" : "bg-sand-dark")} />
                    <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", done ? "bg-forest text-white" : "bg-sand-dark text-stone-400", current && "ring-4 ring-forest/20")}>
                      <st.icon className="size-5" />
                    </span>
                    <span className={cn("h-1 flex-1", i === steps.length - 1 ? "invisible" : curIdx > idx ? "bg-forest" : "bg-sand-dark")} />
                  </div>
                  <span className={cn("mt-1.5 text-xs font-semibold sm:text-sm", done ? "text-ink" : "text-stone-400")}>{st.label}</span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {/* Détails */}
      <Card className="mt-4 space-y-4">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 size-5 shrink-0 text-forest" />
          <div>
            <div className="font-semibold">
              {order.mode === "pickup" ? "Retrait" : "Livraison"} {relativeDayLabel(order.serviceDay).toLowerCase()}, entre {formatHour(order.slotStart)} et {formatHour(order.slotEnd)}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 size-5 shrink-0 text-forest" />
          <div>
            {order.mode === "pickup" ? (
              <>
                <div className="font-semibold">{s.business.pickupAddress}</div>
                <div className="text-[15px] text-muted">{s.business.pickupInstructions}</div>
              </>
            ) : (
              <div className="font-semibold">
                {order.addressLine}, {order.postalCode} {order.city}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Phone className="mt-0.5 size-5 shrink-0 text-forest" />
          <div className="text-[15px]">
            Une question ? <a className="font-semibold underline" href={`tel:${s.business.phone.replace(/\s/g, "")}`}>{s.business.phone}</a>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="mb-3 font-sans text-lg font-bold">Récapitulatif</h2>
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 text-[15px]">
              <span>
                <b>{i.quantity} ×</b> {i.productName}
                {i.options.length > 0 && <span className="block text-sm text-muted">{i.options.map((o) => o.name).join(" · ")}</span>}
              </span>
              <span className="shrink-0">{formatPrice(i.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-sand pt-3 text-[15px]">
          <div className="flex justify-between"><span className="text-muted">Sous-total</span><span>{formatPrice(order.subtotalCents)}</span></div>
          {order.discountCents > 0 && <div className="flex justify-between text-forest"><span>Réduction {order.promoCode}</span><span>−{formatPrice(order.discountCents)}</span></div>}
          {order.mode === "delivery" && <div className="flex justify-between"><span className="text-muted">Livraison</span><span>{order.deliveryFeeCents ? formatPrice(order.deliveryFeeCents) : "Offerte"}</span></div>}
          <div className="flex justify-between pt-1 text-lg font-bold"><span>Total</span><span>{formatPrice(order.totalCents)}</span></div>
          {order.paidAt && <div className="text-sm text-muted">Payé le {formatDateTime(order.paidAt)}</div>}
        </div>
      </Card>

      {active && (
        <div className="mt-4 space-y-3">
          {cancellable ? (
            <>
              <CancelOrderButton token={order.publicToken} />
              <p className="text-center text-sm text-muted">Annulation gratuite et remboursement intégral jusqu’au {formatDateTime(deadline)}.</p>
            </>
          ) : (
            <Notice tone="info">Pour toute modification ou annulation, contactez-nous au {s.business.phone}.</Notice>
          )}
        </div>
      )}
      {order.status === "completed" && (
        <div className="mt-4 text-center">
          <ReorderButton items={items.map((i) => ({ productId: i.productId, name: i.productName, qty: i.quantity }))} label="Commander à nouveau" />
        </div>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        Gardez ce lien : il vous permet de suivre votre commande à tout moment. <Link href="/menu" className="underline">Retour à la carte</Link>
      </p>
    </div>
  );
}
