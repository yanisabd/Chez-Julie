import Link from "next/link";
import type { Metadata } from "next";
import { desc, eq, and, ne } from "drizzle-orm";
import { ChevronRight, LogOut, ShoppingBag } from "lucide-react";
import { db, schema } from "@/db";
import { requirePageRole } from "@/server/auth";
import { formatPrice } from "@/lib/format";
import { formatHour, relativeDayLabel } from "@/lib/time";
import { Card, EmptyState, Field, Input, StatusBadge, btnClass } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action";
import { updateProfile, deleteAccount, customerLogout } from "./actions";

export const metadata: Metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const user = await requirePageRole(["customer"]);
  const u = (await db.query.users.findFirst({ where: eq(schema.users.id, user.id) }))!;
  const orders = await db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.userId, user.id), ne(schema.orders.status, "pending_payment"), ne(schema.orders.status, "expired")))
    .orderBy(desc(schema.orders.slotStart))
    .limit(50);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Bonjour {u.name.split(" ")[0]} 👋</h1>
        <form action={customerLogout}>
          <button className={btnClass("ghost", "sm")}>
            <LogOut className="size-4" /> Déconnexion
          </button>
        </form>
      </div>

      <h2 className="mt-8 font-sans text-xl font-bold">Mes commandes</h2>
      {orders.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon={<ShoppingBag className="size-10" />} title="Aucune commande pour l’instant">
            <Link href="/menu" className={btnClass("primary", "md", "mt-4")}>
              Découvrir la carte
            </Link>
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/commande/${o.publicToken}`} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 hover:shadow-md">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">n°{o.number}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-0.5 text-[15px] text-muted">
                    {o.mode === "pickup" ? "Retrait" : "Livraison"} · {relativeDayLabel(o.serviceDay)} à {formatHour(o.slotStart)}
                  </div>
                </div>
                <span className="font-semibold">{formatPrice(o.totalCents)}</span>
                <ChevronRight className="size-5 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 font-sans text-xl font-bold">Mes informations</h2>
      <Card className="mt-3">
        <ActionForm action={updateProfile} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom" htmlFor="name">
            <Input id="name" name="name" defaultValue={u.name} required />
          </Field>
          <Field label="Téléphone" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={u.phone ?? ""} required />
          </Field>
          <Field label="Email" className="sm:col-span-2" hint="Pour changer d’email, contactez-nous.">
            <Input value={u.email ?? ""} disabled />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Enregistrer</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <details className="mt-10 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <summary className="cursor-pointer font-semibold text-red-700">Supprimer mon compte</summary>
        <p className="mt-3 text-[15px] text-muted">
          Votre compte sera supprimé définitivement et vos commandes passées seront anonymisées (seuls les montants sont conservés pour notre comptabilité).
        </p>
        <ActionForm action={deleteAccount} success={null} confirm="Supprimer définitivement votre compte ?" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Confirmez avec votre mot de passe" className="flex-1" htmlFor="delpw">
            <Input id="delpw" name="password" type="password" required />
          </Field>
          <SubmitButton variant="danger">Supprimer</SubmitButton>
        </ActionForm>
      </details>
    </div>
  );
}
