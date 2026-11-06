import { sql } from "drizzle-orm";
import { db } from "@/db";
import { parisDay, addDays } from "@/lib/time";

const rows = <T>(r: unknown) => (r as { rows: T[] }).rows;
const PAID = sql.raw(`('new','accepted','preparing','ready','out_for_delivery','completed')`);

export async function dashboardStats() {
  const today = parisDay();
  const byStatus = rows<{ status: string; n: number }>(
    await db.execute(sql`SELECT status, count(*)::int AS n FROM orders WHERE service_day = ${today} GROUP BY status`),
  );
  const count = (s: string) => byStatus.find((x) => x.status === s)?.n ?? 0;

  const revenue = rows<{ today: number; month: number; orders_today: number }>(
    await db.execute(sql`
      SELECT
        COALESCE(SUM(o.total_cents - COALESCE(p.refunded_cents,0)) FILTER (WHERE (o.paid_at AT TIME ZONE 'Europe/Paris')::date = ${today}::date), 0)::int AS today,
        COALESCE(SUM(o.total_cents - COALESCE(p.refunded_cents,0)) FILTER (WHERE date_trunc('month', o.paid_at AT TIME ZONE 'Europe/Paris') = date_trunc('month', ${today}::date)), 0)::int AS month,
        COUNT(*) FILTER (WHERE (o.paid_at AT TIME ZONE 'Europe/Paris')::date = ${today}::date)::int AS orders_today
      FROM orders o LEFT JOIN payments p ON p.order_id = o.id
      WHERE o.paid_at IS NOT NULL`),
  )[0];

  const top = rows<{ name: string; qty: number }>(
    await db.execute(sql`
      SELECT oi.product_name AS name, SUM(oi.quantity)::int AS qty
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status IN ${PAID} AND o.service_day >= ${addDays(today, -30)}
      GROUP BY oi.product_name ORDER BY qty DESC LIMIT 5`),
  );

  const lowProducts = rows<{ id: number; name: string; left: number; alert: number }>(
    await db.execute(sql`
      SELECT id, name, (stock_qty - reserved_qty)::int AS "left", alert_threshold::int AS alert FROM products
      WHERE deleted_at IS NULL AND active AND stock_qty IS NOT NULL AND alert_threshold IS NOT NULL AND stock_qty - reserved_qty <= alert_threshold
      ORDER BY 3 ASC`),
  );
  const lowIngredients = rows<{ id: number; name: string; left: number; unit: string; alert: number }>(
    await db.execute(sql`
      SELECT id, name, (stock - reserved)::int AS "left", unit, alert_threshold::int AS alert FROM ingredients
      WHERE alert_threshold IS NOT NULL AND stock - reserved <= alert_threshold ORDER BY name`),
  );

  const fullSlots = rows<{ starts_at: string; booked_orders: number; max_orders: number | null; booked_items: number; max_items: number | null; blocked: boolean }>(
    await db.execute(sql`
      SELECT starts_at, booked_orders, max_orders, booked_items, max_items, blocked FROM slots
      WHERE starts_at > now() AND day <= ${addDays(today, 3)} AND blocked = false ORDER BY starts_at`),
  );

  const issues = rows<{ id: number; order_id: string; number: number; message: string; actor_label: string; created_at: string }>(
    await db.execute(sql`
      SELECT e.id, e.order_id, o.number, e.message, e.actor_label, e.created_at FROM order_events e JOIN orders o ON o.id = e.order_id
      WHERE e.kind = 'issue' AND e.resolved_at IS NULL ORDER BY e.created_at DESC LIMIT 10`),
  );

  const failedEmails = rows<{ n: number }>(await db.execute(sql`SELECT count(*)::int AS n FROM notifications WHERE status = 'failed'`))[0].n;
  const errors = rows<{ n: number }>(await db.execute(sql`SELECT count(*)::int AS n FROM system_logs WHERE level = 'error' AND acknowledged = false`))[0].n;

  return {
    today,
    counts: {
      total: byStatus.filter((x) => !["pending_payment", "expired"].includes(x.status)).reduce((n, x) => n + x.n, 0),
      new: count("new"),
      accepted: count("accepted"),
      preparing: count("preparing"),
      ready: count("ready") + count("out_for_delivery"),
      completed: count("completed"),
      cancelled: count("cancelled"),
    },
    revenue,
    top,
    lowProducts,
    lowIngredients,
    fullSlots,
    issues,
    failedEmails,
    errors,
  };
}

export async function salesStats(from: string, to: string) {
  const daily = rows<{ day: string; orders: number; revenue: number }>(
    await db.execute(sql`
      SELECT d::date::text AS day,
        COUNT(o.id)::int AS orders,
        COALESCE(SUM(o.total_cents - COALESCE(p.refunded_cents,0)),0)::int AS revenue
      FROM generate_series(${from}::date, ${to}::date, interval '1 day') d
      LEFT JOIN orders o ON o.service_day = d::date AND o.status IN ${PAID}
      LEFT JOIN payments p ON p.order_id = o.id
      GROUP BY d ORDER BY d`),
  );
  const products = rows<{ name: string; qty: number; revenue: number }>(
    await db.execute(sql`
      SELECT oi.product_name AS name, SUM(oi.quantity)::int AS qty, SUM(oi.line_total_cents)::int AS revenue
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status IN ${PAID} AND o.service_day BETWEEN ${from} AND ${to}
      GROUP BY oi.product_name ORDER BY qty DESC`),
  );
  const modes = rows<{ mode: string; n: number }>(
    await db.execute(sql`SELECT mode::text, count(*)::int AS n FROM orders WHERE status IN ${PAID} AND service_day BETWEEN ${from} AND ${to} GROUP BY mode`),
  );
  const slots = rows<{ hour: string; n: number }>(
    await db.execute(sql`
      SELECT to_char(slot_start AT TIME ZONE 'Europe/Paris', 'HH24"h"MI') AS hour, count(*)::int AS n
      FROM orders WHERE status IN ${PAID} AND service_day BETWEEN ${from} AND ${to} GROUP BY 1 ORDER BY 1`),
  );
  const cancel = rows<{ cancelled: number; refunded: number }>(
    await db.execute(sql`
      SELECT count(*) FILTER (WHERE status = 'cancelled' AND paid_at IS NOT NULL)::int AS cancelled,
             COALESCE((SELECT SUM(amount_cents) FROM refunds r JOIN orders o2 ON o2.id = r.order_id WHERE o2.service_day BETWEEN ${from} AND ${to}),0)::int AS refunded
      FROM orders WHERE service_day BETWEEN ${from} AND ${to}`),
  )[0];
  const customers = rows<{ n: number; returning: number }>(
    await db.execute(sql`
      WITH c AS (SELECT lower(email) AS e, count(*) AS n FROM orders WHERE status IN ${PAID} AND service_day BETWEEN ${from} AND ${to} AND anonymized_at IS NULL GROUP BY 1)
      SELECT count(*)::int AS n, count(*) FILTER (WHERE n > 1)::int AS returning FROM c`),
  )[0];
  const totalRevenue = daily.reduce((n, d) => n + d.revenue, 0);
  const totalOrders = daily.reduce((n, d) => n + d.orders, 0);
  return { daily, products, modes, slots, cancel, customers, totalRevenue, totalOrders, avgBasket: totalOrders ? Math.round(totalRevenue / totalOrders) : 0 };
}
