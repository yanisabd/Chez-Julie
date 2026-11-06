import { and, desc, eq, gte, lte, ne, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/auth";
import { audit } from "@/server/log";
import { STATUS, type OrderStatus } from "@/lib/constants";
import { formatDateTime, formatHour } from "@/lib/time";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  // Protection contre l'injection de formules dans Excel
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};
const euros = (c: number) => (c / 100).toFixed(2).replace(".", ",");

/** Export CSV des commandes (comptabilité), compatible Excel. Réservé à l'administrateur. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return new Response("Non autorisé", { status: 401 });
  const url = new URL(req.url);
  const where: SQL[] = [ne(schema.orders.status, "expired"), ne(schema.orders.status, "pending_payment")];
  const statut = url.searchParams.get("statut");
  if (statut && statut in STATUS) where.push(eq(schema.orders.status, statut as OrderStatus));
  const jour = url.searchParams.get("jour");
  if (jour && /^\d{4}-\d{2}-\d{2}$/.test(jour)) where.push(eq(schema.orders.serviceDay, jour));
  const from = url.searchParams.get("du");
  const to = url.searchParams.get("au");
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) where.push(gte(schema.orders.serviceDay, from));
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) where.push(lte(schema.orders.serviceDay, to));

  const orders = await db.select().from(schema.orders).where(and(...where)).orderBy(desc(schema.orders.serviceDay)).limit(10000);
  const payments = await db.select().from(schema.payments);
  const header = ["N°", "Date commande", "Jour de service", "Heure", "Mode", "Statut", "Paiement", "Client", "Email", "Téléphone", "Sous-total", "Remise", "Livraison", "Total", "Remboursé", "Encaissé net", "Référence paiement"];
  const lines = orders.map((o) => {
    const p = payments.find((x) => x.orderId === o.id);
    const refunded = p?.refundedCents ?? 0;
    return [
      o.number,
      formatDateTime(o.createdAt),
      o.serviceDay,
      formatHour(o.slotStart),
      o.mode === "pickup" ? "Retrait" : "Livraison",
      STATUS[o.status].label,
      o.paymentStatus,
      o.customerName,
      o.email,
      o.phone,
      euros(o.subtotalCents),
      euros(o.discountCents),
      euros(o.deliveryFeeCents),
      euros(o.totalCents),
      euros(refunded),
      euros(p ? p.amountCents - refunded : 0),
      p?.reference ?? "",
    ]
      .map(cell)
      .join(";");
  });
  await audit({ id: user.id, label: user.name }, "orders.export", "order", null, { count: orders.length });
  const csv = "﻿" + [header.map(cell).join(";"), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="commandes-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
