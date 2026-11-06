import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, gt, lt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { db, schema } from "@/db";
import type { Actor } from "./log";

export type Role = "admin" | "kitchen" | "customer";
export type SessionUser = { id: string; role: Role; name: string; email: string | null };

const COOKIE = "mk_session";
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export const hashSecret = (s: string) => bcrypt.hash(s, 11);
export const verifySecret = (s: string, hash: string | null) => (hash ? bcrypt.compare(s, hash) : Promise.resolve(false));

/** Exigences minimales de mot de passe (staff & clients). */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Le mot de passe doit contenir au moins 10 caractères.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Le mot de passe doit contenir des lettres et des chiffres.";
  return null;
}

export async function createSession(userId: string, role: Role) {
  const token = randomToken();
  const days = role === "kitchen" ? 30 : role === "admin" ? 7 : 30;
  const expiresAt = new Date(Date.now() + days * 86400_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await db.insert(schema.sessions).values({ id: sha256(token), userId, expiresAt, userAgent: ua });
  await db.update(schema.users).set({ lastLoginAt: new Date(), failedAttempts: 0, lockedUntil: null }).where(eq(schema.users.id, userId));
  // Nettoyage opportuniste des sessions expirées
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ id: schema.users.id, role: schema.users.role, name: schema.users.name, email: schema.users.email, active: schema.users.active })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const u = rows[0];
  if (!u || !u.active) return null;
  return { id: u.id, role: u.role, name: u.name, email: u.email };
});

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  jar.delete(COOKIE);
}

/** Pour les pages : redirige vers la bonne page de connexion si l'accès est refusé. */
export async function requirePageRole(roles: Role[]): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (u && roles.includes(u.role)) return u;
  if (roles.includes("admin") && !roles.includes("kitchen")) redirect("/admin/connexion");
  if (roles.includes("kitchen")) redirect(u?.role === "admin" ? "/admin" : "/cuisine/connexion");
  redirect("/compte/connexion");
}

export class AuthError extends Error {
  constructor() {
    super("Accès refusé. Merci de vous reconnecter.");
  }
}

/** Pour les actions serveur : chaque action vérifie elle-même les droits. */
export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u || !roles.includes(u.role)) throw new AuthError();
  return u;
}

export const actorOf = (u: SessionUser): Actor => ({
  id: u.id,
  label: `${u.name} (${u.role === "admin" ? "admin" : u.role === "kitchen" ? "cuisine" : "client"})`,
});

type LoginResult = { ok: true; user: SessionUser } | { ok: false; error: string };

async function checkLock(user: { lockedUntil: Date | null }): Promise<string | null> {
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const min = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return `Trop d’essais. Réessayez dans ${min} minute${min > 1 ? "s" : ""}.`;
  }
  return null;
}

async function registerFailure(userId: string, failed: number) {
  const n = failed + 1;
  await db
    .update(schema.users)
    .set({
      failedAttempts: n >= MAX_FAILED ? 0 : n,
      lockedUntil: n >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
    })
    .where(eq(schema.users.id, userId));
}

export async function loginWithPassword(email: string, password: string, roles: Role[]): Promise<LoginResult> {
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email.trim().toLowerCase()) });
  const generic = "Email ou mot de passe incorrect.";
  if (!user || !roles.includes(user.role) || !user.passwordHash) {
    await bcrypt.compare(password, "$2b$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv"); // temps constant
    return { ok: false, error: generic };
  }
  const locked = await checkLock(user);
  if (locked) return { ok: false, error: locked };
  if (!user.active) return { ok: false, error: "Ce compte est désactivé." };
  if (!(await verifySecret(password, user.passwordHash))) {
    await registerFailure(user.id, user.failedAttempts);
    return { ok: false, error: generic };
  }
  await createSession(user.id, user.role);
  return { ok: true, user: { id: user.id, role: user.role, name: user.name, email: user.email } };
}

export async function loginKitchen(userId: string, pin: string): Promise<LoginResult> {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user || user.role !== "kitchen" || !user.active) return { ok: false, error: "Profil introuvable ou désactivé." };
  const locked = await checkLock(user);
  if (locked) return { ok: false, error: locked };
  if (!(await verifySecret(pin, user.pinHash))) {
    await registerFailure(user.id, user.failedAttempts);
    const left = MAX_FAILED - (user.failedAttempts + 1);
    return { ok: false, error: left > 0 ? `Code incorrect. Encore ${left} essai${left > 1 ? "s" : ""}.` : "Code incorrect. Profil bloqué 15 minutes." };
  }
  await createSession(user.id, "kitchen");
  return { ok: true, user: { id: user.id, role: "kitchen", name: user.name, email: user.email } };
}

/** Déconnecte un utilisateur de tous ses appareils (désactivation, changement de code...). */
export async function revokeSessions(userId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}
