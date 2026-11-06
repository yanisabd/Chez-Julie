import type { Metadata } from "next";
import { getMenu } from "@/server/catalog";
import { ALLERGENS } from "@/lib/constants";
import { LegalPage } from "@/components/legal";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Allergènes" };

export default async function Page() {
  const [menu, s] = await Promise.all([getMenu(), getSettings()]);
  return (
    <LegalPage title="Informations allergènes">
      <p>
        Conformément au règlement (UE) n°1169/2011, voici la présence des 14 allergènes majeurs dans nos plats. Nos plats sont préparés dans une cuisine où tous ces allergènes peuvent être manipulés : des traces sont possibles. En cas d’allergie
        sévère, contactez-nous au {s.business.phone} avant de commander.
      </p>
      <div className="-mx-6 overflow-x-auto px-6">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-3">Plat</th>
              <th className="py-2">Allergènes présents</th>
            </tr>
          </thead>
          <tbody>
            {menu.products.map((p) => (
              <tr key={p.id} className="border-t border-sand">
                <td className="py-2 pr-3 font-medium">{p.name}</td>
                <td className="py-2">{p.allergens.length ? p.allergens.map((a) => ALLERGENS.find((x) => x.code === a)?.label ?? a).join(", ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LegalPage>
  );
}
