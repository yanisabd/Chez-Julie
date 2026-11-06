import { db, schema, type DBorTx } from "@/db";

export type Actor = { id: string | null; label: string };
export const SYSTEM: Actor = { id: null, label: "Système" };

/** Journal d'activité : toute action importante d'un humain ou du système. */
export async function audit(
  actor: Actor,
  action: string,
  entity?: string,
  entityId?: string | number | null,
  details?: Record<string, unknown>,
  tx: DBorTx = db,
) {
  try {
    await tx.insert(schema.auditLogs).values({
      actorUserId: actor.id,
      actorLabel: actor.label,
      action,
      entity: entity ?? null,
      entityId: entityId != null ? String(entityId) : null,
      details: details ?? null,
    });
  } catch (e) {
    console.error("[audit] échec", e);
  }
}

/**
 * Journal technique. Les erreurs apparaissent sur le tableau de bord de l'administrateur
 * (et peuvent être reliées à Sentry via la variable SENTRY_DSN côté hébergeur).
 */
export async function logSystem(level: "info" | "warn" | "error", message: string, context?: unknown) {
  const ctx =
    context instanceof Error
      ? { name: context.name, message: context.message, stack: context.stack?.split("\n").slice(0, 6).join("\n") }
      : (context as Record<string, unknown> | undefined);
  if (level === "error") console.error(`[${level}] ${message}`, context ?? "");
  else console.log(`[${level}] ${message}`);
  try {
    await db.insert(schema.systemLogs).values({ level, message, context: ctx ?? null });
  } catch (e) {
    console.error("[logSystem] impossible d'écrire le journal", e);
  }
}
