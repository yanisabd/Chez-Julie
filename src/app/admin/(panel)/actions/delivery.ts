"use server";

import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { guarded, form, UserError } from "@/server/action";
import { getSettings, saveSettings } from "@/server/settings";
import { audit } from "@/server/log";
import { parsePriceToCents } from "@/lib/format";
import { parisDateTime } from "@/lib/time";

export async function saveFulfillment(fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const s = await getSettings();
    const pickup = form.bool(fd, "pickupEnabled");
    const delivery = form.bool(fd, "deliveryEnabled");
    if (!pickup && !delivery) throw new UserError("Activez au moins le retrait ou la livraison.");
    s.ordering.pickupEnabled = pickup;
    s.ordering.deliveryEnabled = delivery;
    s.business.pickupAddress = form.str(fd, "pickupAddress") || s.business.pickupAddress;
    s.business.pickupInstructions = form.str(fd, "pickupInstructions");
    await saveSettings(s);
    await audit(actor, "settings.fulfillment", "settings", null, { pickup, delivery });
    return { ok: true, message: "Enregistré" };
  });
}

const list = (s: string) =>
  s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export async function saveZone(id: number | null, fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const name = form.str(fd, "name");
    if (name.length < 2) throw new UserError("Donnez un nom à la zone.");
    const postalCodes = list(form.str(fd, "postalCodes")).map((x) => x.replace(/\s/g, ""));
    if (!postalCodes.length || postalCodes.some((p) => !/^\d{5}$/.test(p))) throw new UserError("Indiquez des codes postaux à 5 chiffres, séparés par des virgules.");
    const fee = parsePriceToCents(form.str(fd, "fee")) ?? 0;
    const min = parsePriceToCents(form.str(fd, "minOrder")) ?? 0;
    const freeAbove = form.str(fd, "freeAbove") ? parsePriceToCents(form.str(fd, "freeAbove")) : null;
    const values = { name, postalCodes, cities: list(form.str(fd, "cities")), feeCents: fee, minOrderCents: min, freeAboveCents: freeAbove, active: form.bool(fd, "active") };
    if (id) await db.update(schema.deliveryZones).set(values).where(eq(schema.deliveryZones.id, id));
    else await db.insert(schema.deliveryZones).values(values);
    await audit(actor, id ? "zone.update" : "zone.create", "zone", id, values);
    return { ok: true, message: "Zone enregistrée" };
  });
}

export async function deleteZone(id: number) {
  return guarded(["admin"], async ({ actor }) => {
    await db.delete(schema.deliveryZones).where(eq(schema.deliveryZones.id, id));
    await audit(actor, "zone.delete", "zone", id);
    return { ok: true, message: "Zone supprimée" };
  });
}

/* ------------------------------ Promotions ------------------------------ */

export async function togglePromos() {
  return guarded(["admin"], async ({ actor }) => {
    const s = await getSettings();
    s.ordering.promoCodesEnabled = !s.ordering.promoCodesEnabled;
    await saveSettings(s);
    await audit(actor, "settings.promos", "settings", null, { enabled: s.ordering.promoCodesEnabled });
  });
}

export async function savePromo(fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const code = form.str(fd, "code").toUpperCase().replace(/\s/g, "");
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new UserError("Code invalide : 3 à 30 lettres ou chiffres, sans espace.");
    const kind = form.str(fd, "kind") === "fixed" ? "fixed" : "percent";
    const value = kind === "percent" ? form.int(fd, "value") : parsePriceToCents(form.str(fd, "value"));
    if (!value || value <= 0 || (kind === "percent" && value > 100)) throw new UserError("Valeur de réduction invalide.");
    const exists = await db.query.promoCodes.findFirst({ where: eq(sql`upper(${schema.promoCodes.code})`, code) });
    if (exists) throw new UserError("Ce code existe déjà.");
    const d = (k: string, end = false) => {
      const v = form.str(fd, k);
      if (!v) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new UserError("Date invalide.");
      return end ? new Date(parisDateTime(v, "23:59").getTime() + 59_999) : parisDateTime(v, "00:00");
    };
    await db.insert(schema.promoCodes).values({
      code,
      kind,
      value,
      minOrderCents: parsePriceToCents(form.str(fd, "minOrder")) ?? 0,
      startsAt: d("startsAt"),
      endsAt: d("endsAt", true),
      maxUses: form.int(fd, "maxUses") || null,
    });
    await audit(actor, "promo.create", "promo", code);
    return { ok: true, message: `Code ${code} créé` };
  });
}

export async function togglePromo(id: number) {
  return guarded(["admin"], async ({ actor }) => {
    await db.update(schema.promoCodes).set({ active: sql`NOT ${schema.promoCodes.active}` }).where(eq(schema.promoCodes.id, id));
    await audit(actor, "promo.toggle", "promo", id);
  });
}

export async function deletePromo(id: number) {
  return guarded(["admin"], async ({ actor }) => {
    const p = await db.query.promoCodes.findFirst({ where: eq(schema.promoCodes.id, id) });
    if (p && p.usedCount > 0) {
      await db.update(schema.promoCodes).set({ active: false }).where(eq(schema.promoCodes.id, id));
      return { ok: true, message: "Code déjà utilisé : il a été désactivé (conservé pour l’historique)." };
    }
    await db.delete(schema.promoCodes).where(eq(schema.promoCodes.id, id));
    await audit(actor, "promo.delete", "promo", id);
    return { ok: true, message: "Code supprimé" };
  });
}
