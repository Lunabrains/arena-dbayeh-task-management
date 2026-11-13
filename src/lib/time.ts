// Business dates use Asia/Beirut; storage stays in UTC.

export const TZ = "Asia/Beirut";
export const DAY_MS = 86_400_000;
export const MIN = 60_000;

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parts(t: number) {
  const out: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(t)) if (p.type !== "literal") out[p.type] = Number(p.value);
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

const pad = (n: number) => String(n).padStart(2, "0");

export const ms = (iso: string) => Date.parse(iso);
export const iso = (t: number) => new Date(t).toISOString();

/** Beirut business date (YYYY-MM-DD) of a UTC instant. */
export function dateKey(t: number | string): string {
  const p = parts(typeof t === "string" ? Date.parse(t) : t);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Offset of Beirut from UTC at an instant, in ms. */
function offsetAt(t: number): number {
  const p = parts(t);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(t / 1000) * 1000;
}

/** UTC instant for a Beirut wall-clock time. */
export function beirutToUtc(key: string, hour = 0, minute = 0): number {
  const [y, m, d] = key.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const first = guess - offsetAt(guess);
  return guess - offsetAt(first);
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export const dayStart = (key: string) => beirutToUtc(key, 0, 0);
export const dayEnd = (key: string) => beirutToUtc(addDays(key, 1), 0, 0);

export function beirutHour(t: number): number {
  return parts(t).hour % 24;
}

/** "HH:MM" Beirut wall-clock value for a time input. */
export function timeInputValue(t: number): string {
  const p = parts(t);
  return `${pad(p.hour % 24)}:${pad(p.minute)}`;
}

/** UTC ISO string from Beirut date + "HH:MM" inputs. */
export function fromInputs(key: string, time: string): string {
  const [h, m] = time.split(":").map(Number);
  return iso(beirutToUtc(key, h || 0, m || 0));
}

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const shortDayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" });
const longDayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const num = (t: number | string) => (typeof t === "string" ? Date.parse(t) : t);
export const fmtTime = (t: number | string) => timeFmt.format(num(t));
export const fmtDay = (t: number | string) => dayFmt.format(num(t));
export const fmtKey = (key: string) => dayFmt.format(beirutToUtc(key, 12));
export const fmtKeyShort = (key: string) => shortDayFmt.format(beirutToUtc(key, 12));
export const fmtKeyLong = (key: string) => longDayFmt.format(beirutToUtc(key, 12));

/** Deadline label relative to now: "Today 18:30", "Tomorrow 09:00", "Tue 4 Nov 14:00". */
export function fmtDue(due: string, now: number): string {
  const k = dateKey(due);
  const today = dateKey(now);
  if (k === today) return `Today ${fmtTime(due)}`;
  if (k === addDays(today, 1)) return `Tomorrow ${fmtTime(due)}`;
  if (k === addDays(today, -1)) return `Yesterday ${fmtTime(due)}`;
  return `${fmtDay(due)} ${fmtTime(due)}`;
}

/** 01:23:45 style clock for live timers. */
export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Compact duration: "2h 05m", "18m", "45s". */
export function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${pad(m)}m`;
}

export function fmtAgo(t: number | string, now: number): string {
  const diff = Math.max(0, now - num(t));
  const m = Math.floor(diff / MIN);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function greeting(now: number): string {
  const h = beirutHour(now);
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}
