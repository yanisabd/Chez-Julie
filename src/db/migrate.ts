import path from "node:path";
import { getDb, isEmbeddedDb } from "./index";

export async function runMigrations() {
  const db = getDb();
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  if (isEmbeddedDb()) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db, { migrationsFolder });
  }
}
