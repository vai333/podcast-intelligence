// The ONLY place dates are formatted. IST has no DST (UTC+5:30), so we shift by a fixed
// offset and read UTC fields. No Intl for dates, so server and client always agree.

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DateInput = Date | string | number;

function toDate(d: DateInput): Date {
  return d instanceof Date ? d : new Date(d);
}

/** A Date whose UTC fields equal the IST wall-clock fields of `d`. */
function ist(d: DateInput): Date {
  return new Date(toDate(d).getTime() + IST_OFFSET_MS);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isoDateIST(d: DateInput): string {
  const s = ist(d);
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
}

/** Midnight IST on the given YYYY-MM-DD, as a real instant. */
export function startOfDayIST(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);
}

export function addDaysISO(isoDate: string, n: number): string {
  return isoDateIST(new Date(startOfDayIST(isoDate).getTime() + n * DAY_MS));
}

/** Monday (YYYY-MM-DD, IST) of the week containing `d`. */
export function weekStartIST(d: DateInput): string {
  const s = ist(d);
  const dow = (s.getUTCDay() + 6) % 7; // Mon=0
  return addDaysISO(isoDateIST(d), -dow);
}

export interface WeekRange {
  weekStart: string; // Monday, YYYY-MM-DD IST
  weekEnd: string; // Sunday, YYYY-MM-DD IST
  start: Date; // Monday 00:00:00 IST
  end: Date; // Sunday 23:59:59.999 IST
}

export function weekRangeIST(weekStart: string): WeekRange {
  const start = startOfDayIST(weekStart);
  const weekEnd = addDaysISO(weekStart, 6);
  const end = new Date(startOfDayIST(addDaysISO(weekStart, 7)).getTime() - 1);
  return { weekStart, weekEnd, start, end };
}

function dayMonth(d: DateInput) {
  const s = ist(d);
  return `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]}`;
}

function clock(d: DateInput) {
  const s = ist(d);
  const h = s.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(s.getUTCMinutes())} ${h < 12 ? "AM" : "PM"}`;
}

export type DateStyle = "day" | "weekday" | "daytime" | "time" | "full";

export function formatIST(d: DateInput, style: DateStyle = "day"): string {
  const s = ist(d);
  switch (style) {
    case "day":
      return dayMonth(d);
    case "weekday":
      return `${WEEKDAYS[s.getUTCDay()]} ${dayMonth(d)}`;
    case "time":
      return `${clock(d)} IST`;
    case "daytime":
      return `${dayMonth(d)}, ${clock(d)} IST`;
    case "full":
      return `${WEEKDAYS[s.getUTCDay()]} ${dayMonth(d)} ${s.getUTCFullYear()}, ${clock(d)} IST`;
  }
}

/** "28 Sep to 4 Oct" (collapses the month when it is the same). */
export function formatWeekLabel(weekStart: string): string {
  const { start, end } = weekRangeIST(weekStart);
  const a = ist(start);
  const b = ist(end);
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()} to ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
  }
  return `${dayMonth(start)} to ${dayMonth(end)}`;
}

/** "Week of 5 Oct" */
export function formatWeekOf(weekStart: string): string {
  return `Week of ${dayMonth(startOfDayIST(weekStart))}`;
}

export function relativeDays(d: DateInput, now: DateInput): string {
  const diff = Math.round((toDate(now).getTime() - toDate(d).getTime()) / DAY_MS);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  return `${diff} days ago`;
}

export function relativeTime(d: DateInput, now: DateInput): string {
  const mins = Math.round((toDate(now).getTime() - toDate(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return relativeDays(d, now);
}

export function daysBetween(a: DateInput, b: DateInput): number {
  return Math.round(Math.abs(toDate(a).getTime() - toDate(b).getTime()) / DAY_MS);
}

/** 212345 -> "2,12,345" (en-IN grouping), no Intl so it is identical everywhere. */
export function formatCount(n: number): string {
  const s = String(Math.round(n));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/** 212345 -> "212K", 1250000 -> "1.3M" */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${pad(m)}m` : `${m}m`;
}

export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** 0 = Sunday ... 6 = Saturday, in IST. */
export function istWeekday(d: DateInput = Date.now()): number {
  return ist(d).getUTCDay();
}
