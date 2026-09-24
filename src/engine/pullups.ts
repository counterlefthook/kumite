import { daysBetween, localDate, weekStart, weekStartOfDate, type LocalDate } from "./calendar";
import { exerciseById } from "./library";
import { latestMax, sessionsInOrder, setsBySession } from "./progression";
import type { Equipment, History, Library, Prescription, Range } from "./types";

// Pull-up stages (PLAN, Engine rules, "Pull-up stages").
// Stage 1: band-assisted sets with the starting band, then negatives.
// Stage 2: the same with each lighter band in turn.
// Stage 3: strict sets at (max - 1), then a band-assisted back-off set.
// Stage 4: once a max test reaches 5. Reps first, then sets (decided 2026-09-24).

export const BAND_EX = "band_assisted_pullup";
export const STRICT_EX = "strict_pullup";
export const NEGATIVE_EX = "pullup_negative";
export const MILESTONES = [5, 8, 10];

export type PullupStage = 1 | 2 | 3 | 4;

export interface PullupState {
  stage: PullupStage;
  /** Current assistance band in Stages 1 and 2; the lightest band after that. */
  band: string | null;
  latestMax: number | null;
  lastMaxTestDate: LocalDate | null;
}

export function pullupState(equipment: Equipment, history: History, now: Date, zone: string): PullupState {
  const bands = equipment.bands;
  const lightest = bands.length ? bands.length - 1 : -1;
  const bySession = setsBySession(history);
  let bandIdx = bands.length ? 0 : -1;
  let stage: PullupStage = 1;
  let lastMaxTestDate: LocalDate | null = null;

  for (const session of sessionsInOrder(history, now)) {
    const sets = bySession.get(session.id) ?? [];
    if (session.kind === "calibration") {
      const calBand = sets.filter((s) => s.exerciseId === BAND_EX && s.band).at(-1)?.band;
      if (calBand && bands.includes(calBand)) bandIdx = bands.indexOf(calBand);
    }
    if ((session.kind === "calibration" || session.kind === "max_test") && sets.some((s) => s.exerciseId === STRICT_EX)) {
      lastMaxTestDate = localDate(session.startedAt, zone);
    }
    if (session.kind !== "strength" || stage > 2) continue;
    const bandSets = sets.filter((s) => s.exerciseId === BAND_EX);
    if (bandSets.length === 0 || !bandSets.every((s) => (s.reps ?? 0) >= 8)) continue;
    if (bandIdx >= lightest) stage = 3;
    else {
      bandIdx++;
      stage = 2;
    }
  }

  const max = latestMax(history, STRICT_EX, now);
  if (max !== null && max >= 5) stage = 4;
  const band = stage >= 3 ? (bands[lightest] ?? null) : (bands[bandIdx] ?? null);
  return { stage, band, latestMax: max, lastMaxTestDate };
}

export type MaxTestStatus = "not_due" | "offered" | "required";

/** Offered once 14 days have passed since the last test, required by day 21. */
export function maxTestStatus(lastMaxTestDate: LocalDate | null, today: LocalDate): MaxTestStatus {
  if (lastMaxTestDate === null) return "offered";
  const days = daysBetween(lastMaxTestDate, today);
  if (days >= 21) return "required";
  if (days >= 14) return "offered";
  return "not_due";
}

/** Milestones (5, 8, 10 strict reps) crossed by a new max. */
export function milestonesReached(previousMax: number | null, newMax: number): number[] {
  return MILESTONES.filter((m) => (previousMax ?? 0) < m && newMax >= m);
}

/**
 * Stage 4 targets. Start at 3 sets of (max - 2, minimum 1). Each program week
 * after the max test adds one rep to every set until reps reach max - 1, then
 * one set a week up to 5. A new max test starts over.
 */
export function stage4Target(max: number, weeksSinceTest: number): { sets: number; reps: number } {
  const start = Math.max(1, max - 2);
  const cap = Math.max(start, max - 1);
  const repWeeks = Math.min(weeksSinceTest, cap - start);
  return { reps: start + repWeeks, sets: Math.min(5, 3 + (weeksSinceTest - repWeeks)) };
}

function rx(lib: Library, id: string, sets: number, reps: Range, band: string | null): Prescription {
  const ex = exerciseById(lib, id);
  return {
    exerciseId: id,
    name: ex.name,
    cue: ex.cue,
    ladder: ex.ladder,
    group: ex.group,
    load: band ? { kind: "band", band } : { kind: "bodyweight" },
    reps,
    seconds: null,
    sets,
    targetRir: { min: 1, max: 2 },
  };
}

/**
 * The pull-up slot for today. `main` pairs with the Romanian deadlift; `extra`
 * (negatives in Stages 1 and 2, the back-off set in Stage 3) follows the pair.
 */
export function prescribePullups(
  lib: Library,
  state: PullupState,
  rounds: number,
  now: Date,
  zone: string,
): { main: Prescription; extra: Prescription | null } {
  if (state.stage <= 2) {
    return {
      main: rx(lib, BAND_EX, rounds, [5, 8], state.band),
      extra: rx(lib, NEGATIVE_EX, 1, [3, 3], null),
    };
  }
  const max = Math.max(1, state.latestMax ?? 1);
  if (state.stage === 3) {
    const reps = Math.max(1, max - 1);
    return {
      main: rx(lib, STRICT_EX, rounds, [reps, reps], null),
      extra: rx(lib, BAND_EX, 1, [8, 8], state.band),
    };
  }
  const weeks = state.lastMaxTestDate
    ? daysBetween(weekStartOfDate(state.lastMaxTestDate), weekStart(now, zone)) / 7
    : 0;
  const t = stage4Target(max, Math.max(0, weeks));
  return { main: rx(lib, STRICT_EX, t.sets, [t.reps, t.reps], null), extra: null };
}
