import { sql } from "drizzle-orm";
import type { DB } from "@/db";

/** Ordre d'insertion respectant les clés étrangères. */
export const BACKUP_TABLES = [
  "settings",
  "users",
  "images",
  "categories",
  "products",
  "option_groups",
  "options",
  "ingredients",
  "recipe_items",
  "slots",
  "closures",
  "delivery_zones",
  "promo_codes",
  "day_usage",
  "product_day_usage",
  "orders",
  "order_items",
  "order_events",
  "payments",
  "refunds",
  "stock_movements",
  "notifications",
  "webhook_events",
  "audit_logs",
  "system_logs",
] as const;

const SERIAL_TABLES = ["categories", "products", "option_groups", "options", "ingredients", "slots", "closures", "delivery_zones", "promo_codes", "order_items", "order_events", "payments", "refunds", "stock_movements", "notifications", "audit_logs", "system_logs"];

const rowsOf = (r: unknown) => (r as { rows: Record<string, unknown>[] }).rows;

export type Backup = { app: "mounoukid"; version: 1; createdAt: string; tables: Record<string, Record<string, unknown>[]> };

/** Exporte toutes les données (hors sessions et données techniques éphémères). */
export async function exportAll(db: DB): Promise<Backup> {
  const tables: Backup["tables"] = {};
  for (const t of BACKUP_TABLES) {
    // row_to_json garantit un format identique quel que soit le pilote (bytea encodé en hexadécimal)
    const rows = rowsOf(await db.execute(sql.raw(`SELECT row_to_json(x)::text AS j FROM ${t} x`)));
    tables[t] = rows.map((r) => JSON.parse(String(r.j)));
  }
  return { app: "mounoukid", version: 1, createdAt: new Date().toISOString(), tables };
}

/** Restaure une sauvegarde : remplace TOUTES les données actuelles, en une seule transaction. */
export async function restoreAll(db: DB, backup: Backup) {
  if (backup?.app !== "mounoukid" || backup.version !== 1 || typeof backup.tables !== "object") throw new Error("Fichier de sauvegarde invalide.");
  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`TRUNCATE ${[...BACKUP_TABLES, "sessions", "password_resets", "rate_limits"].join(", ")} RESTART IDENTITY CASCADE`));
    for (const t of BACKUP_TABLES) {
      const rows = backup.tables[t] ?? [];
      // Insertion par paquets via json_populate_recordset : les types sont reconstitués par PostgreSQL
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = JSON.stringify(rows.slice(i, i + 200));
        await tx.execute(sql`INSERT INTO ${sql.raw(t)} SELECT * FROM json_populate_recordset(NULL::${sql.raw(t)}, ${chunk}::json)`);
      }
    }
    for (const t of SERIAL_TABLES) {
      await tx.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM ${t}), 0), 1), (SELECT COUNT(*) > 0 FROM ${t}))`));
    }
    await tx.execute(sql.raw(`SELECT setval('order_number_seq', GREATEST(COALESCE((SELECT MAX(number) FROM orders), 1000), 1000))`));
  });
}
