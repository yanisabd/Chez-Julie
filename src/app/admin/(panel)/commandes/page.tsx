import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL, ne } from "drizzle-orm";
import { Download, Search, Bike, Store } from "lucide-react";
import { db, schema } from "@/db";
import { formatPrice } from "@/lib/format";
import { formatHour, relativeDayLabel, formatDateTime } from "@/lib/time";
import { STATUS, type OrderStatus } from "@/lib/constants";
import { PageHeader, StatusBadge, PaymentBadge, Input, Select, btnClass, EmptyState, Help } from "@/components/ui";

export const metadata = { title: "Commandes" };

const PAGE = 30;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const statut = sp.statut ?? "";
  const jour = sp.jour ?? "";
  const mode = sp.mode ?? "";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where: SQL[] = [];
  if (statut === "actives") where.push(sql`${schema.orders.status} IN ('new','accepted','preparing','ready','out_for_delivery')`);
  else if (statut && statut in STATUS) where.push(eq(schema.orders.status, statut as OrderStatus));
  else if (!statut) where.push(ne(schema.orders.status, "expired"));
  if (jour && /^\d{4}-\d{2}-\d{2}$/.test(jour)) where.push(eq(schema.orders.serviceDay, jour));
  if (mode === "pickup" || mode === "delivery") where.push(eq(schema.orders.mode, mode));
  if (q) {
    const like = `%${q}%`;
    const num = Number(q.replace(/\D/g, ""));
    where.push(
      or(
        ilike(schema.orders.customerName, like),
        ilike(schema.orders.email, like),
        ilike(schema.orders.phone, like),
        ...(num ? [eq(schema.orders.number, num)] : []),
      )!,
    );
  }
  const cond = where.length ? and(...where) : undefined;
  const list = await db
    .select()
    .from(schema.orders)
    .where(cond)
    .orderBy(desc(schema.orders.slotStart), desc(schema.orders.number))
    .limit(PAGE + 1)
    .offset((page - 1) * PAGE);
  const hasMore = list.length > PAGE;
  const rows = list.slice(0, PAGE);
  const qs = (extra: Record<string, string | number>) => new URLSearchParams({ ...Object.fromEntries(Object.entries({ q, statut, jour, mode }).filter(([, v]) => v)), ...extra } as Record<string, string>).toString();

  return (
    <div>
      <PageHeader
        title="Commandes"
        subtitle="Toutes les commandes payées et leur suivi. Cliquez sur une commande pour la gérer."
        actions={
          <a href={`/api/admin/export?${qs({})}`} className={btnClass("outline", "md")}>
            <Download className="size-4" /> Exporter (Excel)
          </a>
        }
      />
      <Help>
        Les commandes passent automatiquement par les étapes <b>À préparer → En préparation → Prête → Terminée</b>. La cuisine fait avancer les étapes depuis son écran. Vous pouvez aussi le faire ici, annuler, rembourser ou ajouter une
        note.
      </Help>

      <form className="mb-4 grid gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input name="q" defaultValue={q} placeholder="N°, nom, email, téléphone…" className="pl-9" />
        </div>
        <Select name="statut" defaultValue={statut} aria-label="Statut">
          <option value="">Tous les statuts</option>
          <option value="actives">En cours</option>
          {(Object.keys(STATUS) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </Select>
        <Input type="date" name="jour" defaultValue={jour} aria-label="Jour de service" />
        <Select name="mode" defaultValue={mode} aria-label="Mode">
          <option value="">Retrait et livraison</option>
          <option value="pickup">Retrait</option>
          <option value="delivery">Livraison</option>
        </Select>
        <div className="flex gap-2">
          <button className={btnClass("secondary", "md", "h-auto flex-1")}>Filtrer</button>
          {(q || statut || jour || mode) && (
            <Link href="/admin/commandes" className={btnClass("ghost", "md", "h-auto")}>
              Effacer
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Aucune commande trouvée">Modifiez les filtres ou attendez les premières commandes.</EmptyState>
      ) : (
        <div className="space-y-2">
          {rows.map((o) => (
            <Link
              key={o.id}
              href={`/admin/commandes/${o.id}`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:shadow-md sm:grid-cols-[80px_1.2fr_1.3fr_1fr_auto]"
            >
              <div className="text-lg font-bold">n°{o.number}</div>
              <div className="min-w-0">
                <div className="truncate font-semibold">{o.customerName}</div>
                <div className="truncate text-sm text-muted">{o.phone}</div>
              </div>
              <div className="text-right font-semibold sm:hidden">{formatPrice(o.totalCents)}</div>
              <div className="col-span-3 flex items-center gap-2 text-[15px] sm:col-span-1">
                {o.mode === "delivery" ? <Bike className="size-4 text-violet-700" /> : <Store className="size-4 text-sky-700" />}
                <span>
                  {relativeDayLabel(o.serviceDay)} · {formatHour(o.slotStart)}
                </span>
              </div>
              <div className="col-span-3 flex flex-wrap gap-1.5 sm:col-span-1">
                <StatusBadge status={o.status} />
                <PaymentBadge status={o.paymentStatus} />
              </div>
              <div className="hidden text-right sm:block">
                <div className="font-semibold">{formatPrice(o.totalCents)}</div>
                <div className="text-xs text-muted">{formatDateTime(o.createdAt)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-between">
        {page > 1 ? (
          <Link href={`/admin/commandes?${qs({ page: page - 1 })}`} className={btnClass("outline")}>
            ← Plus récentes
          </Link>
        ) : (
          <span />
        )}
        {hasMore && (
          <Link href={`/admin/commandes?${qs({ page: page + 1 })}`} className={btnClass("outline")}>
            Plus anciennes →
          </Link>
        )}
      </div>
    </div>
  );
}
