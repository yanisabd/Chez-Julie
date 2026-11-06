import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ZodError } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { AuthError, requireRole, actorOf, type Role, type SessionUser } from "./auth";
import { logSystem, type Actor } from "./log";

export class UserError extends Error {}

/**
 * Enveloppe commune des actions serveur :
 * - vérifie le rôle côté serveur (jamais seulement dans l'interface)
 * - transforme les erreurs en messages clairs
 * - journalise les erreurs inattendues
 */
export async function guarded<T = undefined>(
  roles: Role[],
  fn: (ctx: { user: SessionUser; actor: Actor }) => Promise<ActionResult<T> | void>,
  opts: { revalidate?: string[] } = {},
): Promise<ActionResult<T>> {
  try {
    const user = await requireRole(roles);
    const r = await fn({ user, actor: actorOf(user) });
    for (const p of opts.revalidate ?? []) revalidatePath(p, "layout");
    return r ?? { ok: true };
  } catch (e) {
    if (isRedirectError(e)) throw e;
    if (e instanceof AuthError || e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "Données invalides." };
    await logSystem("error", "Erreur dans une action", e);
    return { ok: false, error: "Une erreur inattendue est survenue. Elle a été enregistrée. Réessayez." };
  }
}

/** Lecture tolérante des formulaires. */
export const form = {
  str: (fd: FormData, k: string) => String(fd.get(k) ?? "").trim(),
  int: (fd: FormData, k: string): number | null => {
    const v = String(fd.get(k) ?? "").trim();
    if (v === "") return null;
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? Math.round(n) : null;
  },
  num: (fd: FormData, k: string): number | null => {
    const v = String(fd.get(k) ?? "").trim();
    if (v === "") return null;
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  },
  bool: (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true",
};
