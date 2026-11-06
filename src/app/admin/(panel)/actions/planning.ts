"use server";

import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { guarded, form, UserError } from "@/server/action";
import { getSettings, saveSettings } from "@/server/settings";
import { audit } from "@/server/log";
import { daySchema } from "@/lib/settings-schema";
import { minutesOf, parisDateTime, parisDay, hhmmOf, formatDayNumeric } from "@/lib/time";

export async function togglePause() {
  return guarded(["admin"], async ({ actor }) => {
    const s = await getSettings();
    s.ordering.paused = !s.ordering.paused;
    await saveSettings(s);
    await audit(actor, s.ordering.paused ? "ordering.pause" : "ordering.resume", "settings");
    return { ok: true, message: s.ordering.paused ? "Commandes mises en pause" : "Commandes ouvertes à nouveau ✓" };
  });
}

export async function saveRules(fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const s = await getSettings();
    const n = (k: string, min: number, max: number, def: number) => {
      const v = form.num(fd, k);
      if (v == null) return def;
      if (v < min || v > max) throw new UserError(`Valeur hors limites (${min} à ${max}).`);
      return v;
    };
    const o = s.ordering;
    o.pauseMessage = form.str(fd, "pauseMessage") || o.pauseMessage;
    o.minLeadHours = n("minLeadHours", 0, 168, o.minLeadHours);
    o.maxAdvanceDays = Math.round(n("maxAdvanceDays", 1, 60, o.maxAdvanceDays));
    const newSlot = Math.round(n("slotMinutes", 10, 240, o.slotMinutes));
    if (newSlot !== o.slotMinutes) {
      const future = await db.query.slots.findFirst({ where: gte(schema.slots.startsAt, new Date()) });
      if (future && future.bookedOrders > 0) throw new UserError("Impossible de changer la durée des créneaux tant que des commandes futures existent. Changez-la après les commandes en cours.");
    }
    o.slotMinutes = newSlot;
    o.defaultMaxOrdersPerSlot = Math.round(n("defaultMaxOrdersPerSlot", 1, 500, o.defaultMaxOrdersPerSlot));
    o.defaultMaxItemsPerSlot = Math.round(n("defaultMaxItemsPerSlot", 1, 5000, o.defaultMaxItemsPerSlot));
    o.maxOrdersPerDay = form.int(fd, "maxOrdersPerDay") || null;
    o.maxItemsPerDay = form.int(fd, "maxItemsPerDay") || null;
    o.maxItemsPerOrder = Math.round(n("maxItemsPerOrder", 1, 500, o.maxItemsPerOrder));
    o.prepMinutes = Math.round(n("prepMinutes", 0, 600, o.prepMinutes));
    o.autoAccept = form.bool(fd, "autoAccept");
    o.allowCustomerCancel = form.bool(fd, "allowCustomerCancel");
    o.cancelDeadlineHours = n("cancelDeadlineHours", 0, 168, o.cancelDeadlineHours);
    o.lowStockDisplay = Math.round(n("lowStockDisplay", 0, 100, o.lowStockDisplay));
    await saveSettings(s);
    await audit(actor, "settings.ordering", "settings", null, o);
    return { ok: true, message: "Règles enregistrées" };
  });
}

export async function saveSchedule(json: string) {
  return guarded(["admin"], async ({ actor }) => {
    const days = z.array(daySchema).length(7).parse(JSON.parse(json));
    for (const d of days)
      for (const r of d.ranges) {
        if (minutesOf(r.end) <= minutesOf(r.start)) throw new UserError(`Plage horaire invalide : ${r.start} – ${r.end}.`);
        if (!r.pickup && !r.delivery) throw new UserError("Chaque plage doit proposer le retrait, la livraison ou les deux.");
      }
    const s = await getSettings();
    s.schedule = days.map((d) => ({ ...d, ranges: d.ranges.sort((a, b) => minutesOf(a.start) - minutesOf(b.start)) }));
    await saveSettings(s);
    await audit(actor, "settings.schedule", "settings", null, { schedule: s.schedule });
    return { ok: true, message: "Horaires enregistrés" };
  });
}

async function ensureSlot(startIso: string) {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) throw new UserError("Créneau invalide.");
  const s = await getSettings();
  const end = new Date(start.getTime() + s.ordering.slotMinutes * 60000);
  await db.insert(schema.slots).values({ startsAt: start, endsAt: end, day: parisDay(start) }).onConflictDoNothing();
  return start;
}

export async function setSlotBlocked(startIso: string, blocked: boolean) {
  return guarded(["admin"], async ({ actor }) => {
    const start = await ensureSlot(startIso);
    await db.update(schema.slots).set({ blocked }).where(eq(schema.slots.startsAt, start));
    await audit(actor, blocked ? "slot.block" : "slot.unblock", "slot", startIso);
    return { ok: true, message: blocked ? "Créneau fermé" : "Créneau rouvert" };
  });
}

export async function setSlotCapacity(startIso: string, fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const start = await ensureSlot(startIso);
    const maxOrders = form.int(fd, "maxOrders");
    const maxItems = form.int(fd, "maxItems");
    await db
      .update(schema.slots)
      .set({ maxOrders: maxOrders && maxOrders > 0 ? maxOrders : null, maxItems: maxItems && maxItems > 0 ? maxItems : null })
      .where(eq(schema.slots.startsAt, start));
    await audit(actor, "slot.capacity", "slot", startIso, { maxOrders, maxItems });
    return { ok: true, message: "Capacité modifiée" };
  });
}

export async function openExtraSlot(fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const day = form.str(fd, "day");
    const time = form.str(fd, "time");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) throw new UserError("Date ou heure invalide.");
    const s = await getSettings();
    const start = parisDateTime(day, time);
    if (start < new Date()) throw new UserError("Ce créneau est déjà passé.");
    const end = parisDateTime(day, hhmmOf(minutesOf(time) + s.ordering.slotMinutes));
    await db
      .insert(schema.slots)
      .values({ startsAt: start, endsAt: end, day, forcedOpen: true })
      .onConflictDoUpdate({ target: schema.slots.startsAt, set: { forcedOpen: true, blocked: false } });
    await audit(actor, "slot.open_extra", "slot", start.toISOString());
    return { ok: true, message: "Créneau exceptionnel ouvert" };
  });
}

export async function removeExtraSlot(startIso: string) {
  return guarded(["admin"], async ({ actor }) => {
    const start = new Date(startIso);
    const slot = await db.query.slots.findFirst({ where: eq(schema.slots.startsAt, start) });
    if (!slot) return;
    if (slot.bookedOrders > 0) {
      await db.update(schema.slots).set({ blocked: true }).where(eq(schema.slots.id, slot.id));
      return { ok: true, message: "Des commandes existent : le créneau est fermé aux nouvelles commandes." };
    }
    await db.update(schema.slots).set({ forcedOpen: false }).where(eq(schema.slots.id, slot.id));
    await audit(actor, "slot.remove_extra", "slot", startIso);
    return { ok: true, message: "Créneau exceptionnel retiré" };
  });
}

export async function addClosure(fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const startDate = form.str(fd, "startDate");
    const endDate = form.str(fd, "endDate") || startDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) throw new UserError("Dates invalides.");
    await db.insert(schema.closures).values({ startDate, endDate, reason: form.str(fd, "reason") });
    const existing = await db
      .select({ id: schema.orders.id })
      .from(schema.orders)
      .where(and(gte(schema.orders.serviceDay, startDate), lte(schema.orders.serviceDay, endDate), inArray(schema.orders.status, ["new", "accepted", "preparing", "ready"])));
    await audit(actor, "closure.add", "closure", null, { startDate, endDate });
    return {
      ok: true,
      message: existing.length
        ? `Fermeture enregistrée. ⚠ ${existing.length} commande(s) existent déjà sur cette période : pensez à les annuler (Commandes).`
        : `Fermeture du ${formatDayNumeric(startDate)}${endDate !== startDate ? ` au ${formatDayNumeric(endDate)}` : ""} enregistrée`,
    };
  });
}

export async function deleteClosure(id: number) {
  return guarded(["admin"], async ({ actor }) => {
    await db.delete(schema.closures).where(eq(schema.closures.id, id));
    await audit(actor, "closure.delete", "closure", id);
    return { ok: true, message: "Fermeture supprimée" };
  });
}
