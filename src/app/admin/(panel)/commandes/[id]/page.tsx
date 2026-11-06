import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, Bike, Store, Phone, Mail, MapPin, MessageSquare, AlertTriangle, CreditCard, History, Pencil, Undo2, ExternalLink } from "lucide-react";
import { db, schema } from "@/db";
import { formatPrice, centsToInput, cn } from "@/lib/format";
import { formatDateTime, formatHour, relativeDayLabel } from "@/lib/time";
import { STATUS, type OrderStatus } from "@/lib/constants";
import { nextStatus, previousStatus, nextActionLabel } from "@/lib/status-flow";
import { Card, StatusBadge, PaymentBadge, Field, Input, Textarea, Check, Notice } from "@/components/ui";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action";
import { adminSetStatus, adminCancel, adminRefund, adminComment, adminEditOrder, resolveIssueAction } from "../../actions/orders";
import { PrintButton } from "./print-button";

const EVENT_ICON: Record<string, typeof History> = { comment: MessageSquare, issue: AlertTriangle, payment: CreditCard, refund: CreditCard, edit: Pencil, status: History, system: History };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const o = await db.query.orders.findFirst({ where: eq(schema.orders.id, id) });
  if (!o) notFound();
  const [items, events, payment, refunds] = await Promise.all([
    db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, id)),
    db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, id)).orderBy(asc(schema.orderEvents.createdAt)),
    db.query.payments.findFirst({ where: eq(schema.payments.orderId, id) }),
    db.select().from(schema.refunds).where(eq(schema.refunds.orderId, id)),
  ]);
  const next = nextStatus(o);
  const prev = previousStatus(o);
  const label = nextActionLabel(o);
  const closed = ["cancelled", "expired", "completed"].includes(o.status);
  const refundable = payment ? payment.amountCents - payment.refundedCents : 0;
  const notStarted = ["new", "accepted"].includes(o.status);

  return (
    <div>
      <Link href="/admin/commandes" className="no-print mb-4 inline-flex items-center gap-1.5 font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Toutes les commandes
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Commande n°{o.number}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge status={o.status} large />
            <PaymentBadge status={o.paymentStatus} />
          </div>
          <p className="mt-2 text-muted">Passée le {formatDateTime(o.createdAt)}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <PrintButton />
          <a href={`/commande/${o.publicToken}`} target="_blank" className="inline-flex h-11 items-center gap-2 rounded-full px-4 font-semibold ring-1 ring-sand-dark hover:bg-white">
            <ExternalLink className="size-4" /> Vue client
          </a>
        </div>
      </div>

      {/* Actions principales */}
      {!closed && o.status !== "pending_payment" && (
        <Card className="no-print mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 text-[15px] text-muted">
              Étape actuelle : <b className="text-ink">{STATUS[o.status as OrderStatus].label}</b>
            </div>
            {prev && (
              <ActionButton action={adminSetStatus.bind(null, o.id, o.status, prev)} variant="ghost">
                <Undo2 className="size-4" /> Revenir à « {STATUS[prev].label} »
              </ActionButton>
            )}
            {next && label && (
              <ActionButton action={adminSetStatus.bind(null, o.id, o.status, next)} variant="secondary" size="lg" success={`Commande passée à « ${STATUS[next].label} »`}>
                {label}
              </ActionButton>
            )}
          </div>
        </Card>
      )}
      {o.status === "pending_payment" && (
        <Notice tone="info" className="mb-4">
          Le client est en train de payer. Si le paiement n’aboutit pas avant {formatHour(o.holdExpiresAt)}, les plats et le créneau seront libérés automatiquement.
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-3 text-lg font-semibold">
              {o.mode === "delivery" ? <Bike className="size-6 text-violet-700" /> : <Store className="size-6 text-sky-700" />}
              {o.mode === "delivery" ? "Livraison" : "Retrait"} {relativeDayLabel(o.serviceDay).toLowerCase()}, {formatHour(o.slotStart)} – {formatHour(o.slotEnd)}
            </div>
            <ul className="mt-4 divide-y divide-sand">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2.5">
                  <div>
                    <span className="mr-2 inline-grid min-w-7 place-items-center rounded-lg bg-ink px-1.5 text-sm font-bold text-white">{i.quantity}</span>
                    <span className="font-semibold">{i.productName}</span>
                    {i.options.length > 0 && <div className="ml-9 text-sm text-muted">{i.options.map((x) => x.name + (x.priceDeltaCents ? ` (+${formatPrice(x.priceDeltaCents)})` : "")).join(" · ")}</div>}
                  </div>
                  <span className="shrink-0">{formatPrice(i.lineTotalCents)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 space-y-1 border-t border-sand pt-3 text-[15px]">
              <div className="flex justify-between"><span className="text-muted">Sous-total</span><span>{formatPrice(o.subtotalCents)}</span></div>
              {o.discountCents > 0 && <div className="flex justify-between text-forest"><span>Code {o.promoCode}</span><span>−{formatPrice(o.discountCents)}</span></div>}
              {o.mode === "delivery" && <div className="flex justify-between"><span className="text-muted">Livraison</span><span>{formatPrice(o.deliveryFeeCents)}</span></div>}
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{formatPrice(o.totalCents)}</span></div>
            </div>
            {o.kitchenNotes && <div className="mt-3 rounded-xl bg-yellow-100 p-3 font-medium text-yellow-950">📝 {o.kitchenNotes}</div>}
          </Card>

          <Card>
            <h2 className="font-sans text-lg font-bold">Client</h2>
            {o.anonymizedAt ? (
              <p className="mt-2 text-muted">Données personnelles anonymisées (RGPD).</p>
            ) : (
              <div className="mt-2 space-y-1.5 text-[15px]">
                <div className="text-lg font-semibold">{o.customerName}</div>
                <a href={`tel:${o.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 hover:underline"><Phone className="size-4" />{o.phone}</a>
                <a href={`mailto:${o.email}`} className="flex items-center gap-2 hover:underline"><Mail className="size-4" />{o.email}</a>
                {o.mode === "delivery" && (
                  <a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.addressLine} ${o.postalCode} ${o.city}`)}`} className="flex items-start gap-2 hover:underline">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    <span>
                      {o.addressLine}, {o.postalCode} {o.city}
                      {o.deliveryInstructions && <span className="block text-muted">{o.deliveryInstructions}</span>}
                    </span>
                  </a>
                )}
              </div>
            )}
            {!o.anonymizedAt && (
              <details className="no-print mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-terracotta">Modifier les informations</summary>
                <ActionForm action={adminEditOrder.bind(null, o.id)} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Nom"><Input name="customerName" defaultValue={o.customerName} required /></Field>
                  <Field label="Téléphone"><Input name="phone" defaultValue={o.phone} required /></Field>
                  <Field label="Email" className="sm:col-span-2"><Input name="email" type="email" defaultValue={o.email} required /></Field>
                  {o.mode === "delivery" && (
                    <>
                      <Field label="Adresse" className="sm:col-span-2"><Input name="addressLine" defaultValue={o.addressLine ?? ""} /></Field>
                      <Field label="Code postal"><Input name="postalCode" defaultValue={o.postalCode ?? ""} /></Field>
                      <Field label="Ville"><Input name="city" defaultValue={o.city ?? ""} /></Field>
                      <Field label="Instructions de livraison" className="sm:col-span-2"><Input name="deliveryInstructions" defaultValue={o.deliveryInstructions ?? ""} /></Field>
                    </>
                  )}
                  <Field label="Note pour la cuisine" className="sm:col-span-2"><Textarea name="kitchenNotes" defaultValue={o.kitchenNotes ?? ""} rows={2} /></Field>
                  <div className="sm:col-span-2"><SubmitButton>Enregistrer</SubmitButton></div>
                </ActionForm>
              </details>
            )}
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 font-sans text-lg font-bold"><History className="size-5" /> Historique</h2>
            <ol className="mt-3 space-y-3">
              {events.map((e) => {
                const Icon = EVENT_ICON[e.kind] ?? History;
                return (
                  <li key={e.id} className={cn("flex gap-3 rounded-xl p-2", e.kind === "issue" && !e.resolvedAt && "bg-amber-50 ring-1 ring-amber-200", e.kind === "comment" && "bg-sand/60")}>
                    <Icon className={cn("mt-0.5 size-4 shrink-0", e.kind === "issue" ? "text-amber-600" : "text-muted")} />
                    <div className="flex-1 text-[15px]">
                      <div className="whitespace-pre-line">{e.kind === "issue" ? <b>Problème : </b> : null}{e.message}</div>
                      <div className="text-xs text-muted">{e.actorLabel} · {formatDateTime(e.createdAt)}{e.resolvedAt && " · réglé"}</div>
                    </div>
                    {e.kind === "issue" && !e.resolvedAt && (
                      <ActionButton action={resolveIssueAction.bind(null, e.id)} size="sm" className="no-print">Réglé</ActionButton>
                    )}
                  </li>
                );
              })}
            </ol>
            <ActionForm action={adminComment.bind(null, o.id)} reset success={null} className="no-print mt-4 flex gap-2">
              <Input name="message" placeholder="Ajouter une note interne (non visible par le client)" />
              <SubmitButton variant="outline">Ajouter</SubmitButton>
            </ActionForm>
          </Card>
        </div>

        <div className="no-print space-y-4">
          <Card>
            <h2 className="font-sans text-lg font-bold">Paiement</h2>
            {payment ? (
              <dl className="mt-2 space-y-1 text-[15px]">
                <div className="flex justify-between"><dt className="text-muted">Montant</dt><dd className="font-semibold">{formatPrice(payment.amountCents)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Payé le</dt><dd>{payment.paidAt ? formatDateTime(payment.paidAt) : "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Moyen</dt><dd>{payment.provider === "demo" ? "Simulation (démo)" : "Stripe"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">Référence</dt><dd className="truncate font-mono text-xs">{payment.reference ?? "—"}</dd></div>
                {payment.refundedCents > 0 && <div className="flex justify-between text-violet-800"><dt>Remboursé</dt><dd className="font-semibold">{formatPrice(payment.refundedCents)}</dd></div>}
              </dl>
            ) : (
              <p className="mt-2 text-muted">Aucun paiement reçu.</p>
            )}
            {refunds.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-sand pt-3 text-sm">
                {refunds.map((r) => (
                  <li key={r.id}>{formatDateTime(r.createdAt)} — {formatPrice(r.amountCents)} {r.reason && `(${r.reason})`} · {r.status === "pending" ? "en cours" : "effectué"}</li>
                ))}
              </ul>
            )}
            {refundable > 0 && o.status !== "cancelled" && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-terracotta">Rembourser (tout ou partie)</summary>
                <ActionForm action={adminRefund.bind(null, o.id)} confirm="Confirmer le remboursement ? Cette action est définitive." className="mt-3 space-y-3">
                  <Field label="Montant (€)" hint={`Maximum ${formatPrice(refundable)}`}><Input name="amount" inputMode="decimal" defaultValue={centsToInput(refundable)} required /></Field>
                  <Field label="Motif (envoyé au client)"><Input name="reason" placeholder="Ex. : plat manquant" /></Field>
                  <SubmitButton variant="primary">Rembourser</SubmitButton>
                </ActionForm>
              </details>
            )}
          </Card>

          {!closed && (
            <Card className="ring-red-200">
              <h2 className="font-sans text-lg font-bold text-red-800">Annuler la commande</h2>
              <ActionForm action={adminCancel.bind(null, o.id)} confirm="Annuler définitivement cette commande ? Le client sera prévenu par email." className="mt-3 space-y-2">
                <Field label="Motif (envoyé au client)"><Input name="reason" placeholder="Ex. : rupture d’un ingrédient" required /></Field>
                {o.paymentStatus === "paid" || o.paymentStatus === "partially_refunded" ? (
                  <Check name="refund" defaultChecked label={`Rembourser le client (${formatPrice(refundable)})`} />
                ) : null}
                <Check name="restock" defaultChecked={notStarted} label="Remettre les plats en stock" hint={notStarted ? "Les plats n’ont pas encore été cuisinés." : "Décochez si les plats ont déjà été cuisinés."} />
                <SubmitButton variant="danger">Annuler la commande</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
