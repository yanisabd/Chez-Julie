import { desc } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { db, schema } from "@/db";
import { getSettings } from "@/server/settings";
import { formatPrice } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { PageHeader, Help, Card, Field, Input, Select, Table, Badge } from "@/components/ui";
import { ActionForm, SubmitButton, ActionButton } from "@/components/action";
import { savePromo, togglePromo, deletePromo, togglePromos } from "../actions/delivery";

export const metadata = { title: "Codes promo" };

export default async function PromosPage() {
  const s = await getSettings();
  const promos = await db.select().from(schema.promoCodes).orderBy(desc(schema.promoCodes.createdAt));
  const now = new Date();
  return (
    <div>
      <PageHeader
        title="Codes promo"
        subtitle="Offrez une réduction avec un code à saisir au moment de payer."
        actions={
          <ActionButton action={togglePromos} variant={s.ordering.promoCodesEnabled ? "outline" : "secondary"} success={s.ordering.promoCodesEnabled ? "Codes promo désactivés" : "Codes promo activés"}>
            {s.ordering.promoCodesEnabled ? "Désactiver les codes promo" : "Activer les codes promo"}
          </ActionButton>
        }
      />
      {!s.ordering.promoCodesEnabled && <Help title="Les codes promo sont désactivés">Le champ « code promo » n’est pas proposé aux clients.</Help>}

      <Card className="mb-6">
        <h2 className="font-sans text-lg font-bold">Créer un code</h2>
        <ActionForm action={savePromo} reset className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Code">
            <Input name="code" placeholder="BIENVENUE10" className="uppercase" required />
          </Field>
          <Field label="Type">
            <Select name="kind" defaultValue="percent">
              <option value="percent">Pourcentage (%)</option>
              <option value="fixed">Montant fixe (€)</option>
            </Select>
          </Field>
          <Field label="Valeur" hint="Ex. : 10 (pour 10 % ou 10 €)">
            <Input name="value" inputMode="decimal" required />
          </Field>
          <Field label="Dès (€ d’achat)">
            <Input name="minOrder" inputMode="decimal" placeholder="0" />
          </Field>
          <Field label="Valable à partir du">
            <Input name="startsAt" type="date" />
          </Field>
          <Field label="Jusqu’au (inclus)">
            <Input name="endsAt" type="date" />
          </Field>
          <Field label="Utilisations max" hint="Vide = illimité">
            <Input name="maxUses" type="number" min={1} />
          </Field>
          <div className="flex items-end">
            <SubmitButton className="w-full">Créer</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <Table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Réduction</th>
            <th>Conditions</th>
            <th>Utilisations</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {promos.map((p) => {
            const expired = p.endsAt && p.endsAt < now;
            return (
              <tr key={p.id}>
                <td className="font-mono font-bold">{p.code}</td>
                <td>{p.kind === "percent" ? `-${p.value} %` : `-${formatPrice(p.value)}`}</td>
                <td className="text-sm text-muted">
                  {p.minOrderCents ? `Dès ${formatPrice(p.minOrderCents)}` : "Sans minimum"}
                  {p.endsAt && <div>Jusqu’au {formatDateTime(p.endsAt).slice(0, 10)}</div>}
                </td>
                <td>
                  {p.usedCount}
                  {p.maxUses ? ` / ${p.maxUses}` : ""}
                </td>
                <td>
                  {expired ? (
                    <Badge className="bg-stone-100 text-stone-600 ring-stone-300">Expiré</Badge>
                  ) : p.active ? (
                    <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-300">Actif</Badge>
                  ) : (
                    <Badge className="bg-stone-100 text-stone-600 ring-stone-300">Désactivé</Badge>
                  )}
                </td>
                <td className="text-right whitespace-nowrap">
                  <ActionButton action={togglePromo.bind(null, p.id)} size="sm" variant="ghost">
                    {p.active ? "Désactiver" : "Activer"}
                  </ActionButton>
                  <ActionButton action={deletePromo.bind(null, p.id)} size="sm" variant="ghost" confirm={`Supprimer le code ${p.code} ?`}>
                    <Trash2 className="size-4" />
                  </ActionButton>
                </td>
              </tr>
            );
          })}
          {promos.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-muted">
                Aucun code promo.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
