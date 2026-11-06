import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default async function Page() {
  const s = await getSettings();
  return (
    <LegalPage title="Politique de confidentialité">
      <h2>Responsable du traitement</h2>
      <p>
        {s.legal.companyName}, {s.legal.address} – {s.business.email}
      </p>
      <h2>Données collectées et finalités</h2>
      <ul>
        <li>Nom, email, téléphone : traitement et suivi de votre commande, contact en cas de besoin (base légale : exécution du contrat).</li>
        <li>Adresse de livraison : livraison de votre commande (exécution du contrat).</li>
        <li>Historique de commandes : comptabilité et obligations légales (obligation légale).</li>
        <li>Données de compte (facultatif) : accès à votre historique (consentement).</li>
      </ul>
      <p>Vos données bancaires sont traitées exclusivement par notre prestataire de paiement Stripe et ne sont jamais stockées sur nos serveurs.</p>
      <h2>Destinataires</h2>
      <p>
        Seules les personnes qui en ont besoin y accèdent : le responsable et, pour la préparation, l’équipe de cuisine (qui ne voit que le prénom et le contenu de la commande). Sous-traitants techniques : hébergeur, Stripe (paiement),
        Resend (envoi d’emails).
      </p>
      <h2>Durée de conservation</h2>
      <p>
        Les données personnelles liées aux commandes sont automatiquement anonymisées au bout de {s.privacy.retentionMonths} mois. Les montants sont conservés pour les obligations comptables. Un compte client peut être supprimé à tout moment depuis
        l’espace « Mon compte ».
      </p>
      <h2>Cookies</h2>
      <p>
        Ce site n’utilise aucun cookie publicitaire ni de mesure d’audience. Seul un cookie technique de session est déposé lorsque vous vous connectez, et votre panier est conservé dans votre navigateur. Ces éléments étant strictement nécessaires, aucun consentement n’est requis.
      </p>
      <h2>Vos droits</h2>
      <p>
        Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité. Écrivez-nous à {s.business.email}. Vous pouvez également introduire une réclamation auprès de la CNIL (www.cnil.fr).
      </p>
    </LegalPage>
  );
}
