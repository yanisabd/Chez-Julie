import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { FlaskConical, Lock } from "lucide-react";
import { db, schema } from "@/db";
import { demoPaymentsAllowed } from "@/server/payments";
import { markOrderPaid, expireOrder } from "@/server/orders";
import { formatPrice } from "@/lib/format";
import { formatHour } from "@/lib/time";
import { Card, btnClass } from "@/components/ui";

export const metadata: Metadata = { title: "Paiement (démo)", robots: { index: false } };

async function find(token: string) {
  return db.query.orders.findFirst({ where: eq(schema.orders.publicToken, token) });
}

export default async function DemoPayment({ params }: { params: Promise<{ token: string }> }) {
  if (!demoPaymentsAllowed()) notFound(); // n existe pas quand le vrai paiement est configuré (ni en production)
  const { token } = await params;
  const order = await find(token);
  if (!order) notFound();
  if (order.status !== "pending_payment") redirect(`/commande/${token}`);

  async function pay() {
    "use server";
    if (!demoPaymentsAllowed()) return;
    const o = await find(token);
    if (o && o.status === "pending_payment") {
      await markOrderPaid({ orderId: o.id, provider: "demo", reference: `demo_${Date.now()}`, sessionId: null, amountCents: o.totalCents });
    }
    redirect(`/commande/${token}`);
  }
  async function fail() {
    "use server";
    if (!demoPaymentsAllowed()) return;
    const o = await find(token);
    if (o) await expireOrder(o.id, "Paiement refusé (simulation)");
    redirect(`/commande/${token}`);
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-10">
      <Card>
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-[15px] text-amber-900 ring-1 ring-amber-200">
          <FlaskConical className="mt-0.5 size-5 shrink-0" />
          <div>
            <b>Mode démonstration</b> — aucun paiement réel. Configurez Stripe (voir README) pour encaisser de vrais paiements par carte, Apple Pay et Google Pay.
          </div>
        </div>
        <div className="text-center">
          <div className="text-muted">Commande n°{order.number}</div>
          <div className="mt-1 text-4xl font-bold">{formatPrice(order.totalCents)}</div>
          <div className="mt-1 text-sm text-muted">Réservation garantie jusqu’à {formatHour(order.holdExpiresAt)}</div>
        </div>
        <form action={pay} className="mt-6">
          <button className={btnClass("secondary", "xl", "w-full")}>
            <Lock className="size-5" /> Payer {formatPrice(order.totalCents)} (simulation)
          </button>
        </form>
        <form action={fail} className="mt-3">
          <button className={btnClass("outline", "md", "w-full")}>Simuler un paiement refusé</button>
        </form>
      </Card>
    </div>
  );
}
