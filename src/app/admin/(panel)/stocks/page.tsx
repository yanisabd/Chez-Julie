import { and, asc, desc, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { db, schema } from "@/db";
import { formatQty, cn } from "@/lib/format";
import { formatDateTime, parisDay, addDays } from "@/lib/time";
import { PageHeader, Help, Card, Input, Select, Table, Field } from "@/components/ui";
import { ActionForm, SubmitButton, ActionButton } from "@/components/action";
import { setProductStock, saveIngredient, adjustIngredient, deleteIngredient } from "../actions/stocks";

export const metadata = { title: "Stocks & ingrédients" };

const REASON: Record<string, string> = { sale: "Vente", restock: "Réapprovisionnement", adjustment: "Correction", cancel: "Annulation (remis en stock)" };

function UnitPicker({ unit, name }: { unit: string; name: string }) {
  if (unit === "pce") return <input type="hidden" name={name} value="pce" />;
  return (
    <Select name={name} defaultValue={unit === "g" ? "kg" : "l"} className="w-20 px-2" aria-label="Unité">
      {unit === "g" ? (
        <>
          <option value="kg">kg</option>
          <option value="g">g</option>
        </>
      ) : (
        <>
          <option value="l">L</option>
          <option value="ml">ml</option>
        </>
      )}
    </Select>
  );
}

export default async function StocksPage() {
  const today = parisDay();
  const tomorrow = addDays(today, 1);
  const prods = await db
    .select()
    .from(schema.products)
    .where(and(isNull(schema.products.deletedAt), or(isNotNull(schema.products.stockQty), isNotNull(schema.products.dailyLimit))))
    .orderBy(asc(schema.products.name));
  const usage = prods.length
    ? await db.select().from(schema.productDayUsage).where(and(inArray(schema.productDayUsage.day, [today, tomorrow]), inArray(schema.productDayUsage.productId, prods.map((p) => p.id))))
    : [];
  const ings = await db.select().from(schema.ingredients).orderBy(asc(schema.ingredients.name));
  const moves = await db.select().from(schema.stockMovements).orderBy(desc(schema.stockMovements.createdAt)).limit(30);
  const allProds = await db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products);
  const used = (pid: number, d: string) => usage.find((u) => u.productId === pid && u.day === d)?.qty ?? 0;
  const tracked = prods.filter((p) => p.stockQty != null);
  const limited = prods.filter((p) => p.dailyLimit != null);

  return (
    <div>
      <PageHeader title="Stocks & ingrédients" subtitle="Le site empêche automatiquement de vendre plus que ce que vous avez." />
      <Help>
        Trois protections existent : <b>le stock</b> (produits déjà prêts, ex. boissons), <b>la limite de portions par jour</b> (plats cuisinés) et <b>les ingrédients</b> (si une recette est renseignée). Quand l’une est atteinte, le plat
        devient « Épuisé » ou le jour devient « Complet » sur le site.
      </Help>

      <h2 className="mb-3 font-sans text-xl font-bold">Portions par jour</h2>
      {limited.length === 0 ? (
        <p className="mb-8 text-muted">Aucun plat n’a de limite journalière (à régler dans la fiche du plat).</p>
      ) : (
        <div className="mb-8">
          <Table>
            <thead>
              <tr>
                <th>Plat</th>
                <th className="text-center">Aujourd’hui</th>
                <th className="text-center">Demain</th>
                <th className="text-center">Limite / jour</th>
              </tr>
            </thead>
            <tbody>
              {limited.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  {[today, tomorrow].map((d) => {
                    const u = used(p.id, d);
                    return (
                      <td key={d} className={cn("text-center", u >= p.dailyLimit! && "font-bold text-red-700")}>
                        {u} vendu{u > 1 ? "s" : ""} {u >= p.dailyLimit! && "· complet"}
                      </td>
                    );
                  })}
                  <td className="text-center">
                    <a href={`/admin/menu/${p.id}`} className="font-semibold underline">
                      {p.dailyLimit}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <h2 className="mb-3 font-sans text-xl font-bold">Produits en stock</h2>
      {tracked.length === 0 ? (
        <p className="mb-8 text-muted">Aucun plat avec suivi de stock (à activer dans la fiche du plat).</p>
      ) : (
        <div className="mb-8 grid gap-3 md:grid-cols-2">
          {tracked.map((p) => {
            const left = (p.stockQty ?? 0) - p.reservedQty;
            const low = p.alertThreshold != null && left <= p.alertThreshold;
            return (
              <Card key={p.id} className={cn(left <= 0 ? "ring-2 ring-red-300" : low && "ring-2 ring-amber-300")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    {p.reservedQty > 0 && <div className="text-sm text-muted">{p.reservedQty} en cours de paiement</div>}
                  </div>
                  <div className={cn("text-3xl font-bold", left <= 0 ? "text-red-700" : low ? "text-amber-700" : "")}>{left}</div>
                </div>
                <ActionForm action={setProductStock.bind(null, p.id)} reset className="mt-3 flex gap-2">
                  <Select name="mode" defaultValue="add" className="w-36 px-2">
                    <option value="add">Ajouter</option>
                    <option value="set">Fixer à</option>
                  </Select>
                  <Input name="qty" type="number" min={0} placeholder="Qté" required />
                  <SubmitButton>OK</SubmitButton>
                </ActionForm>
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 font-sans text-xl font-bold">Ingrédients</h2>
      <div className="space-y-3">
        {ings.map((i) => {
          const left = i.stock - i.reserved;
          const low = i.alertThreshold != null && left <= i.alertThreshold;
          return (
            <Card key={i.id} className={cn("grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center", left <= 0 ? "ring-2 ring-red-300" : low && "ring-2 ring-amber-300")}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{i.name}</span>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-bold", left <= 0 ? "bg-red-100 text-red-800" : low ? "bg-amber-100 text-amber-900" : "bg-forest-light text-forest")}>
                    {formatQty(left, i.unit)}
                  </span>
                </div>
                <div className="text-sm text-muted">
                  {i.alertThreshold != null ? `Alerte sous ${formatQty(i.alertThreshold, i.unit)}` : "Pas d’alerte"}
                  {i.reserved > 0 && ` · ${formatQty(i.reserved, i.unit)} réservés`} · mis à jour le {formatDateTime(i.updatedAt)}
                </div>
              </div>
              <ActionForm action={adjustIngredient.bind(null, i.id)} reset className="flex gap-2">
                <Select name="mode" defaultValue="add" className="w-32 px-2">
                  <option value="add">Ajouter</option>
                  <option value="set">Fixer à</option>
                </Select>
                <Input name="qty" inputMode="decimal" placeholder="Qté" className="w-24" required />
                <UnitPicker unit={i.unit} name="inputUnit" />
                <SubmitButton>OK</SubmitButton>
              </ActionForm>
              <div className="flex gap-1">
                <details className="relative">
                  <summary className="flex h-11 cursor-pointer list-none items-center rounded-full px-4 text-sm font-semibold ring-1 ring-sand-dark hover:bg-sand">Modifier</summary>
                  <Card className="absolute right-0 z-20 mt-1 w-80">
                    <ActionForm action={saveIngredient.bind(null, i.id)} className="space-y-3">
                      <input type="hidden" name="unit" value={i.unit} />
                      <Field label="Nom">
                        <Input name="name" defaultValue={i.name} required />
                      </Field>
                      <Field label="Alerte quand il reste moins de">
                        <div className="flex gap-2">
                          <Input name="alert" inputMode="decimal" defaultValue={i.alertThreshold == null ? "" : i.unit === "pce" ? i.alertThreshold : i.alertThreshold / 1000} />
                          <UnitPicker unit={i.unit} name="alertUnit" />
                        </div>
                      </Field>
                      <SubmitButton size="sm">Enregistrer</SubmitButton>
                    </ActionForm>
                  </Card>
                </details>
                <ActionButton action={deleteIngredient.bind(null, i.id)} variant="ghost" confirm={`Supprimer l’ingrédient « ${i.name} » ?`}>
                  <Trash2 className="size-4" />
                </ActionButton>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <h3 className="font-sans font-bold">Ajouter un ingrédient</h3>
        <ActionForm action={saveIngredient.bind(null, null)} reset className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
          <Field label="Nom">
            <Input name="name" placeholder="Ex. : Bœuf" required />
          </Field>
          <Field label="Mesuré en">
            <Select name="unit" defaultValue="g">
              <option value="g">Poids (kg / g)</option>
              <option value="ml">Volume (L / ml)</option>
              <option value="pce">Pièces</option>
            </Select>
          </Field>
          <Field label="Stock actuel" hint="En kg, L ou pièces">
            <Input name="stock" inputMode="decimal" placeholder="Ex. : 5" />
            <input type="hidden" name="stockUnit" value="kg" />
          </Field>
          <Field label="Alerte sous" hint="En kg, L ou pièces">
            <Input name="alert" inputMode="decimal" placeholder="Ex. : 1" />
            <input type="hidden" name="alertUnit" value="kg" />
          </Field>
          <SubmitButton>Ajouter</SubmitButton>
        </ActionForm>
        <p className="mt-2 text-xs text-muted">Pour les pièces, les quantités sont en nombre de pièces ; pour le volume, en litres.</p>
      </Card>

      <h2 className="mb-3 mt-10 font-sans text-xl font-bold">Derniers mouvements</h2>
      <Table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Produit / ingrédient</th>
            <th>Mouvement</th>
            <th className="text-right">Quantité</th>
          </tr>
        </thead>
        <tbody>
          {moves.map((m) => {
            const ing = ings.find((x) => x.id === m.ingredientId);
            const name = m.productId ? allProds.find((x) => x.id === m.productId)?.name : ing?.name;
            return (
              <tr key={m.id}>
                <td className="text-muted">{formatDateTime(m.createdAt)}</td>
                <td>{name ?? "—"}</td>
                <td>
                  {REASON[m.reason] ?? m.reason}
                  {m.actorLabel && <span className="text-muted"> · {m.actorLabel}</span>}
                </td>
                <td className={cn("text-right font-semibold", m.delta < 0 ? "text-red-700" : "text-forest")}>
                  {m.delta > 0 ? "+" : ""}
                  {ing ? formatQty(m.delta, ing.unit) : m.delta}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
