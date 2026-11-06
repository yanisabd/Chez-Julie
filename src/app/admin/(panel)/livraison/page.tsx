import { asc } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { db, schema } from "@/db";
import { getSettings } from "@/server/settings";
import { centsToInput, formatPrice } from "@/lib/format";
import { PageHeader, Help, Card, Field, Input, Textarea, Check, Badge } from "@/components/ui";
import { ActionForm, SubmitButton, ActionButton } from "@/components/action";
import { saveFulfillment, saveZone, deleteZone } from "../actions/delivery";

export const metadata = { title: "Retrait & livraison" };

type Zone = typeof schema.deliveryZones.$inferSelect;

function ZoneForm({ z }: { z?: Zone }) {
  return (
    <ActionForm action={saveZone.bind(null, z?.id ?? null)} reset={!z} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Nom de la zone">
        <Input name="name" defaultValue={z?.name} placeholder="Zone 1 – Proximité" required />
      </Field>
      <Field label="Codes postaux" hint="Séparés par des virgules" className="lg:col-span-2">
        <Input name="postalCodes" defaultValue={z?.postalCodes.join(", ")} placeholder="75011, 75012, 75020" required />
      </Field>
      <Field label="Frais de livraison (€)">
        <Input name="fee" inputMode="decimal" defaultValue={centsToInput(z?.feeCents ?? 0)} />
      </Field>
      <Field label="Minimum de commande (€)">
        <Input name="minOrder" inputMode="decimal" defaultValue={centsToInput(z?.minOrderCents ?? 0)} />
      </Field>
      <Field label="Livraison offerte dès (€)" hint="Vide = jamais offerte">
        <Input name="freeAbove" inputMode="decimal" defaultValue={centsToInput(z?.freeAboveCents)} />
      </Field>
      <Field label="Limiter à certaines villes (facultatif)" hint="Utile si un code postal couvre plusieurs communes" className="lg:col-span-2">
        <Input name="cities" defaultValue={z?.cities.join(", ")} placeholder="Laisser vide pour tout le code postal" />
      </Field>
      <div className="flex items-end justify-between gap-2">
        <Check name="active" defaultChecked={z?.active ?? true} label="Zone active" />
        <SubmitButton>{z ? "Enregistrer" : "Ajouter la zone"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function DeliveryPage() {
  const s = await getSettings();
  const zones = await db.select().from(schema.deliveryZones).orderBy(asc(schema.deliveryZones.id));
  return (
    <div>
      <PageHeader title="Retrait & livraison" subtitle="Où et comment vos clients récupèrent leur commande." />

      <Card className="mb-8">
        <ActionForm action={saveFulfillment} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Check name="pickupEnabled" defaultChecked={s.ordering.pickupEnabled} label="Proposer le retrait sur place" />
            <Check name="deliveryEnabled" defaultChecked={s.ordering.deliveryEnabled} label="Proposer la livraison" />
          </div>
          <Field label="Adresse de retrait" hint="Affichée au client après sa commande et dans les emails.">
            <Input name="pickupAddress" defaultValue={s.business.pickupAddress} />
          </Field>
          <Field label="Instructions de retrait">
            <Textarea name="pickupInstructions" defaultValue={s.business.pickupInstructions} rows={2} />
          </Field>
          <SubmitButton>Enregistrer</SubmitButton>
        </ActionForm>
      </Card>

      <h2 className="mb-3 font-sans text-xl font-bold">Zones de livraison</h2>
      <Help>Le site vérifie automatiquement le code postal du client. S’il n’est dans aucune zone active, la livraison lui est refusée (le retrait reste possible).</Help>
      <div className="space-y-3">
        {zones.map((z) => (
          <Card key={z.id}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{z.name}</span>
                {!z.active && <Badge className="bg-stone-100 text-stone-600 ring-stone-300">Inactive</Badge>}
                <span className="text-sm text-muted">{formatPrice(z.feeCents)}</span>
              </div>
              <ActionButton action={deleteZone.bind(null, z.id)} variant="ghost" size="sm" confirm={`Supprimer la zone « ${z.name} » ?`}>
                <Trash2 className="size-4" />
              </ActionButton>
            </div>
            <ZoneForm z={z} />
          </Card>
        ))}
        <Card className="ring-2 ring-dashed ring-sand-dark">
          <h3 className="mb-3 font-sans font-bold">Nouvelle zone</h3>
          <ZoneForm />
        </Card>
      </div>
    </div>
  );
}
