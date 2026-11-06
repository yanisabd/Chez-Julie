"use server";

import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { guarded, form, UserError } from "@/server/action";
import { getSettings, saveSettings } from "@/server/settings";
import { retryNotifications } from "@/server/notifications";
import { audit } from "@/server/log";

export async function saveBusiness(fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const s = await getSettings();
    const name = form.str(fd, "name");
    if (name.length < 2) throw new UserError("Le nom est obligatoire.");
    const b = s.business;
    b.name = name;
    b.tagline = form.str(fd, "tagline");
    b.about = form.str(fd, "about");
    b.phone = form.str(fd, "phone");
    b.email = form.str(fd, "email");
    b.announcement = form.str(fd, "announcement");
    const insta = form.str(fd, "instagram");
    if (insta && !/^https:\/\//.test(insta)) throw new UserError("Le lien Instagram doit commencer par https://");
    b.instagram = insta;
    await saveSettings(s);
    await audit(actor, "settings.business", "settings");
    return { ok: true, message: "Informations enregistrées" };
  });
}

export async function saveLegal(fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const s = await getSettings();
    for (const k of Object.keys(s.legal) as (keyof typeof s.legal)[]) if (fd.has(k)) s.legal[k] = form.str(fd, k);
    const months = form.int(fd, "retentionMonths");
    if (months != null) {
      if (months < 6 || months > 120) throw new UserError("La durée de conservation doit être comprise entre 6 et 120 mois.");
      s.privacy.retentionMonths = months;
    }
    await saveSettings(s);
    await audit(actor, "settings.legal", "settings");
    return { ok: true, message: "Informations légales enregistrées" };
  });
}

export async function saveNotificationSettings(fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const s = await getSettings();
    const n = s.notifications;
    const email = form.str(fd, "adminEmail");
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new UserError("Email invalide.");
    n.adminEmail = email;
    n.notifyAdminNewOrder = form.bool(fd, "notifyAdminNewOrder");
    n.notifyAdminIssues = form.bool(fd, "notifyAdminIssues");
    n.notifyAdminLowStock = form.bool(fd, "notifyAdminLowStock");
    for (const k of Object.keys(n.customer) as (keyof typeof n.customer)[]) n.customer[k] = form.bool(fd, `c_${k}`);
    await saveSettings(s);
    await audit(actor, "settings.notifications", "settings");
    return { ok: true, message: "Préférences enregistrées" };
  });
}

export async function retryEmail(id: number) {
  return guarded(["admin"], async ({ actor }) => {
    await retryNotifications([id]);
    await audit(actor, "notification.retry", "notification", id);
    const n = await db.query.notifications.findFirst({ where: eq(schema.notifications.id, id) });
    return n?.status === "failed" ? { ok: false, error: `Nouvel échec : ${n.lastError ?? "erreur inconnue"}` } : { ok: true, message: "Email renvoyé" };
  });
}

export async function retryAllFailed() {
  return guarded(["admin"], async ({ actor }) => {
    const failed = await db.select({ id: schema.notifications.id }).from(schema.notifications).where(eq(schema.notifications.status, "failed"));
    await retryNotifications(failed.map((f) => f.id));
    await audit(actor, "notification.retry_all", "notification", null, { count: failed.length });
    return { ok: true, message: `${failed.length} email(s) relancé(s)` };
  });
}

export async function acknowledgeErrors(ids: number[]) {
  return guarded(["admin"], async ({ actor }) => {
    if (ids.length) await db.update(schema.systemLogs).set({ acknowledged: true }).where(inArray(schema.systemLogs.id, ids));
    await audit(actor, "errors.acknowledge", "system_log", null, { count: ids.length });
    return { ok: true, message: "Marqué comme lu" };
  });
}
