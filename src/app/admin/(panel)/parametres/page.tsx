import { getSettings } from "@/server/settings";
import { PageHeader, Card, Field, Input, Textarea, Help } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action";
import { saveBusiness, saveLegal } from "../actions/settings";

export const metadata = { title: "Paramètres du site" };

export default async function SettingsPage() {
  const s = await getSettings();
  const b = s.business;
  const l = s.legal;
  return (
    <div>
      <PageHeader title="Paramètres du site" subtitle="Nom, textes, coordonnées et informations légales." />
      <div className="space-y-6">
        <Card>
          <h2 className="font-sans text-lg font-bold">Votre activité</h2>
          <ActionForm action={saveBusiness} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Nom de la dark kitchen">
              <Input name="name" defaultValue={b.name} required />
            </Field>
            <Field label="Slogan">
              <Input name="tagline" defaultValue={b.tagline} />
            </Field>
            <Field label="Présentation (page d’accueil)" className="sm:col-span-2">
              <Textarea name="about" defaultValue={b.about} rows={3} />
            </Field>
            <Field label="Téléphone">
              <Input name="phone" defaultValue={b.phone} />
            </Field>
            <Field label="Email de contact">
              <Input name="email" type="email" defaultValue={b.email} />
            </Field>
            <Field label="Bandeau d’annonce / promotion" hint="Affiché en haut du site. Laisser vide pour le masquer." className="sm:col-span-2">
              <Input name="announcement" defaultValue={b.announcement} placeholder="🎉 -10 % avec le code BIENVENUE10" />
            </Field>
            <Field label="Lien Instagram (facultatif)" className="sm:col-span-2">
              <Input name="instagram" defaultValue={b.instagram} placeholder="https://instagram.com/…" />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Enregistrer</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card>
          <h2 className="font-sans text-lg font-bold">Informations légales</h2>
          <Help title="À faire vérifier avant l’ouverture">
            Ces informations alimentent les mentions légales, les CGV et la politique de confidentialité. Faites-les valider par un professionnel (comptable, juriste, CCI) et déclarez votre activité alimentaire auprès de la DDPP.
          </Help>
          <ActionForm action={saveLegal} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom ou raison sociale">
              <Input name="companyName" defaultValue={l.companyName} />
            </Field>
            <Field label="Forme juridique">
              <Input name="legalForm" defaultValue={l.legalForm} />
            </Field>
            <Field label="SIRET">
              <Input name="siret" defaultValue={l.siret} />
            </Field>
            <Field label="Directeur de la publication">
              <Input name="publisher" defaultValue={l.publisher} />
            </Field>
            <Field label="Adresse du siège" className="sm:col-span-2">
              <Input name="address" defaultValue={l.address} />
            </Field>
            <Field label="Mention TVA">
              <Input name="vatNote" defaultValue={l.vatNote} />
            </Field>
            <Field label="Hébergeur du site">
              <Input name="host" defaultValue={l.host} />
            </Field>
            <Field label="Déclaration sanitaire / agrément" className="sm:col-span-2">
              <Input name="hygieneNote" defaultValue={l.hygieneNote} />
            </Field>
            <Field label="Conservation des données clients (mois)" hint="Au-delà, les données personnelles des commandes sont anonymisées automatiquement (RGPD).">
              <Input name="retentionMonths" type="number" min={6} max={120} defaultValue={s.privacy.retentionMonths} />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Enregistrer</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
