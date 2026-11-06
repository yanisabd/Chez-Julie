import { TZDate } from "@date-fns/tz";

export const TZ = "Europe/Paris";

/** "YYYY-MM-DD" du jour à Paris pour un instant donné. */
export function parisDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** "HH:MM" à Paris. */
export function parisTime(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

/** Instant correspondant à une date + heure locale de Paris. */
export function parisDateTime(day: string, hhmm: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, TZ).getTime());
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Jour ISO : 1 = lundi ... 7 = dimanche */
export function isoWeekday(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function hhmmOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function utcDate(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDayLong(day: string): string {
  const s = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(utcDate(day));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDayShort(day: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(utcDate(day));
}

export function formatDayNumeric(day: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(utcDate(day));
}

/** "Aujourd'hui", "Demain" ou "Samedi 12 novembre" */
export function relativeDayLabel(day: string, now = new Date()): string {
  const today = parisDay(now);
  if (day === today) return "Aujourd’hui";
  if (day === addDays(today, 1)) return "Demain";
  if (day === addDays(today, -1)) return "Hier";
  return formatDayLong(day);
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatHour(d: Date): string {
  return parisTime(d).replace(":", "h");
}

export function slotLabel(start: Date, end: Date): string {
  return `${formatHour(start)} – ${formatHour(end)}`;
}
