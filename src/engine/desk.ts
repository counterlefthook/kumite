import { clockToMinutes, isWorkday, localDate, localMinutes, type LocalDate } from "./calendar";
import { latestMax } from "./progression";
import type { Exercise, History, Library, Profile, Suggestion } from "./types";

// Desk sets (PLAN, Engine rules, "Desk sets"). Desk sets never count as hard sets.
// Three daily goals (push, legs, pull); every desk move counts toward one of
// them through its desk_slot, and the moves rotate (decided 2026-09-25).

export const DESK_PUSHUP = "desk_pushup";
export const CHAIR_SQUAT = "chair_squat";
export const PULLUP_SINGLE = "pullup_single";

export type DeskSlot = "pushups" | "squats" | "pullups";
/** Tie-break order for the desk break. */
export const DESK_ORDER: DeskSlot[] = ["pushups", "squats", "pullups"];

const SLOT_OF = { push: "pushups", legs: "squats", pull: "pullups" } as const;
/** The move whose max sizes each goal's mini-sets. */
const BASE_MOVE: Record<DeskSlot, string> = { pushups: DESK_PUSHUP, squats: CHAIR_SQUAT, pullups: PULLUP_SINGLE };

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

/** The goal a desk move counts toward, or null for moves outside the rotation (wall sits). */
export function slotOf(ex: Exercise): DeskSlot | null {
  return ex.desk_slot ? SLOT_OF[ex.desk_slot] : null;
}

/** Desk moves that count toward a goal, in library order. */
export function deskMoves(lib: Library, slot: DeskSlot): Exercise[] {
  return lib.exercises.filter((e) => slotOf(e) === slot).sort((a, b) => a.rung - b.rung);
}

/** Reps done today per goal; every move counts toward its own goal. */
export function deskDone(lib: Library, history: History, date: LocalDate, zone: string): Record<DeskSlot, number> {
  const done: Record<DeskSlot, number> = { pushups: 0, squats: 0, pullups: 0 };
  const slots = new Map(lib.exercises.map((e) => [e.id, slotOf(e)]));
  for (const d of history.deskSets) {
    if (localDate(d.loggedAt, zone) !== date) continue;
    const slot = slots.get(d.exerciseId);
    if (slot) done[slot] += d.reps ?? 0;
  }
  return done;
}

export function deskTargetsMet(lib: Library, profile: Profile, history: History, date: LocalDate): boolean {
  const targets = deskTargets(profile, date);
  if (!targets) return false;
  const done = deskDone(lib, history, date, profile.timezone);
  return DESK_ORDER.every((slot) => done[slot] >= targets[slot]);
}

/** A small, stable hash, so the day's shuffle is the same on every call. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The move to do next for a goal: the one done least recently today, never the
 * move just done if there is another choice. Moves not yet done today come
 * first, in an order shuffled by the date. Knee pain above 3 keeps the legs
 * goal to glute bridges.
 */
export function pickMove(lib: Library, history: History, slot: DeskSlot, now: Date, zone: string, kneePain: number | null): Exercise {
  const date = localDate(now, zone);
  let moves = deskMoves(lib, slot);
  if (slot === "squats" && kneePain !== null && kneePain > 3) {
    const swap = lib.knee_swaps.desk[CHAIR_SQUAT];
    moves = moves.filter((m) => m.id === swap);
  }
  const today = history.deskSets
    .filter((d) => localDate(d.loggedAt, zone) === date && new Date(d.loggedAt) <= now)
    .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());
  const lastTime = new Map<string, number>();
  for (const d of today) lastTime.set(d.exerciseId, new Date(d.loggedAt).getTime());
  const justDone = today.at(-1)?.exerciseId;

  const ranked = [...moves].sort((a, b) => {
    const ta = lastTime.get(a.id) ?? -1;
    const tb = lastTime.get(b.id) ?? -1;
    if (ta !== tb) return ta - tb;
    return hash(`${date}:${a.id}`) - hash(`${date}:${b.id}`);
  });
  return ranked.find((m) => m.id !== justDone) ?? ranked[0];
}

/** Mini-set size for a move: its goal's base mini-set times the move's factor. Pull-up singles are 1. */
export function moveReps(history: History, ex: Exercise, now: Date): number {
  const slot = slotOf(ex);
  if (!slot || slot === "pullups") return 1;
  const base = miniSetSize(latestMax(history, BASE_MOVE[slot], now));
  return Math.max(1, Math.floor(base * (ex.desk_factor ?? 1)));
}

const GOAL_NAMES: Record<DeskSlot, string> = { pushups: "Push", squats: "Legs", pullups: "Pull-ups" };

/**
 * The desk break: the goal furthest behind where it should be by now, as a
 * share of its daily target (before work starts and on weekends, the one with
 * the smallest share done), then the next move in that goal's rotation.
 */
export function deskBreak(lib: Library, profile: Profile, history: History, now: Date, kneePain: number | null): Suggestion {
  const zone = profile.timezone;
  const date = localDate(now, zone);
  const targets = weekdayTargets(profile);
  const done = deskDone(lib, history, date, zone);
  const start = clockToMinutes(profile.workStart);
  const end = clockToMinutes(profile.workEnd);
  const share = isWorkday(date) ? Math.min(1, Math.max(0, (localMinutes(now, zone) - start) / (end - start))) : 0;

  const score = (slot: DeskSlot) => (targets[slot] * share - done[slot]) / targets[slot];
  const slot = DESK_ORDER.reduce((best, s) => (score(s) > score(best) + 1e-9 ? s : best));
  const ex = pickMove(lib, history, slot, now, zone, kneePain);

  const reasons = [
    isWorkday(date)
      ? `${GOAL_NAMES[slot]} is furthest behind today (${done[slot]} of ${targets[slot]}).`
      : `${GOAL_NAMES[slot]}: the least done today (${done[slot]} so far).`,
  ];
  if (slot === "squats" && kneePain !== null && kneePain > 3) reasons.push("Glute bridges only: knee pain above 3.");
  return { kind: "desk_break", exerciseId: ex.id, reps: moveReps(history, ex, now), seconds: null, reasons };
}
