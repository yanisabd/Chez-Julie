import { eq } from "drizzle-orm";
import { db, schema, type DBorTx } from "@/db";
import { settingsSchema, type Settings } from "@/lib/settings-schema";

const KEY = "main";

export async function getSettings(tx: DBorTx = db): Promise<Settings> {
  const row = await tx.query.settings.findFirst({ where: eq(schema.settings.key, KEY) });
  const parsed = settingsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : settingsSchema.parse({});
}

export async function saveSettings(next: Settings, tx: DBorTx = db) {
  const value = settingsSchema.parse(next);
  await tx
    .insert(schema.settings)
    .values({ key: KEY, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
  return value;
}

export async function updateSettings(mutate: (s: Settings) => void) {
  const s = await getSettings();
  mutate(s);
  return saveSettings(s);
}
