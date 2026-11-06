"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { guarded, form, UserError } from "@/server/action";
import { hashSecret, passwordProblem, revokeSessions } from "@/server/auth";
import { audit } from "@/server/log";

const WEAK_PINS = ["0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "1234", "4321", "1212", "0123"];

function checkPin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new UserError("Le code doit contenir exactement 4 chiffres.");
  if (WEAK_PINS.includes(pin)) throw new UserError("Ce code est trop facile à deviner. Choisissez-en un autre.");
}

export async function createKitchenUser(fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const name = form.str(fd, "name");
    if (name.length < 2) throw new UserError("Indiquez un prénom.");
    const pin = form.str(fd, "pin");
    checkPin(pin);
    await db.insert(schema.users).values({ role: "kitchen", name, pinHash: await hashSecret(pin) });
    await audit(actor, "user.create_kitchen", "user", null, { name });
    return { ok: true, message: `Profil « ${name} » créé. Code : ${pin}` };
  });
}

export async function setKitchenPin(userId: string, fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const pin = form.str(fd, "pin");
    checkPin(pin);
    await db
      .update(schema.users)
      .set({ pinHash: await hashSecret(pin), failedAttempts: 0, lockedUntil: null })
      .where(and(eq(schema.users.id, userId), eq(schema.users.role, "kitchen")));
    await revokeSessions(userId);
    await audit(actor, "user.reset_pin", "user", userId);
    return { ok: true, message: "Nouveau code enregistré. La personne doit se reconnecter." };
  });
}

export async function createAdmin(fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const name = form.str(fd, "name");
    const email = form.str(fd, "email").toLowerCase();
    const password = form.str(fd, "password");
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) throw new UserError("Nom ou email invalide.");
    const pb = passwordProblem(password);
    if (pb) throw new UserError(pb);
    const exists = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (exists) throw new UserError("Un compte existe déjà avec cet email.");
    await db.insert(schema.users).values({ role: "admin", name, email, passwordHash: await hashSecret(password) });
    await audit(actor, "user.create_admin", "user", null, { email });
    return { ok: true, message: "Administrateur créé" };
  });
}

export async function setPassword(userId: string, fd: FormData) {
  return guarded(["admin"], async ({ actor }) => {
    const password = form.str(fd, "password");
    const pb = passwordProblem(password);
    if (pb) throw new UserError(pb);
    const u = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!u || u.role === "kitchen") throw new UserError("Compte introuvable.");
    await db.update(schema.users).set({ passwordHash: await hashSecret(password), failedAttempts: 0, lockedUntil: null }).where(eq(schema.users.id, userId));
    if (userId !== actor.id) await revokeSessions(userId);
    await audit(actor, "user.reset_password", "user", userId);
    return { ok: true, message: "Mot de passe modifié" };
  });
}

export async function toggleUser(userId: string) {
  return guarded(["admin"], async ({ actor, user }) => {
    if (userId === user.id) throw new UserError("Vous ne pouvez pas désactiver votre propre compte.");
    const u = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!u) throw new UserError("Compte introuvable.");
    if (u.role === "admin" && u.active) {
      const [{ n }] = await db.select({ n: count() }).from(schema.users).where(and(eq(schema.users.role, "admin"), eq(schema.users.active, true), ne(schema.users.id, userId)));
      if (n === 0) throw new UserError("Il doit rester au moins un administrateur actif.");
    }
    await db.update(schema.users).set({ active: !u.active, failedAttempts: 0, lockedUntil: null }).where(eq(schema.users.id, userId));
    if (u.active) await revokeSessions(userId);
    await audit(actor, u.active ? "user.disable" : "user.enable", "user", userId, { name: u.name });
    return { ok: true, message: u.active ? `${u.name} est désactivé(e) et déconnecté(e) immédiatement.` : `${u.name} est réactivé(e).` };
  });
}

export async function deleteKitchenUser(userId: string) {
  return guarded(["admin"], async ({ actor }) => {
    const u = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!u || u.role !== "kitchen") throw new UserError("Seuls les profils cuisine peuvent être supprimés ici.");
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    await audit(actor, "user.delete", "user", userId, { name: u.name });
    return { ok: true, message: "Profil supprimé" };
  });
}

export async function unlockUser(userId: string) {
  return guarded(["admin"], async ({ actor }) => {
    await db.update(schema.users).set({ failedAttempts: 0, lockedUntil: null }).where(eq(schema.users.id, userId));
    await audit(actor, "user.unlock", "user", userId);
    return { ok: true, message: "Compte débloqué" };
  });
}
