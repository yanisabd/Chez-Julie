import Link from "next/link";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db, schema } from "@/db";
import { stripeEnabled } from "@/server/payments";
import { formatPrice } from "@/lib/format";
import { formatDateTime, parisDay, addDays } from "@/lib/time";
import { PageHeader, Help, Stat, Table, Input, PaymentBadge, btnClass, Notice } from "@/components/ui";

export const metadata = { title: "Paiements" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ du?: string; au?: string }> }) {
  const sp = await searchParams;
  const to = sp.au && /^\d{4}-\d{2}-\d{2}$/.test(sp.au) ? sp.au : parisDay();
  const from = sp.du && /^\d{4}-\d{2}-\d{2}$/.test(sp.du) ? sp.du : addDays(to, -30);
  const rows = await db
    .select({ p: schema.payments, number: schema.orders.number, name: schema.orders.customerName, status: schema.orders.paymentStatus, orderId: schema.orders.id })
    .from(schema.payments)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.payments.orderId))
    .where(and(gte(sql`(${schema.payments.paidAt} AT TIME ZONE 'Europe/Paris')::date`, from), lte(sql`(${schema.payments.paidAt} AT TIME ZONE 'Europe/Paris')::date`, to)))
    .orderBy(desc(schema.payments.paidAt))
    .limit(500);
  const gross = rows.reduce((n, r) => n + r.p.amountCents, 0);
  const refunded = rows.reduce((n, r) => n + r.p.refundedCents, 0);

  return (
    <div>
      <PageHeader
        title="Paiements"
        subtitle="Tous les paiements reçus en ligne et les remboursements."
        actions={
          <>
            <a href={`/api/admin/export?du=${from}&au=${to}`} className={btnClass("outline")}>Exporter (Excel)</a>
            {stripeEnabled() && (
              <a href="https://dashboard.stripe.com/payments" target="_blank" rel="noopener noreferrer" className={btnClass("outline")}>
                <ExternalLink className="size-4" /> Tableau de bord Stripe
              </a>
            )}
          </>
        }
      />
      {!stripeEnabled() && <Notice tone="warn" className="mb-4">Mode démonstration : les paiements affichés sont simulés.</Notice>}
      <Help>
        Les paiements sont traités par Stripe : aucun numéro de carte n’est stocké sur votre site. L’argent arrive sur votre compte bancaire selon le calendrier de virement Stripe (généralement sous 2 à 7 jours). Pour rembourser,
        ouvrez la commande concernée.
      </Help>
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-sm font-semibold">
          Du <Input type="date" name="du" defaultValue={from} />
        </label>
        <label className="text-sm font-semibold">
          Au <Input type="date" name="au" defaultValue={to} />
        </label>
        <button className={btnClass("secondary", "md", "h-[50px]")}>Afficher</button>
      </form>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Encaissé" value={formatPrice(gross)} sub={`${rows.length} paiement(s)`} />
        <Stat label="Remboursé" value={formatPrice(refunded)} />
        <Stat label="Net" value={formatPrice(gross - refunded)} />
      </div>
      <Table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Commande</th>
            <th>Client</th>
            <th>Montant</th>
            <th>Remboursé</th>
            <th>Statut</th>
            <th>Référence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.p.id}>
              <td className="whitespace-nowrap text-muted">{r.p.paidAt ? formatDateTime(r.p.paidAt) : "—"}</td>
              <td>
                <Link href={`/admin/commandes/${r.orderId}`} className="font-semibold underline">
                  n°{r.number}
                </Link>
              </td>
              <td>{r.name}</td>
              <td className="font-semibold">{formatPrice(r.p.amountCents)}</td>
              <td>{r.p.refundedCents ? formatPrice(r.p.refundedCents) : "—"}</td>
              <td>
                <PaymentBadge status={r.status} />
              </td>
              <td className="max-w-40 truncate font-mono text-xs">{r.p.provider === "demo" ? "démo" : r.p.reference}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-muted">
                Aucun paiement sur cette période.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
