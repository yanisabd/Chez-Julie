import * as schema from "./schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import path from "node:path";

export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DBorTx = DB | Tx;

const g = globalThis as unknown as { __db?: DB; __dbClose?: () => Promise<void> };

/** true quand aucune base PostgreSQL externe n'est configurée (mode local embarqué). */
export const isEmbeddedDb = () => !process.env.DATABASE_URL;

function create(): DB {
  if (process.env.DATABASE_URL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      // Connexion chiffrée avec vérification du certificat (sauf base locale ou DATABASE_SSL=false)
      ssl:
        process.env.DATABASE_SSL === "false" || /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL)
          ? undefined
          : { rejectUnauthorized: process.env.DATABASE_SSL !== "no-verify" },
    });
    g.__dbClose = () => pool.end();
    return drizzle(pool, { schema });
  }
  if (process.env.VERCEL || process.env.REQUIRE_DATABASE_URL === "true") {
    throw new Error("DATABASE_URL manquant : configurez une base PostgreSQL dans les variables d’environnement de l’hébergement (voir README).");
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  const dir = process.env.PGLITE_DIR === "memory" ? undefined : path.resolve(process.env.PGLITE_DIR ?? "./data/db");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (dir) (require("node:fs") as typeof import("node:fs")).mkdirSync(path.dirname(dir), { recursive: true });
  const client = new PGlite(dir);
  g.__dbClose = () => client.close();
  return drizzle(client, { schema }) as unknown as DB;
}

export function getDb(): DB {
  if (!g.__db) g.__db = create();
  return g.__db;
}

export async function closeDb() {
  if (g.__dbClose) await g.__dbClose();
  g.__db = undefined;
  g.__dbClose = undefined;
}

export const db = new Proxy({} as DB, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

export { schema };
