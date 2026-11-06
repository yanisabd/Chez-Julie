import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema, type DBorTx } from "@/db";
import type { Settings } from "@/lib/settings-schema";
import { addDays, hhmmOf, isoWeekday, minutesOf, parisDateTime, parisDay, formatHour, WEEKDAYS } from "@/lib/time";

export type Mode = "pickup" | "delivery";

export type SlotState = "available" | "full" | "too_soon" | "blocked" | "past";

export type SlotView = {
  start: Date;
  end: Date;
  key: string; // ISO de début
  label: string;
  state: SlotState;
  slotId: number | null;
  bookedOrders: number;
  bookedItems: number;
  maxOrders: number;
  maxItems: number;
  forcedOpen: boolean;
  blocked: boolean;
  /** Le créneau fait partie des horaires habituels */
  scheduled: boolean;
  modes: Mode[];
};

export type DayAvailability = {
  day: string;
  closedReason: string | null;
  slots: SlotView[];
};

type SlotRow = typeof schema.slots.$inferSelect;

/** Créneaux théoriques d'une journée selon les horaires hebdomadaires. */
export function scheduledCandidates(settings: Settings, day: string) {
  const dayCfg = settings.schedule[isoWeekday(day) - 1];
  const step = settings.ordering.slotMinutes;
  const map = new Map<string, { start: Date; end: Date; modes: Set<Mode> }>();
  if (!dayCfg?.open) return [];
  for (const r of dayCfg.ranges) {
    const s = minutesOf(r.start);
    const e = minutesOf(r.end);
    for (let m = s; m + step <= e; m += step) {
      const start = parisDateTime(day, hhmmOf(m));
      const key = start.toISOString();
      const cur = map.get(key) ?? { start, end: parisDateTime(day, hhmmOf(m + step)), modes: new Set<Mode>() };
      if (r.pickup) cur.modes.add("pickup");
      if (r.delivery) cur.modes.add("delivery");
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

export async function closureFor(day: string, tx: DBorTx = db) {
  const rows = await tx
    .select()
    .from(schema.closures)
    .where(and(lte(schema.closures.startDate, day), gte(schema.closures.endDate, day)))
    .limit(1);
  return rows[0] ?? null;
}

/** Vue complète d'une journée (utilisée par le client ET par l'administration). */
export async function buildDay(
  settings: Settings,
  day: string,
  opts: { now?: Date; itemsCount?: number; mode?: Mode | null; tx?: DBorTx } = {},
): Promise<DayAvailability> {
  const tx = opts.tx ?? db;
  const now = opts.now ?? new Date();
  const itemsCount = opts.itemsCount ?? 1;
  const o = settings.ordering;

  const rows = await tx.select().from(schema.slots).where(eq(schema.slots.day, day));
  const byKey = new Map<string, SlotRow>(rows.map((r) => [r.startsAt.toISOString(), r]));
  const closure = await closureFor(day, tx);

  const candidates = scheduledCandidates(settings, day).map((c) => ({ ...c, scheduled: true }));
  const keys = new Set(candidates.map((c) => c.start.toISOString()));
  for (const r of rows) {
    if (r.forcedOpen && !keys.has(r.startsAt.toISOString())) {
      candidates.push({ start: r.startsAt, end: r.endsAt, modes: new Set<Mode>(["pickup", "delivery"]), scheduled: false });
    }
  }
  candidates.sort((a, b) => a.start.getTime() - b.start.getTime());

  const usage = (await tx.select().from(schema.dayUsage).where(eq(schema.dayUsage.day, day)))[0];
  const dayFullOrders = o.maxOrdersPerDay != null && (usage?.orders ?? 0) + 1 > o.maxOrdersPerDay;
  const dayFullItems = o.maxItemsPerDay != null && (usage?.items ?? 0) + itemsCount > o.maxItemsPerDay;

  const minStart = now.getTime() + o.minLeadHours * 3600_000;
  const slots: SlotView[] = candidates
    .filter((c) => !opts.mode || c.modes.has(opts.mode))
    .map((c) => {
      const row = byKey.get(c.start.toISOString());
      const maxOrders = row?.maxOrders ?? o.defaultMaxOrdersPerSlot;
      const maxItems = row?.maxItems ?? o.defaultMaxItemsPerSlot;
      const bookedOrders = row?.bookedOrders ?? 0;
      const bookedItems = row?.bookedItems ?? 0;
      let state: SlotState = "available";
      if (c.start.getTime() <= now.getTime()) state = "past";
      else if (row?.blocked) state = "blocked";
      else if (c.start.getTime() < minStart) state = "too_soon";
      else if (bookedOrders + 1 > maxOrders || bookedItems + itemsCount > maxItems || dayFullOrders || dayFullItems) state = "full";
      return {
        start: c.start,
        end: c.end,
        key: c.start.toISOString(),
        label: `${formatHour(c.start)} – ${formatHour(c.end)}`,
        state,
        slotId: row?.id ?? null,
        bookedOrders,
        bookedItems,
        maxOrders,
        maxItems,
        forcedOpen: !!row?.forcedOpen,
        blocked: !!row?.blocked,
        scheduled: c.scheduled,
        modes: [...c.modes],
      };
    });

  let closedReason: string | null = null;
  if (closure) closedReason = closure.reason ? `Fermé : ${closure.reason}` : "Fermé ce jour-là";
  else if (!slots.length) closedReason = `Pas de service le ${WEEKDAYS[isoWeekday(day) - 1].toLowerCase()}`;

  if (closure) for (const s of slots) if (s.state === "available" || s.state === "full") s.state = "blocked";
  return { day, closedReason, slots };
}

export type CartLine = { productId: number; qty: number };

/**
 * Disponibilités proposées au client pour son panier :
 * - délai minimum de commande & horizon maximum
 * - capacité des créneaux et de la journée
 * - jours de vente et limites journalières de chaque plat
 */
export async function getCustomerAvailability(settings: Settings, mode: Mode, cart: CartLine[], now = new Date()) {
  const itemsCount = cart.reduce((n, l) => n + l.qty, 0);
  const today = parisDay(now);
  const days: string[] = [];
  for (let i = 0; i <= settings.ordering.maxAdvanceDays; i++) days.push(addDays(today, i));

  const productIds = [...new Set(cart.map((l) => l.productId))];
  const prods = productIds.length
    ? await db
        .select({ id: schema.products.id, name: schema.products.name, availableDays: schema.products.availableDays, dailyLimit: schema.products.dailyLimit })
        .from(schema.products)
        .where(inArray(schema.products.id, productIds))
    : [];
  const limited = prods.filter((p) => p.dailyLimit != null).map((p) => p.id);
  const usage = limited.length
    ? await db
        .select()
        .from(schema.productDayUsage)
        .where(and(inArray(schema.productDayUsage.productId, limited), inArray(schema.productDayUsage.day, days)))
    : [];
  const qtyByProduct = new Map<number, number>();
  for (const l of cart) qtyByProduct.set(l.productId, (qtyByProduct.get(l.productId) ?? 0) + l.qty);

  const result: (DayAvailability & { productIssue: string | null })[] = [];
  for (const day of days) {
    const d = await buildDay(settings, day, { now, itemsCount, mode });
    let productIssue: string | null = null;
    const wd = isoWeekday(day);
    for (const p of prods) {
      if (p.availableDays.length && !p.availableDays.includes(wd)) {
        productIssue = `« ${p.name} » n’est pas proposé ce jour-là`;
        break;
      }
      if (p.dailyLimit != null) {
        const used = usage.find((u) => u.productId === p.id && u.day === day)?.qty ?? 0;
        const left = p.dailyLimit - used;
        if (left < (qtyByProduct.get(p.id) ?? 0)) {
          productIssue = left <= 0 ? `« ${p.name} » est complet ce jour-là` : `Plus que ${left} « ${p.name} » ce jour-là`;
          break;
        }
      }
    }
    if (productIssue) for (const s of d.slots) if (s.state === "available") s.state = "full";
    result.push({ ...d, productIssue });
  }
  return result;
}
