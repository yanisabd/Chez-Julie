import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { retrieveCheckoutSession, stripeEnabled, demoPaymentsAllowed } from "@/server/payments";
import { appUrl } from "@/server/email-templates";

/** Reprise d'un paiement interrompu (tant que la réservation est valable). */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.publicToken, token) });
  const back = NextResponse.redirect(`${appUrl()}/commande/${token}`, 303);
  if (!order || order.status !== "pending_payment" || order.holdExpiresAt < new Date()) return back;
  if (!stripeEnabled()) return demoPaymentsAllowed() ? NextResponse.redirect(`${appUrl()}/paiement-demo/${token}`, 303) : back;
  if (!order.checkoutSessionId) return back;
  try {
    const s = await retrieveCheckoutSession(order.checkoutSessionId);
    if (s.status === "open" && s.url) return NextResponse.redirect(s.url, 303);
  } catch {
    /* session inconnue */
  }
  return back;
}
