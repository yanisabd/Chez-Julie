import Stripe from "stripe";
import { appUrl } from "./email-templates";

export const stripeEnabled = () => !!process.env.STRIPE_SECRET_KEY;

/**
 * Le paiement simulé n'est autorisé qu'en développement, ou si ALLOW_DEMO_PAYMENTS=true est
 * explicitement défini. Ainsi, un site mis en ligne sans clé Stripe par erreur ne peut pas
 * accepter de commandes « payées » gratuitement.
 */
export const demoPaymentsAllowed = () => !stripeEnabled() && (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_PAYMENTS === "true");

let _stripe: Stripe | null = null;
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe non configuré");
  _stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 20000 });
  return _stripe;
}

type CheckoutOrder = {
  id: string;
  number: number;
  publicToken: string;
  email: string;
  totalCents: number;
  deliveryFeeCents: number;
  discountCents: number;
  holdExpiresAt: Date;
  items: { productName: string; quantity: number; unitPriceCents: number; options: { name: string }[] }[];
};

/**
 * Crée la page de paiement sécurisée Stripe (carte, Apple Pay, Google Pay selon l'appareil).
 * Aucune donnée bancaire ne transite par notre serveur.
 * En mode démo (sans clé Stripe), renvoie vers une page de paiement simulé.
 */
export async function createCheckout(order: CheckoutOrder, businessName: string): Promise<{ url: string; sessionId: string | null }> {
  if (!stripeEnabled()) {
    if (!demoPaymentsAllowed()) throw new Error("Paiement non configuré : définissez STRIPE_SECRET_KEY (ou ALLOW_DEMO_PAYMENTS=true pour une démonstration).");
    return { url: `/paiement-demo/${order.publicToken}`, sessionId: null };
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    order.discountCents > 0
      ? [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: order.totalCents,
              product_data: {
                name: `Commande n°${order.number} – ${businessName}`,
                description: order.items.map((i) => `${i.quantity} × ${i.productName}`).join(", ").slice(0, 500),
              },
            },
          },
        ]
      : [
          ...order.items.map((i) => ({
            quantity: i.quantity,
            price_data: {
              currency: "eur",
              unit_amount: i.unitPriceCents,
              product_data: { name: i.productName, ...(i.options.length ? { description: i.options.map((o) => o.name).join(", ") } : {}) },
            },
          })),
          ...(order.deliveryFeeCents > 0
            ? [{ quantity: 1, price_data: { currency: "eur", unit_amount: order.deliveryFeeCents, product_data: { name: "Frais de livraison" } } }]
            : []),
        ];

  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      locale: "fr",
      customer_email: order.email,
      client_reference_id: order.id,
      line_items: lineItems,
      metadata: { orderId: order.id, orderNumber: String(order.number) },
      payment_intent_data: { metadata: { orderId: order.id, orderNumber: String(order.number) } },
      success_url: `${appUrl()}/commande/${order.publicToken}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/commande/${order.publicToken}?paiement=annule`,
      // La session Stripe expire 3 min AVANT la libération des stocks : un paiement ne peut pas aboutir après.
      expires_at: Math.floor(order.holdExpiresAt.getTime() / 1000) - 180,
    },
    { idempotencyKey: `checkout-${order.id}` },
  );
  return { url: session.url!, sessionId: session.id };
}

export async function retrieveCheckoutSession(sessionId: string) {
  return stripe().checkout.sessions.retrieve(sessionId);
}

export async function expireCheckoutSession(sessionId: string) {
  try {
    await stripe().checkout.sessions.expire(sessionId);
  } catch {
    /* déjà expirée ou payée */
  }
}

export async function refundPayment(paymentIntentId: string, amountCents: number, idempotencyKey: string) {
  const r = await stripe().refunds.create({ payment_intent: paymentIntentId, amount: amountCents }, { idempotencyKey });
  return { id: r.id, status: r.status ?? "pending" };
}
