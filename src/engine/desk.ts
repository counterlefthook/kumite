import { clockToMinutes, isWorkday, localDate, localMinutes, type LocalDate } from "./calendar";
import { latestMax } from "./progression";
import type { History, Library, Profile, Suggestion } from "./types";
import { exerciseById } from "./library";

// Desk sets (PLAN, Engine rules, "Desk sets"). Desk sets never count as hard sets.

export const DESK_PUSHUP = "desk_pushup";
export const CHAIR_SQUAT = "chair_squat";
export const PULLUP_SINGLE = "pullup_single";

export type DeskSlot = "pushups" | "squats" | "pullups";
/** Tie-break order for the desk break. */
export const DESK_ORDER: DeskSlot[] = ["pushups", "squats", "pullups"];

export type DeskTargetsToday = Record<DeskSlot, number>;

function workHours(profile: Profile): number {
  return (clockToMinutes(profile.workEnd) - clockToMinutes(profile.workStart)) / 60;
}

/** Daily targets on a workday; null on weekends, which show totals without targets. */
export function deskTargets(profile: Profile, date: LocalDate): DeskTargetsToday | null {
  if (!isWorkday(date)) return null;
  return weekdayTargets(profile);
}

function weekdayTargets(profile: Profile): DeskTargetsToday {
  const t = profile.deskTargets;
  return {
    pushups: t.pushupsPerDay,
    squats: t.chairSquatsPerHour * workHours(profile),
    pullups: t.pullupSinglesPerDay,
  };
}

/** Half the latest max, rounded down, minimum 1. */
export function miniSetSize(max: number | null): number {
  return Math.max(1, Math.floor((max ?? 0) / 2));
}

/** The desk exercise that stands in for chair squats on a sore-knee day. */
export function squatExercise(lib: Library, kneePain: number | null): string {
  return kneePain !== null && kneePain > 3 ? (lib.knee_swaps.desk[CHAIR_SQUAT] ?? CHAIR_SQUAT) : CHAIR_SQUAT;
}

/** Reps done today per slot. Glute bridges on a sore-knee day count toward squats. */
export function deskDone(lib: Library, history: History, date: LocalDate, zone: string): Record<DeskSlot, number> {
  const done: Record<DeskSlot, number> = { pushups: 0, squats: 0, pullups: 0 };
  const squatIds = [CHAIR_SQUAT, lib.knee_swaps.desk[CHAIR_SQUAT]];
  for (const d of history.deskSets) {
    if (localDate(d.loggedAt, zone) !== date) continue;
    const reps = d.reps ?? 0;
    if (d.exerciseId === DESK_PUSHUP) done.pushups += reps;
    else if (squatIds.includes(d.exerciseId)) done.squats += reps;
    else if (d.exerciseId === PULLUP_SINGLE) done.pullups += reps;
  }
  return done;
}

export function deskTargetsMet(lib: Library, profile: Profile, history: History, date: LocalDate): boolean {
  const targets = deskTargets(profile, date);
  if (!targets) return false;
  const done = deskDone(lib, history, date, profile.timezone);
  return DESK_ORDER.every((slot) => done[slot] >= targets[slot]);
}

/**
 * Desk slots ranked furthest behind first, by shortfall against where each
 * target should be by now as a share of the daily target. Before work starts
 * and on weekends, by the smallest share done. Ties keep DESK_ORDER.
 */
export function deskRanking(lib: Library, profile: Profile, history: History, now: Date): DeskSlot[] {
  const zone = profile.timezone;
  const date = localDate(now, zone);
  const targets = weekdayTargets(profile);
  const done = deskDone(lib, history, date, zone);
  const start = clockToMinutes(profile.workStart);
  const end = clockToMinutes(profile.workEnd);
  const share = isWorkday(date) ? Math.min(1, Math.max(0, (localMinutes(now, zone) - start) / (end - start))) : 0;
  const score = (slot: DeskSlot) => (targets[slot] * share - done[slot]) / targets[slot];
  return [...DESK_ORDER].sort((a, b) => {
    const diff = score(b) - score(a);
    return Math.abs(diff) < 1e-9 ? DESK_ORDER.indexOf(a) - DESK_ORDER.indexOf(b) : diff;
  });
}

/**
 * The desk break: the one exercise furthest behind where it should be by now,
 * as a share of its daily target. Before work starts and on weekends, the one
 * with the smallest share done.
 */
export function deskBreak(lib: Library, profile: Profile, history: History, now: Date, kneePain: number | null): Suggestion {
  const zone = profile.timezone;
  const date = localDate(now, zone);
  const targets = weekdayTargets(profile);
  const done = deskDone(lib, history, date, zone);

  const slot = deskRanking(lib, profile, history, now)[0];

  const exerciseId = slot === "pushups" ? DESK_PUSHUP : slot === "pullups" ? PULLUP_SINGLE : squatExercise(lib, kneePain);
  const reps =
    slot === "pullups"
      ? 1
      : miniSetSize(latestMax(history, slot === "pushups" ? DESK_PUSHUP : CHAIR_SQUAT, now));
  const name = exerciseById(lib, exerciseId).name;
  const reasons = [
    isWorkday(date)
      ? `${name}: furthest behind today (${done[slot]} of ${targets[slot]}).`
      : `${name}: the least done today (${done[slot]} so far).`,
  ];
  if (exerciseId !== CHAIR_SQUAT && slot === "squats") reasons.push("Glute bridges instead of chair squats: knee pain above 3.");
  return { kind: "desk_break", exerciseId, reps, seconds: null, reasons };
}
