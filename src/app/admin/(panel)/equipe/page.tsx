import { asc, desc, eq, sql } from "drizzle-orm";
import { ChefHat, ShieldCheck, Trash2, Lock } from "lucide-react";
import { db, schema } from "@/db";
import { requirePageRole } from "@/server/auth";
import { formatDateTime } from "@/lib/time";
import { PageHeader, Help, Card, Field, Input, Badge, Table } from "@/components/ui";
import { ActionForm, SubmitButton, ActionButton } from "@/components/action";
import { createKitchenUser, setKitchenPin, createAdmin, setPassword, toggleUser, deleteKitchenUser, unlockUser } from "../actions/team";

export const metadata = { title: "Équipe" };

export default async function TeamPage() {
  const me = await requirePageRole(["admin"]);
  const staff = await db.select().from(schema.users).where(sql`${schema.users.role} IN ('admin','kitchen')`).orderBy(asc(schema.users.role), asc(schema.users.name));
  const customers = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, phone: schema.users.phone, active: schema.users.active, createdAt: schema.users.createdAt, orders: sql<number>`(SELECT count(*)::int FROM orders o WHERE o.user_id = ${schema.users.id} AND o.paid_at IS NOT NULL)` })
    .from(schema.users)
    .where(eq(schema.users.role, "customer"))
    .orderBy(desc(schema.users.createdAt))
    .limit(100);
  const now = new Date();

  return (
    <div>
      <PageHeader title="Équipe" subtitle="Qui peut accéder à l’espace cuisine et à l’administration." />
      <Help>
        L’équipe de cuisine se connecte sur <b>/cuisine</b> en touchant son prénom puis en tapant son code à 4 chiffres. Elle voit uniquement les commandes à préparer : ni les prix, ni les coordonnées des clients, ni les réglages.
      </Help>

      <div className="space-y-3">
        {staff.map((u) => {
          const locked = u.lockedUntil && u.lockedUntil > now;
          return (
            <Card key={u.id} className={!u.active ? "opacity-60" : ""}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <span className={`grid size-11 place-items-center rounded-full ${u.role === "admin" ? "bg-forest-light text-forest" : "bg-terracotta-light text-terracotta"}`}>
                    {u.role === "admin" ? <ShieldCheck className="size-5" /> : <ChefHat className="size-5" />}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      {u.name}
                      <Badge className={u.role === "admin" ? "bg-forest-light text-forest ring-forest/20" : "bg-terracotta-light text-terracotta-dark ring-terracotta/20"}>{u.role === "admin" ? "Administrateur" : "Cuisine"}</Badge>
                      {!u.active && <Badge className="bg-stone-100 text-stone-600 ring-stone-300">Désactivé</Badge>}
                      {locked && <Badge className="bg-red-100 text-red-800 ring-red-300">Bloqué (trop d’essais)</Badge>}
                      {u.id === me.id && <span className="text-sm text-muted">(vous)</span>}
                    </div>
                    <div className="text-sm text-muted">
                      {u.email ?? "Connexion par code"} · dernière connexion : {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "jamais"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {locked && (
                    <ActionButton action={unlockUser.bind(null, u.id)} size="sm">
                      <Lock className="size-4" /> Débloquer
                    </ActionButton>
                  )}
                  <details className="relative">
                    <summary className="flex h-9 cursor-pointer list-none items-center rounded-full px-4 text-sm font-semibold ring-1 ring-sand-dark hover:bg-sand">
                      {u.role === "kitchen" ? "Changer le code" : "Changer le mot de passe"}
                    </summary>
                    <Card className="absolute right-0 z-20 mt-1 w-72">
                      {u.role === "kitchen" ? (
                        <ActionForm action={setKitchenPin.bind(null, u.id)} reset className="space-y-2">
                          <Field label="Nouveau code (4 chiffres)">
                            <Input name="pin" inputMode="numeric" pattern="\d{4}" maxLength={4} required />
                          </Field>
                          <SubmitButton size="sm">Enregistrer</SubmitButton>
                        </ActionForm>
                      ) : (
                        <ActionForm action={setPassword.bind(null, u.id)} reset className="space-y-2">
                          <Field label="Nouveau mot de passe" hint="10 caractères min., lettres et chiffres">
                            <Input name="password" type="password" autoComplete="new-password" required />
                          </Field>
                          <SubmitButton size="sm">Enregistrer</SubmitButton>
                        </ActionForm>
                      )}
                    </Card>
                  </details>
                  {u.id !== me.id && (
                    <ActionButton action={toggleUser.bind(null, u.id)} size="sm" confirm={u.active ? `Désactiver ${u.name} ? La personne sera déconnectée immédiatement.` : undefined}>
                      {u.active ? "Désactiver" : "Réactiver"}
                    </ActionButton>
                  )}
                  {u.role === "kitchen" && (
                    <ActionButton action={deleteKitchenUser.bind(null, u.id)} size="sm" variant="ghost" confirm={`Supprimer définitivement le profil ${u.name} ?`}>
                      <Trash2 className="size-4" />
                    </ActionButton>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 font-sans text-lg font-bold">
            <ChefHat className="size-5" /> Ajouter une personne en cuisine
          </h2>
          <ActionForm action={createKitchenUser} reset className="mt-3 space-y-3">
            <Field label="Prénom">
              <Input name="name" required />
            </Field>
            <Field label="Code à 4 chiffres" hint="À communiquer à la personne. Évitez 1234 ou 0000.">
              <Input name="pin" inputMode="numeric" pattern="\d{4}" maxLength={4} required />
            </Field>
            <SubmitButton>Créer le profil</SubmitButton>
          </ActionForm>
        </Card>
        <Card>
          <h2 className="flex items-center gap-2 font-sans text-lg font-bold">
            <ShieldCheck className="size-5" /> Ajouter un administrateur
          </h2>
          <ActionForm action={createAdmin} reset className="mt-3 space-y-3">
            <Field label="Nom">
              <Input name="name" required />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" required />
            </Field>
            <Field label="Mot de passe" hint="10 caractères min., lettres et chiffres">
              <Input name="password" type="password" autoComplete="new-password" required />
            </Field>
            <SubmitButton>Créer</SubmitButton>
          </ActionForm>
        </Card>
      </div>

      <h2 className="mb-3 mt-10 font-sans text-xl font-bold">Comptes clients ({customers.length})</h2>
      <Table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Contact</th>
            <th>Commandes</th>
            <th>Inscrit le</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className={!c.active ? "opacity-60" : ""}>
              <td className="font-medium">{c.name}</td>
              <td className="text-sm">
                {c.email}
                <div className="text-muted">{c.phone}</div>
              </td>
              <td>{c.orders}</td>
              <td className="text-sm text-muted">{formatDateTime(c.createdAt)}</td>
              <td className="text-right">
                <ActionButton action={toggleUser.bind(null, c.id)} size="sm" variant="ghost" confirm={c.active ? `Bloquer le compte de ${c.name} ?` : undefined}>
                  {c.active ? "Bloquer" : "Débloquer"}
                </ActionButton>
              </td>
            </tr>
          ))}
          {customers.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-muted">
                Aucun client n’a encore créé de compte (le compte est facultatif).
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
