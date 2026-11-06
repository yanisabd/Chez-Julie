import { and, count, eq, isNull, inArray } from "drizzle-orm";
import { requirePageRole } from "@/server/auth";
import { getSettings } from "@/server/settings";
import { runMaintenance } from "@/server/maintenance";
import { db, schema } from "@/db";
import { AdminNav } from "./nav";

export const metadata = { title: { default: "Administration", template: "%s · Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole(["admin"]);
  const s = await getSettings();
  void runMaintenance();
  const [{ n: toAccept }] = await db.select({ n: count() }).from(schema.orders).where(eq(schema.orders.status, "new"));
  const [{ n: issues }] = await db
    .select({ n: count() })
    .from(schema.orderEvents)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderEvents.orderId))
    .where(and(eq(schema.orderEvents.kind, "issue"), isNull(schema.orderEvents.resolvedAt), inArray(schema.orders.status, ["new", "accepted", "preparing", "ready", "out_for_delivery"])));
  return (
    <div className="min-h-dvh lg:flex">
      <AdminNav name={s.business.name} userName={user.name} badges={{ "/admin/commandes": toAccept + issues }} paused={s.ordering.paused} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
