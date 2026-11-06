import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "Conditions générales de vente" };

export default async function Page() {
  const s = await getSettings();
  const o = s.ordering;
  return (
    <LegalPage title="Conditions générales de vente">
      <p className="rounded-xl bg-amber-50 p-3 text-amber-900">Modèle à faire relire par un professionnel avant la mise en ligne.</p>
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions régissent la vente de plats cuisinés par {s.legal.companyName} (« {s.business.name} ») via ce site, à emporter ou livrés. Toute commande implique l’acceptation des présentes conditions.
      </p>
      <h2>2. Produits</h2>
      <p>
        Les plats sont préparés à la commande. Les photos sont non contractuelles. La liste des ingrédients et des allergènes est indiquée sur chaque fiche produit. Les quantités sont limitées : un plat peut devenir indisponible à tout moment.
      </p>
      <h2>3. Commande</h2>
      <ul>
        <li>Les commandes doivent être passées au minimum {o.minLeadHours} heures avant le créneau choisi, et au maximum {o.maxAdvanceDays} jours à l’avance.</li>
        <li>Le nombre de commandes par créneau est limité ; seuls les créneaux disponibles sont proposés.</li>
        <li>La commande est définitive après confirmation du paiement. Un email de confirmation est envoyé.</li>
      </ul>
      <h2>4. Prix et paiement</h2>
      <p>
        Les prix sont indiqués en euros, toutes taxes comprises ({s.legal.vatNote}). Les frais de livraison éventuels sont indiqués avant le paiement. Le paiement s’effectue en ligne par carte bancaire, Apple Pay ou Google Pay, via un prestataire sécurisé (Stripe). Aucune donnée bancaire n’est conservée par {s.business.name}.
      </p>
      <h2>5. Retrait et livraison</h2>
      <p>
        Le client récupère sa commande au {s.business.pickupAddress} pendant le créneau choisi, ou se la fait livrer à l’adresse indiquée, dans les zones desservies. En cas d’absence lors de la livraison ou de non-retrait, la commande ne peut être remboursée, les plats étant périssables.
      </p>
      <h2>6. Droit de rétractation</h2>
      <p>
        Conformément à l’article L.221-28 du Code de la consommation, le droit de rétractation ne s’applique pas aux denrées susceptibles de se détériorer rapidement ni aux biens confectionnés selon les spécifications du consommateur.
      </p>
      <h2>7. Annulation</h2>
      <p>
        {o.allowCustomerCancel
          ? `À titre commercial, le client peut annuler gratuitement sa commande depuis son lien de suivi jusqu’à ${o.cancelDeadlineHours} heures avant le début de son créneau. Il est alors remboursé intégralement sur son moyen de paiement (délai bancaire de 5 à 10 jours). Passé ce délai, la commande ne peut plus être annulée.`
          : `Toute demande d’annulation doit être adressée par téléphone au ${s.business.phone}.`}{" "}
        {s.business.name} peut annuler une commande en cas de force majeure ou d’impossibilité de la préparer ; le client est alors remboursé intégralement.
      </p>
      <h2>8. Conservation et consommation</h2>
      <p>Les plats doivent être consommés rapidement ou conservés au réfrigérateur (0–4 °C) et consommés sous 24 h. Réchauffer à cœur avant consommation.</p>
      <h2>9. Réclamations</h2>
      <p>Toute réclamation doit être adressée à {s.business.email} dans les 24 heures suivant le retrait ou la livraison.</p>
      <h2>10. Droit applicable</h2>
      <p>Les présentes conditions sont soumises au droit français. En cas de litige, le client peut recourir à un médiateur de la consommation (voir mentions légales).</p>
    </LegalPage>
  );
}
