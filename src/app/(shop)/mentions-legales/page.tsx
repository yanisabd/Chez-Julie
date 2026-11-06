import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "Mentions légales" };

export default async function Page() {
  const s = await getSettings();
  const l = s.legal;
  return (
    <LegalPage title="Mentions légales">
      <h2>Éditeur du site</h2>
      <p>
        {l.companyName} – {l.legalForm}
        <br />
        SIRET : {l.siret}
        <br />
        Adresse : {l.address}
        <br />
        Téléphone : {s.business.phone} – Email : {s.business.email}
        <br />
        Directeur de la publication : {l.publisher}
        <br />
        {l.vatNote}
      </p>
      <h2>Activité alimentaire</h2>
      <p>{l.hygieneNote}</p>
      <h2>Hébergement</h2>
      <p>{l.host}</p>
      <h2>Propriété intellectuelle</h2>
      <p>L’ensemble des contenus de ce site (textes, photos, logo) est la propriété de {s.business.name}. Toute reproduction sans autorisation est interdite.</p>
      <h2>Médiation de la consommation</h2>
      <p>
        Conformément à l’article L.612-1 du Code de la consommation, le client peut recourir gratuitement à un médiateur de la consommation. Coordonnées du médiateur : à compléter avant la mise en ligne.
      </p>
    </LegalPage>
  );
}
