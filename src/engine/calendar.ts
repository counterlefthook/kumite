import { addDays, differenceInCalendarDays, format, getISODay } from "date-fns";
import { TZDate, tz } from "@date-fns/tz";

// Local calendar math for America/Chicago (or whatever zone the profile holds).
// Instants are converted to local dates with @date-fns/tz, which knows every
// daylight saving change; after that the engine works in plain "YYYY-MM-DD"
// calendar dates, which have no time zone.

export type LocalDate = string;

/** The local calendar date of an instant, as YYYY-MM-DD. */
export function localDate(instant: Date | string, zone: string): LocalDate {
  return format(new Date(instant), "yyyy-MM-dd", { in: tz(zone) });
}

/** Minutes since local midnight. */
export function localMinutes(instant: Date | string, zone: string): number {
  const d = new TZDate(new Date(instant), zone);
  return d.getHours() * 60 + d.getMinutes();
}

// Calendar dates are handled at noon UTC so no clock change can move them.
function noonUtc(date: LocalDate): TZDate {
  return new TZDate(`${date}T12:00:00`, "UTC");
}

export function addLocalDays(date: LocalDate, days: number): LocalDate {
  return format(addDays(noonUtc(date), days), "yyyy-MM-dd", { in: tz("UTC") });
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return differenceInCalendarDays(noonUtc(to), noonUtc(from), { in: tz("UTC") });
}

/** Monday is 1 through Sunday 7. */
export function dayIndexOfDate(date: LocalDate): number {
  return getISODay(noonUtc(date), { in: tz("UTC") });
}

export function dayIndex(instant: Date | string, zone: string): number {
  return dayIndexOfDate(localDate(instant, zone));
}

/** The Monday that starts the Monday-to-Sunday week holding this date. */
export function weekStartOfDate(date: LocalDate): LocalDate {
  return addLocalDays(date, 1 - dayIndexOfDate(date));
}

export function weekStart(instant: Date | string, zone: string): LocalDate {
  return weekStartOfDate(localDate(instant, zone));
}

export function isWorkday(date: LocalDate): boolean {
  return dayIndexOfDate(date) <= 5;
}

/**
 * Week 1 is the week that holds the program start date. Dates before the start
 * also count as week 1.
 */
export function programWeek(instant: Date | string, programStartDate: LocalDate, zone: string): number {
  const weeks = daysBetween(weekStartOfDate(programStartDate), weekStart(instant, zone)) / 7;
  return Math.max(1, weeks + 1);
}

/** "HH:MM" to minutes since midnight. */
export function clockToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
