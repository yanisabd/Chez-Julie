"use server";

import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { ActionResult } from "@/lib/action-result";
import { createSession, getCurrentUser, hashSecret, loginWithPassword, logout, passwordProblem, randomToken, revokeSessions, sha256, verifySecret } from "@/server/auth";
import { rateLimit, clientIp } from "@/server/rate-limit";
import { getSettings } from "@/server/settings";
import { enqueue, flushOutboxSafely } from "@/server/notifications";
import { renderPasswordResetEmail, appUrl } from "@/server/email-templates";
import { audit } from "@/server/log";

const safeReturn = (r: string) => (r.startsWith("/") && !r.startsWith("//") ? r : "/compte");

export async function customerLogin(fd: FormData): Promise<ActionResult> {
  if (!(await rateLimit(`login:${await clientIp()}`, 15, 900))) return { ok: false, error: "Trop de tentatives. Réessayez dans 15 minutes." };
  const r = await loginWithPassword(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""), ["customer"]);
  if (!r.ok) return r;
  redirect(safeReturn(String(fd.get("retour") ?? "/compte")));
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(80),
  email: z.string().trim().toLowerCase().email("Email invalide."),
  phone: z.string().trim().regex(/^\+?[0-9 .-]{9,20}$/, "Téléphone invalide."),
  password: z.string().max(200),
});

export async function customerRegister(fd: FormData): Promise<ActionResult> {
  if (!(await rateLimit(`register:${await clientIp()}`, 5, 3600))) return { ok: false, error: "Trop de créations de compte. Réessayez plus tard." };
  const p = registerSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const pb = passwordProblem(p.data.password);
  if (pb) return { ok: false, error: pb };
  if (fd.get("consent") !== "on") return { ok: false, error: "Merci d’accepter la politique de confidentialité." };
  const exists = await db.query.users.findFirst({ where: eq(schema.users.email, p.data.email) });
  if (exists) return { ok: false, error: "Un compte existe déjà avec cet email. Connectez-vous ou réinitialisez votre mot de passe." };
  const [u] = await db
    .insert(schema.users)
    .values({ role: "customer", name: p.data.name, email: p.data.email, phone: p.data.phone, passwordHash: await hashSecret(p.data.password) })
    .returning();
  // Rattache les commandes passées sans compte avec le même email
  await db.update(schema.orders).set({ userId: u.id }).where(and(eq(schema.orders.email, p.data.email), isNull(schema.orders.userId)));
  await createSession(u.id, "customer");
  redirect(safeReturn(String(fd.get("retour") ?? "/compte")));
}

export async function customerLogout() {
  await logout();
  redirect("/");
}

export async function requestPasswordReset(fd: FormData): Promise<ActionResult> {
  const generic: ActionResult = { ok: true, message: "Si un compte existe avec cet email, vous allez recevoir un lien de réinitialisation." };
  if (!(await rateLimit(`reset:${await clientIp()}`, 5, 3600))) return generic;
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user || !user.active || user.role === "kitchen") return generic;
  const token = randomToken();
  await db.insert(schema.passwordResets).values({ id: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 3600_000) });
  const s = await getSettings();
  const mail = renderPasswordResetEmail(s, user.name, `${appUrl()}/compte/reinitialiser/${token}`);
  await enqueue(db, { type: "password_reset", recipient: email, ...mail, dedupeKey: `reset:${sha256(token)}` });
  await flushOutboxSafely();
  return generic;
}

export async function resetPassword(fd: FormData): Promise<ActionResult> {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  const pb = passwordProblem(password);
  if (pb) return { ok: false, error: pb };
  const row = await db.query.passwordResets.findFirst({
    where: and(eq(schema.passwordResets.id, sha256(token)), gt(schema.passwordResets.expiresAt, new Date()), isNull(schema.passwordResets.usedAt)),
  });
  if (!row) return { ok: false, error: "Ce lien a expiré ou a déjà été utilisé. Refaites une demande." };
  await db.update(schema.passwordResets).set({ usedAt: new Date() }).where(eq(schema.passwordResets.id, row.id));
  await db.update(schema.users).set({ passwordHash: await hashSecret(password), failedAttempts: 0, lockedUntil: null }).where(eq(schema.users.id, row.userId));
  await revokeSessions(row.userId);
  await audit({ id: row.userId, label: "Utilisateur" }, "user.password_reset", "user", row.userId);
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, row.userId) });
  if (u) await createSession(u.id, u.role);
  redirect(u?.role === "admin" ? "/admin" : "/compte");
}

export async function updateProfile(fd: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") return { ok: false, error: "Veuillez vous reconnecter." };
  const name = String(fd.get("name") ?? "").trim();
  const phone = String(fd.get("phone") ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Nom invalide." };
  if (!/^\+?[0-9 .-]{9,20}$/.test(phone)) return { ok: false, error: "Téléphone invalide." };
  await db.update(schema.users).set({ name, phone }).where(eq(schema.users.id, user.id));
  return { ok: true, message: "Profil mis à jour" };
}

/** Droit à l'effacement (RGPD) : le compte est supprimé, les commandes passées sont anonymisées. */
export async function deleteAccount(fd: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") return { ok: false, error: "Veuillez vous reconnecter." };
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
  if (!u || !(await verifySecret(String(fd.get("password") ?? ""), u.passwordHash))) return { ok: false, error: "Mot de passe incorrect." };
  const active = await db.query.orders.findFirst({
    where: and(eq(schema.orders.userId, user.id), gt(schema.orders.slotEnd, new Date())),
  });
  if (active && ["new", "accepted", "preparing", "ready", "out_for_delivery", "pending_payment"].includes(active.status))
    return { ok: false, error: "Vous avez une commande en cours. Vous pourrez supprimer votre compte une fois celle-ci terminée." };
  await db
    .update(schema.orders)
    .set({ userId: null, customerName: "Client anonymisé", email: "anonymise@invalid.local", phone: "", addressLine: null, deliveryInstructions: null, kitchenNotes: null, anonymizedAt: new Date() })
    .where(eq(schema.orders.userId, user.id));
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  await audit({ id: null, label: "Client" }, "user.self_delete", "user", user.id);
  await logout();
  redirect("/?compte=supprime");
}
