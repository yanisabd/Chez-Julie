import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getSettings } from "@/server/settings";
import { getCurrentUser } from "@/server/auth";
import { db, schema } from "@/db";
import { Checkout } from "./checkout";

export const metadata: Metadata = { title: "Commander", description: "Choisissez votre créneau de retrait ou de livraison et payez en ligne en toute sécurité." };

export default async function CheckoutPage() {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()]);
  let prefill: { name: string; email: string; phone: string } | null = null;
  if (user?.role === "customer") {
    const u = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
    if (u) prefill = { name: u.name, email: u.email ?? "", phone: u.phone ?? "" };
  }
  return (
    <Checkout
      config={{
        paused: s.ordering.paused,
        pauseMessage: s.ordering.pauseMessage,
        pickupEnabled: s.ordering.pickupEnabled,
        deliveryEnabled: s.ordering.deliveryEnabled,
        promoEnabled: s.ordering.promoCodesEnabled,
        minLeadHours: s.ordering.minLeadHours,
        pickupAddress: s.business.pickupAddress,
        cancelDeadlineHours: s.ordering.allowCustomerCancel ? s.ordering.cancelDeadlineHours : null,
        loggedIn: !!prefill,
      }}
      prefill={prefill}
    />
  );
}
