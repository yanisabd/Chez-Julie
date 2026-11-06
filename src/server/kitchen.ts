import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { OrderStatus } from "@/lib/constants";

export type KitchenOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  mode: "pickup" | "delivery";
  slotStart: string;
  slotEnd: string;
  startBy: string;
  /** Prénom + initiale uniquement : la cuisine n'a pas accès aux données personnelles. */
  customer: string;
  city: string | null;
  kitchenNotes: string | null;
  items: { name: string; qty: number; options: string[] }[];
  openIssues: number;
};

const shortName = (full: string) => {
  const [first, ...rest] = full.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0].toUpperCase()}.` : first;
};

export async function getKitchenOrders(day: string, prepMinutes: number): Promise<{ orders: KitchenOrder[]; cancelled: { number: number; slotStart: string }[] }> {
  const rows = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.serviceDay, day), inArray(schema.orders.status, ["new", "accepted", "preparing", "ready", "out_for_delivery", "completed", "cancelled"])))
    .orderBy(asc(schema.orders.slotStart), asc(schema.orders.number));
  const ids = rows.map((r) => r.id);
  const items = ids.length ? await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, ids)) : [];
  const issues = ids.length
    ? await db
        .select({ orderId: schema.orderEvents.orderId })
        .from(schema.orderEvents)
        .where(and(inArray(schema.orderEvents.orderId, ids), eq(schema.orderEvents.kind, "issue"), isNull(schema.orderEvents.resolvedAt)))
    : [];

  const orders: KitchenOrder[] = rows
    .filter((r) => r.status !== "cancelled")
    .map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status,
      mode: r.mode,
      slotStart: r.slotStart.toISOString(),
      slotEnd: r.slotEnd.toISOString(),
      startBy: new Date(r.slotStart.getTime() - prepMinutes * 60000).toISOString(),
      customer: shortName(r.customerName),
      city: r.mode === "delivery" ? r.city : null,
      kitchenNotes: r.kitchenNotes,
      items: items.filter((i) => i.orderId === r.id).map((i) => ({ name: i.productName, qty: i.quantity, options: i.options.map((o) => o.name) })),
      openIssues: issues.filter((x) => x.orderId === r.id).length,
    }));
  // Commandes annulées APRÈS avoir été payées : à signaler pour ne pas les préparer
  const cancelled = rows.filter((r) => r.status === "cancelled" && r.paidAt).map((r) => ({ number: r.number, slotStart: r.slotStart.toISOString() }));
  return { orders, cancelled };
}

/** Quantités totales à produire pour une journée. */
export async function getProduction(day: string) {
  const rows = await db
    .select({ id: schema.orders.id, status: schema.orders.status, slotStart: schema.orders.slotStart })
    .from(schema.orders)
    .where(and(eq(schema.orders.serviceDay, day), inArray(schema.orders.status, ["new", "accepted", "preparing", "ready", "out_for_delivery", "completed"])));
  const ids = rows.map((r) => r.id);
  const items = ids.length ? await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, ids)) : [];
  type Line = { name: string; total: number; todo: number; options: Map<string, number>; bySlot: Map<string, number> };
  const map = new Map<string, Line>();
  for (const it of items) {
    const o = rows.find((r) => r.id === it.orderId)!;
    const todo = o.status === "new" || o.status === "accepted";
    const line = map.get(it.productName) ?? { name: it.productName, total: 0, todo: 0, options: new Map(), bySlot: new Map() };
    line.total += it.quantity;
    if (todo) line.todo += it.quantity;
    for (const op of it.options) line.options.set(op.name, (line.options.get(op.name) ?? 0) + it.quantity);
    const k = o.slotStart.toISOString();
    line.bySlot.set(k, (line.bySlot.get(k) ?? 0) + it.quantity);
    map.set(it.productName, line);
  }
  const slots = [...new Set(rows.map((r) => r.slotStart.toISOString()))].sort();
  return {
    slots,
    lines: [...map.values()]
      .sort((a, b) => b.total - a.total)
      .map((l) => ({ name: l.name, total: l.total, todo: l.todo, options: [...l.options.entries()], bySlot: Object.fromEntries(l.bySlot) })),
    orderCount: rows.length,
  };
}
