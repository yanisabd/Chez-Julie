"use client";

import { useState } from "react";
import { Plus, Trash2, ImagePlus, X, Star, Images } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action";
import { Card, Field, Input, Textarea, Select, Check } from "@/components/ui";
import { DishImage } from "@/components/dish-image";
import { ALLERGENS, UNITS } from "@/lib/constants";
import { WEEKDAYS } from "@/lib/time";
import { centsToInput } from "@/lib/format";
import { saveProduct } from "../../actions/menu";

type Product = {
  id: number;
  name: string;
  categoryId: number | null;
  priceCents: number;
  description: string;
  ingredientsText: string;
  allergens: string[];
  availableDays: number[];
  active: boolean;
  featured: boolean;
  spicy: number;
  stockQty: number | null;
  reservedQty: number;
  alertThreshold: number | null;
  dailyLimit: number | null;
  maxPerOrder: number | null;
  imageId: string | null;
  galleryImageIds: string[];
};
type OptGroup = { id?: number; name: string; required: boolean; maxChoices: number; options: { id?: number; name: string; price: string }[] };
type RecipeLine = { ingredientId: number; quantity: number };

export function ProductForm({
  product: p,
  categories,
  ingredients,
  initialOptions,
  initialRecipe,
}: {
  product: Product | null;
  categories: { id: number; name: string }[];
  ingredients: { id: number; name: string; unit: string }[];
  initialOptions: OptGroup[];
  initialRecipe: RecipeLine[];
}) {
  const [groups, setGroups] = useState<OptGroup[]>(initialOptions);
  const [recipe, setRecipe] = useState<RecipeLine[]>(initialRecipe);
  const [track, setTrack] = useState(p?.stockQty != null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>(p ? [p.imageId, ...p.galleryImageIds].filter((x): x is string => !!x) : []);
  const [added, setAdded] = useState(0);
  const days = p?.availableDays.length ? p.availableDays : [1, 2, 3, 4, 5, 6, 7];

  const updGroup = (i: number, patch: Partial<OptGroup>) => setGroups((g) => g.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const unitLabel = (id: number) => UNITS.find((u) => u.code === ingredients.find((x) => x.id === id)?.unit)?.code ?? "";

  return (
    <ActionForm action={saveProduct.bind(null, p?.id ?? null)} className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <input type="hidden" name="optionsJson" value={JSON.stringify(groups)} />
      <input type="hidden" name="recipeJson" value={JSON.stringify(recipe)} />
      <input type="hidden" name="photosJson" value={JSON.stringify(photos)} />

      <div className="space-y-4">
        <Card className="space-y-4">
          <h2 className="font-sans text-lg font-bold">Informations</h2>
          <Field label="Nom du plat" htmlFor="name">
            <Input id="name" name="name" defaultValue={p?.name} required placeholder="Ex. : Mafé de bœuf" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prix (€)" htmlFor="price">
              <Input id="price" name="price" inputMode="decimal" defaultValue={p ? centsToInput(p.priceCents) : ""} placeholder="12,50" required />
            </Field>
            <Field label="Catégorie" htmlFor="cat">
              <Select id="cat" name="categoryId" defaultValue={p?.categoryId ?? categories[0]?.id ?? ""}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Description" hint="Donnez envie ! 1 à 3 phrases." htmlFor="desc">
            <Textarea id="desc" name="description" defaultValue={p?.description} rows={3} />
          </Field>
          <Field label="Liste des ingrédients" htmlFor="ingt">
            <Textarea id="ingt" name="ingredientsText" defaultValue={p?.ingredientsText} rows={2} placeholder="Bœuf, pâte d’arachide, tomate…" />
          </Field>
          <Field label="Niveau de piment">
            <Select name="spicy" defaultValue={p?.spicy ?? 0}>
              <option value={0}>Pas pimenté</option>
              <option value={1}>🌶️ Légèrement</option>
              <option value={2}>🌶️🌶️ Pimenté</option>
              <option value={3}>🌶️🌶️🌶️ Très pimenté</option>
            </Select>
          </Field>
        </Card>

        <Card>
          <h2 className="font-sans text-lg font-bold">Allergènes</h2>
          <p className="text-sm text-muted">Cochez tous les allergènes présents (obligation légale).</p>
          <div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-3">
            {ALLERGENS.map((a) => (
              <Check key={a.code} name="allergens" value={a.code} label={a.label} defaultChecked={p?.allergens.includes(a.code)} />
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-sans text-lg font-bold">Options et suppléments</h2>
              <p className="text-sm text-muted">Ex. : choix de l’accompagnement, niveau de piment, boisson…</p>
            </div>
            <button
              type="button"
              onClick={() => setGroups((g) => [...g, { name: "", required: true, maxChoices: 1, options: [{ name: "", price: "" }] }])}
              className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-sand px-4 text-sm font-semibold hover:bg-sand-dark"
            >
              <Plus className="size-4" /> Groupe
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {groups.map((g, gi) => (
              <div key={gi} className="rounded-2xl bg-sand/60 p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Nom du choix" className="min-w-40 flex-1">
                    <Input value={g.name} onChange={(e) => updGroup(gi, { name: e.target.value })} placeholder="Accompagnement" />
                  </Field>
                  <Field label="Le client choisit">
                    <Select value={g.maxChoices} onChange={(e) => updGroup(gi, { maxChoices: Number(e.target.value) })}>
                      <option value={1}>1 seul</option>
                      {[2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          jusqu’à {n}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <label className="flex h-12 items-center gap-2 text-[15px] font-medium">
                    <input type="checkbox" checked={g.required} onChange={(e) => updGroup(gi, { required: e.target.checked })} className="size-5 accent-forest" />
                    Obligatoire
                  </label>
                  <button type="button" onClick={() => setGroups((x) => x.filter((_, j) => j !== gi))} className="grid size-12 place-items-center rounded-full text-red-700 hover:bg-red-50" aria-label="Supprimer le groupe">
                    <Trash2 className="size-5" />
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {g.options.map((o, oi) => (
                    <div key={oi} className="flex gap-2">
                      <Input
                        value={o.name}
                        onChange={(e) => updGroup(gi, { options: g.options.map((x, j) => (j === oi ? { ...x, name: e.target.value } : x)) })}
                        placeholder="Choix (ex. : Riz blanc)"
                      />
                      <Input
                        value={o.price}
                        onChange={(e) => updGroup(gi, { options: g.options.map((x, j) => (j === oi ? { ...x, price: e.target.value } : x)) })}
                        placeholder="+ € (facultatif)"
                        inputMode="decimal"
                        className="w-36"
                      />
                      <button
                        type="button"
                        disabled={g.options.length === 1}
                        onClick={() => updGroup(gi, { options: g.options.filter((_, j) => j !== oi) })}
                        className="grid size-12 shrink-0 place-items-center rounded-full text-muted hover:bg-white disabled:opacity-30"
                        aria-label="Retirer ce choix"
                      >
                        <X className="size-5" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => updGroup(gi, { options: [...g.options, { name: "", price: "" }] })} className="text-sm font-semibold text-terracotta">
                    + Ajouter un choix
                  </button>
                </div>
              </div>
            ))}
            {groups.length === 0 && <p className="text-[15px] text-muted">Aucune option : le client ajoute le plat directement.</p>}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <h2 className="font-sans text-lg font-bold">Photos</h2>
          <p className="text-sm text-muted">La 1re photo est la photo principale (carte, accueil). Les autres s’affichent en galerie sur la fiche du plat.</p>
          <div className="mt-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="aspect-square w-full rounded-2xl object-cover" />
            ) : (
              <DishImage imageId={photos[0] ?? null} name={p?.name ?? "Nouveau plat"} className="aspect-square w-full" />
            )}
          </div>
          {photos.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {photos.slice(1).map((id) => (
                <div key={id} className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-black/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/images/${id}?w=320`} alt="" className="size-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/45 p-1">
                    <button type="button" title="Mettre en photo principale" onClick={() => setPhotos((x) => [id, ...x.filter((y) => y !== id)])} className="grid size-7 place-items-center rounded-md text-white hover:bg-white/20">
                      <Star className="size-4" />
                    </button>
                    <button type="button" title="Retirer cette photo" onClick={() => setPhotos((x) => x.filter((y) => y !== id))} className="grid size-7 place-items-center rounded-md text-white hover:bg-red-500/80">
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-sand text-sm font-semibold hover:bg-sand-dark">
              <ImagePlus className="size-5" /> {photos.length ? "Nouvelle photo principale" : "Ajouter une photo"}
              <input
                type="file"
                name="image"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
            </label>
            <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-sand text-sm font-semibold hover:bg-sand-dark">
              <Images className="size-5" /> Ajouter à la galerie{added ? ` (${added})` : ""}
              <input type="file" name="galleryAdd" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setAdded(e.target.files?.length ?? 0)} />
            </label>
          </div>
          {photos[0] && !preview && (
            <button type="button" onClick={() => setPhotos((x) => x.slice(1))} className="mt-2 w-full text-sm text-muted hover:text-red-700">
              Retirer la photo principale
            </button>
          )}
          <p className="mt-2 text-xs text-muted">Photos carrées de préférence. Elles sont automatiquement optimisées (8 photos maximum).</p>
        </Card>

        <Card className="space-y-1">
          <h2 className="font-sans text-lg font-bold">Visibilité</h2>
          <Check name="active" defaultChecked={p?.active ?? true} label="En vente sur le site" />
          <Check name="featured" defaultChecked={p?.featured} label="Mettre en avant sur l’accueil" />
        </Card>

        <Card>
          <h2 className="font-sans text-lg font-bold">Jours de vente</h2>
          <div className="mt-2 grid grid-cols-2 gap-1">
            {WEEKDAYS.map((d, i) => (
              <Check key={d} name="days" value={String(i + 1)} label={d} defaultChecked={days.includes(i + 1)} />
            ))}
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-sans text-lg font-bold">Quantités</h2>
          <Field label="Portions maximum par jour" hint="Combien pouvez-vous en préparer par jour ? Vide = pas de limite." htmlFor="daily">
            <Input id="daily" name="dailyLimit" type="number" min={0} defaultValue={p?.dailyLimit ?? ""} />
          </Field>
          <Field label="Maximum par commande" hint="Vide = pas de limite." htmlFor="mpo">
            <Input id="mpo" name="maxPerOrder" type="number" min={1} defaultValue={p?.maxPerOrder ?? ""} />
          </Field>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="trackStock" checked={track} onChange={(e) => setTrack(e.target.checked)} className="mt-0.5 size-5 accent-forest" />
            <span>
              <span className="font-medium">Suivre un stock</span>
              <span className="block text-sm text-muted">Pour les produits déjà prêts (boissons, desserts…). Le stock baisse à chaque commande payée.</span>
            </span>
          </label>
          {track && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stock disponible" htmlFor="stock">
                <Input id="stock" name="stockQty" type="number" min={0} defaultValue={p?.stockQty ?? 0} />
              </Field>
              <Field label="Alerte si ≤" htmlFor="alert">
                <Input id="alert" name="alertThreshold" type="number" min={0} defaultValue={p?.alertThreshold ?? ""} />
              </Field>
              {p && p.reservedQty > 0 && <p className="col-span-2 text-sm text-muted">{p.reservedQty} en cours de paiement (réservés).</p>}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-sans text-lg font-bold">Recette (facultatif)</h2>
          <p className="text-sm text-muted">Quantité d’ingrédient par portion. Le site bloque les ventes quand un ingrédient manque.</p>
          <div className="mt-3 space-y-2">
            {recipe.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={r.ingredientId} onChange={(e) => setRecipe((x) => x.map((y, j) => (j === i ? { ...y, ingredientId: Number(e.target.value) } : y)))}>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={1}
                  value={r.quantity}
                  onChange={(e) => setRecipe((x) => x.map((y, j) => (j === i ? { ...y, quantity: Number(e.target.value) } : y)))}
                  className="w-24"
                />
                <span className="w-8 text-sm text-muted">{unitLabel(r.ingredientId)}</span>
                <button type="button" onClick={() => setRecipe((x) => x.filter((_, j) => j !== i))} className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-700" aria-label="Retirer">
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {ingredients.length ? (
              <button type="button" onClick={() => setRecipe((x) => [...x, { ingredientId: ingredients[0].id, quantity: 100 }])} className="text-sm font-semibold text-terracotta">
                + Ajouter un ingrédient
              </button>
            ) : (
              <p className="text-sm text-muted">Créez d’abord des ingrédients dans « Stocks & ingrédients ».</p>
            )}
          </div>
        </Card>

        <div className="sticky bottom-4 z-10">
          <SubmitButton variant="primary" size="lg" className="w-full shadow-lg">
            {p ? "Enregistrer les modifications" : "Créer le plat"}
          </SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
