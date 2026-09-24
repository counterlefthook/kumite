import { exerciseAt, exerciseById, lastRung } from "./library";
import type { Equipment, History, Library, Load, Prescription, Range, SessionLog, SetLog } from "./types";

// Progression is never stored. Each ladder's current rung, load, range, and extra
// sets are rebuilt by replaying its logged sessions in order (PLAN, Engine rules,
// "Progression for dumbbell exercises").

// ---------- History helpers ----------

export function sessionsInOrder(history: History, now?: Date): SessionLog[] {
  return history.sessions
    .filter((s) => !now || new Date(s.startedAt) <= now)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime() || a.id.localeCompare(b.id));
}

export function setsBySession(history: History): Map<string, SetLog[]> {
  const map = new Map<string, SetLog[]>();
  for (const s of history.sets) {
    const list = map.get(s.sessionId) ?? [];
    list.push(s);
    map.set(s.sessionId, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.setIndex - b.setIndex);
  return map;
}

/**
 * The latest max for an exercise: the best reps in the most recent calibration
 * or max-test session that included it.
 */
export function latestMax(history: History, exerciseId: string, now?: Date): number | null {
  const bySession = setsBySession(history);
  const sessions = sessionsInOrder(history, now).filter((s) => s.kind === "calibration" || s.kind === "max_test");
  for (let i = sessions.length - 1; i >= 0; i--) {
    const reps = (bySession.get(sessions[i].id) ?? [])
      .filter((s) => s.exerciseId === exerciseId && s.reps !== null)
      .map((s) => s.reps as number);
    if (reps.length) return Math.max(...reps);
  }
  return null;
}

// ---------- Dumbbell settings ----------

export function sortedSettings(eq: Equipment): number[] {
  return [...new Set(eq.dumbbellSettingsLb)].sort((a, b) => a - b);
}

export function settingUp(settings: number[], load: number): number {
  return settings.find((s) => s > load) ?? load;
}

/** One setting down, never below the lowest. */
export function settingDown(settings: number[], load: number): number {
  const lower = settings.filter((s) => s < load);
  return lower.length ? lower[lower.length - 1] : settings[0];
}

/** Rounded down to a setting the user owns, never below the lowest. */
export function floorToSetting(settings: number[], target: number): number {
  const fits = settings.filter((s) => s <= target);
  return fits.length ? fits[fits.length - 1] : settings[0];
}

// ---------- Rep ranges ----------

const WIDEN: Record<string, Range> = {
  "8-12": [12, 15],
  "12-15": [15, 20],
  "10-15": [15, 20],
  "8-15": [15, 20],
};

/** The next wider rep range, or null once the range is 15 to 20. */
export function widen(range: Range): Range | null {
  return WIDEN[`${range[0]}-${range[1]}`] ?? null;
}

const HOLD_TOP_CAP = 90;

// ---------- Ladder state ----------

export interface LadderState {
  ladder: string;
  exerciseId: string;
  rung: number;
  loadLb: number | null;
  reps: Range | null;
  seconds: Range | null;
  /** Sets added on the last rung (each top at 15 to 20 adds one). */
  extraSets: number;
  /** Topped at 15 to 20 on the last rung at least once. */
  complete: boolean;
  /** The most recent session with this ladder had a set below the range. */
  missedLast: boolean;
}

function atRung(lib: Library, ladder: string, rung: number, loadLb: number | null): LadderState {
  const ex = exerciseAt(lib, ladder, rung);
  return {
    ladder,
    exerciseId: ex.id,
    rung,
    loadLb: ex.load === "dumbbell" ? loadLb : null,
    reps: ex.reps,
    seconds: ex.seconds,
    extraSets: 0,
    complete: false,
    missedLast: false,
  };
}

/** Apply one strength session's working sets for this ladder. */
export function step(lib: Library, settings: number[], state: LadderState, sets: SetLog[]): LadderState {
  if (sets.length === 0) return state;
  const done = exerciseById(lib, sets[0].exerciseId);
  const work = sets.filter((s) => s.exerciseId === done.id);
  let s = state;
  // Chris did a different rung than suggested: progress from what he did.
  if (done.id !== s.exerciseId) s = atRung(lib, s.ladder, done.rung, s.loadLb ?? settings[0] ?? null);
  const weights = work.map((x) => x.weightLb).filter((w): w is number => w !== null);
  const load = done.load === "dumbbell" ? (weights.length ? Math.max(...weights) : s.loadLb) : null;
  s = { ...s, loadLb: load };
  const last = lastRung(lib, s.ladder);

  // Knee flag on a squat-slot exercise: next time drop one rung, or one setting on rung 1.
  // Checked first, so this rung change wins over any load change from the same session.
  if (done.group === "squat" && work.some((x) => x.kneeFlag)) {
    if (s.rung > 1) return atRung(lib, s.ladder, s.rung - 1, load ?? settings[0] ?? null);
    return { ...s, loadLb: load === null ? null : settingDown(settings, load), missedLast: false };
  }

  if (done.load === "hold" && s.seconds) {
    const [lo, hi] = s.seconds;
    const topped = work.every((x) => (x.seconds ?? 0) >= hi);
    if (!topped) return s;
    if (s.rung < last) return atRung(lib, s.ladder, s.rung + 1, null);
    if (hi >= HOLD_TOP_CAP) return s;
    return { ...s, seconds: [lo + 10, Math.min(hi + 15, HOLD_TOP_CAP)] };
  }

  if (!s.reps) return s;
  const [bottom, top] = s.reps;
  const topped = work.every((x) => (x.reps ?? 0) >= top && x.rir !== null && x.rir >= 1);
  const missedNow = work.some((x) => (x.reps ?? 0) < bottom);

  if (topped) {
    const highest = settings[settings.length - 1];
    // Load first while the dumbbell has room, then wider reps, then the next rung.
    if (load !== null && highest !== undefined && load < highest) {
      return { ...s, loadLb: settingUp(settings, load), missedLast: false };
    }
    const wider = widen(s.reps);
    if (wider) return { ...s, reps: wider, missedLast: false };
    if (s.rung < last) {
      const next = exerciseAt(lib, s.ladder, s.rung + 1);
      const nextLoad = next.load === "dumbbell" ? floorToSetting(settings, (load ?? settings[0]) * 0.75) : null;
      return atRung(lib, s.ladder, s.rung + 1, nextLoad);
    }
    return { ...s, extraSets: s.extraSets + 1, complete: true, missedLast: false };
  }

  if (missedNow && s.missedLast) {
    return { ...s, loadLb: load === null ? null : settingDown(settings, load), missedLast: true };
  }
  return { ...s, missedLast: missedNow };
}

/**
 * Current state of a ladder, replayed from calibration and every strength
 * session that included it. Calibration sets the starting load; with no
 * calibration the ladder starts at the lowest setting.
 */
export function ladderState(
  lib: Library,
  equipment: Equipment,
  history: History,
  ladder: string,
  now?: Date,
): LadderState {
  const settings = sortedSettings(equipment);
  let state = atRung(lib, ladder, 1, settings[0] ?? null);
  const bySession = setsBySession(history);
  for (const session of sessionsInOrder(history, now)) {
    if (session.kind !== "strength" && session.kind !== "calibration") continue;
    const sets = (bySession.get(session.id) ?? []).filter((x) => exerciseById(lib, x.exerciseId).ladder === ladder);
    if (sets.length === 0) continue;
    if (session.kind === "calibration") {
      const w = sets[sets.length - 1].weightLb;
      if (w !== null && state.loadLb !== null) state = { ...state, loadLb: w };
      continue;
    }
    state = step(lib, settings, state, sets);
  }
  return state;
}

/** Working sets for the ladder: the week's rounds, plus any added sets, at most 4. */
export function setsFor(state: LadderState, rounds: number): number {
  return state.extraSets > 0 ? Math.min(4, rounds + state.extraSets) : rounds;
}

export function prescribe(lib: Library, state: LadderState, rounds: number): Prescription {
  const ex = exerciseById(lib, state.exerciseId);
  const load: Load =
    ex.load === "dumbbell" && state.loadLb !== null
      ? { kind: "dumbbell", lb: state.loadLb }
      : ex.load === "hold"
        ? { kind: "hold" }
        : { kind: "bodyweight" };
  return {
    exerciseId: ex.id,
    name: ex.name,
    cue: ex.cue,
    ladder: ex.ladder,
    group: ex.group,
    load,
    reps: state.reps,
    seconds: state.seconds,
    sets: setsFor(state, rounds),
    targetRir: { min: 1, max: 2 },
  };
}
