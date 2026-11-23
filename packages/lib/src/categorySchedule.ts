// A category's cadence is stored as an RFC 5545 RRULE. We only read and write
// the subset below; anything else parses to null.

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type WeekOfMonth = 1 | 2 | 3 | 4 | -1;

export type CategoryCadence =
  | { kind: "weekly"; interval: number; weekdays: Weekday[] }
  | {
      kind: "monthly";
      interval: number;
      week: WeekOfMonth;
      weekday: Weekday;
    };

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
/** Weekdays in display order, Monday first */
export const WEEKDAYS_FROM_MONDAY: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
export const WEEK_OF_MONTH_NAMES: Record<WeekOfMonth, string> = {
  1: "First",
  2: "Second",
  3: "Third",
  4: "Fourth",
  [-1]: "Last",
};

const sortWeekdays = (days: Weekday[]) =>
  WEEKDAYS_FROM_MONDAY.filter((d) => days.includes(d));

export const parseCadence = (
  rrule: string | null | undefined,
): CategoryCadence | null => {
  if (!rrule) return null;
  const parts = new Map(
    rrule
      .replace(/^RRULE:/, "")
      .split(";")
      .map((p) => p.split("=") as [string, string]),
  );
  const freq = parts.get("FREQ");
  const byDay = (parts.get("BYDAY") ?? "").split(",");
  const interval = Number(parts.get("INTERVAL") ?? "1");
  const known = new Set(["FREQ", "BYDAY", "INTERVAL"]);
  if ([...parts.keys()].some((k) => !known.has(k))) return null;
  if (!Number.isInteger(interval) || interval < 1) return null;

  const matches = byDay.map((d) =>
    /^(-1|[1-4])?(SU|MO|TU|WE|TH|FR|SA)$/.exec(d),
  );
  if (matches.some((m) => !m)) return null;
  const days = matches.map((m) => DAY_CODES.indexOf(m![2] as any) as Weekday);

  if (freq === "WEEKLY" && matches.every((m) => !m![1])) {
    if (new Set(days).size !== days.length) return null;
    return { kind: "weekly", interval, weekdays: sortWeekdays(days) };
  }
  if (freq === "MONTHLY" && matches.length === 1 && matches[0]![1]) {
    return {
      kind: "monthly",
      interval,
      week: Number(matches[0]![1]) as WeekOfMonth,
      weekday: days[0]!,
    };
  }
  return null;
};

export const formatCadence = (cadence: CategoryCadence): string => {
  const interval = cadence.interval > 1 ? `;INTERVAL=${cadence.interval}` : "";
  if (cadence.kind === "weekly") {
    const days = sortWeekdays(cadence.weekdays).map((d) => DAY_CODES[d]);
    return `FREQ=WEEKLY${interval};BYDAY=${days.join(",")}`;
  }
  return `FREQ=MONTHLY${interval};BYDAY=${cadence.week}${DAY_CODES[cadence.weekday]}`;
};

const joinNames = (names: string[]) =>
  names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
    : (names[0] ?? "");

export const describeCadence = (cadence: CategoryCadence): string => {
  if (cadence.kind === "weekly") {
    const days = joinNames(
      sortWeekdays(cadence.weekdays).map((d) => WEEKDAY_NAMES[d]),
    );
    if (cadence.interval === 1) {
      return cadence.weekdays.length === 7 ? "Every day" : `Every ${days}`;
    }
    return `Every ${cadence.interval} weeks on ${days}`;
  }
  const day = `${WEEK_OF_MONTH_NAMES[cadence.week]} ${WEEKDAY_NAMES[cadence.weekday]}`;
  return cadence.interval === 1
    ? `${day} of the month`
    : `${day} of every ${cadence.interval} months`;
};

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const daysBetween = (a: Date, b: Date) =>
  Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
      Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
      86_400_000,
  );

const addDays = (d: Date, days: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

// Weeks start on Monday, as in RRULE's default WKST
const startOfWeek = (d: Date) =>
  addDays(startOfDay(d), -((d.getDay() + 6) % 7));

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

const mod = (n: number, m: number) => ((n % m) + m) % m;

const nthWeekdayOfMonth = (
  year: number,
  month: number,
  week: WeekOfMonth,
  weekday: Weekday,
) => {
  if (week === -1) {
    const last = new Date(year, month + 1, 0);
    return addDays(last, -((last.getDay() - weekday + 7) % 7));
  }
  const first = new Date(year, month, 1);
  return addDays(first, ((weekday - first.getDay() + 7) % 7) + (week - 1) * 7);
};

/** Index of the week/month a day falls in, for "every N" phases */
const periodOf = (cadence: CategoryCadence, day: Date) =>
  cadence.kind === "weekly"
    ? Math.round(daysBetween(new Date(2000, 0, 3), startOfWeek(day)) / 7)
    : monthIndex(day);

/** Every matching day on or after `start`, ignoring the interval */
function* everyMatch(cadence: CategoryCadence, start: Date) {
  if (cadence.kind === "weekly") {
    if (cadence.weekdays.length === 0) return;
    for (let day = start; ; day = addDays(day, 1)) {
      if (cadence.weekdays.includes(day.getDay() as Weekday)) yield day;
    }
  }
  for (let m = 0; ; m++) {
    const day = nthWeekdayOfMonth(
      start.getFullYear(),
      start.getMonth() + m,
      cadence.week,
      cadence.weekday,
    );
    if (day >= start) yield day;
  }
}

/**
 * Upcoming days (local midnight) on or after `from`. For "every N weeks/months"
 * the anchor is any day in a week/month that has one; without it, the first
 * match counts as one.
 */
export const nextOccurrences = (
  cadence: CategoryCadence,
  {
    from = new Date(),
    anchor,
    count = 1,
    endsAt,
  }: {
    from?: Date;
    anchor?: Date | null;
    count?: number;
    /** Minutes after midnight when it's over; today is skipped after that */
    endsAt?: number | null;
  } = {},
): Date[] => {
  const result: Date[] = [];
  let phase: number | null = anchor ? periodOf(cadence, anchor) : null;
  let start = startOfDay(from);
  if (endsAt != null && from.getHours() * 60 + from.getMinutes() >= endsAt) {
    start = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 1,
    );
  }
  for (const day of everyMatch(cadence, start)) {
    if (result.length >= count) break;
    phase ??= periodOf(cadence, day);
    if (mod(periodOf(cadence, day) - phase, cadence.interval) === 0) {
      result.push(day);
    }
  }
  return result;
};

export const nextOccurrence = (
  cadence: CategoryCadence,
  options?: { from?: Date; anchor?: Date | null; endsAt?: number | null },
): Date | null => nextOccurrences(cadence, { ...options, count: 1 })[0] ?? null;

/** First day of each of the next `interval` weeks/months that have one */
export const nextPeriodStarts = (
  cadence: CategoryCadence,
  from?: Date,
  endsAt?: number | null,
): Date[] => {
  const result: Date[] = [];
  const seen = new Set<number>();
  const every = { ...cadence, interval: 1 };
  for (const day of nextOccurrences(every, {
    from,
    endsAt,
    count: cadence.interval * 7,
  })) {
    const period = periodOf(cadence, day);
    if (seen.has(period)) continue;
    seen.add(period);
    result.push(day);
    if (result.length === cadence.interval) break;
  }
  return result;
};

/** "10:30:00" -> "10:30" */
export const formatCategoryTime = (time: string) => time.slice(0, 5);

/** Minutes after midnight when an occurrence ends; null (all day) without a start time or length */
export const categoryEndsAt = (
  startTime?: string | null,
  durationMinutes?: number | null,
): number | null => {
  const [h, m] = (startTime ?? "").split(":").map(Number);
  if (!startTime || !Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (durationMinutes == null) return null;
  return h! * 60 + m! + durationMinutes;
};

/** A category's `recurrenceAnchor` ("2026-11-15") -> local-midnight Date */
export const fromDateValue = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};

/** Local Date -> "2026-11-15" */
export const toDateValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
