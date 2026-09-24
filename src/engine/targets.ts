import { addLocalDays, localDate, programWeek, weekStart } from "./calendar";
import type { CheckIn, SessionLog } from "./types";

export interface WeeklyTargets {
  hardSets: number;
  rounds: number;
}

/** The higher of leg and upper-body soreness. */
export function overallSoreness(c: CheckIn): number {
  return Math.max(c.sorenessLegs, c.sorenessUpper);
}

/**
 * Recovery holds when, across the previous two program weeks, average soreness
 * is 3 or lower and average energy is 3 or higher. No check-ins in that window
 * counts as not holding.
 */
export function recoveryHolding(sessions: SessionLog[], now: Date, zone: string): boolean {
  const thisWeek = weekStart(now, zone);
  const from = addLocalDays(thisWeek, -14);
  const checkIns = sessions
    .filter((s) => s.checkIn)
    .filter((s) => {
      const d = localDate(s.startedAt, zone);
      return d >= from && d < thisWeek;
    })
    .map((s) => s.checkIn as CheckIn);
  if (checkIns.length === 0) return false;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return avg(checkIns.map(overallSoreness)) <= 3 && avg(checkIns.map((c) => c.energy)) >= 3;
}

export function weeklyTargets(week: number, holding: boolean): WeeklyTargets {
  if (week <= 2) return { hardSets: 6, rounds: 2 };
  if (week <= 4) return { hardSets: 9, rounds: 3 };
  return holding ? { hardSets: 12, rounds: 4 } : { hardSets: 9, rounds: 3 };
}

export function targetsFor(sessions: SessionLog[], now: Date, programStartDate: string, zone: string) {
  const week = programWeek(now, programStartDate, zone);
  const holding = week >= 5 && recoveryHolding(sessions, now, zone);
  return { week, holding, ...weeklyTargets(week, holding) };
}
