// Shapes of everything the engine takes in and hands back.
//
// The engine never reads the clock, the database, or the network. Callers pass
// in the current instant, the settings, and the log history. Log rows are the
// "current" rows only (from the *_current views), so superseded and voided rows
// never reach the engine.

export type TargetGroup = "push" | "pull" | "squat" | "hinge";
export type Group = TargetGroup | "core" | "arms" | "mixed";
export type TemplateId = "A" | "B";
export type TimeBox = 10 | 20 | 30 | "desk";

// ---------- Exercise library (docs/exercise-library.json) ----------

export type LoadKind = "dumbbell" | "bodyweight" | "band_assist" | "hold";
export type Progression = "pullup_stages" | "none" | "double_progression" | "holds" | "mini_sets";
export type Range = readonly [number, number];

export interface Exercise {
  id: string;
  name: string;
  ladder: string;
  rung: number;
  group: Group;
  load: LoadKind;
  dumbbells: number;
  equipment: string[];
  context: ("session" | "desk")[];
  unilateral: boolean;
  reps: Range | null;
  seconds: Range | null;
  knee: "low" | "moderate" | "high";
  cue: string;
  /** Desk moves only: the daily goal the reps count toward. */
  desk_slot?: "push" | "legs" | "pull";
  /** Desk moves only: mini-set size relative to the slot's base move. */
  desk_factor?: number;
}

export interface Ladder {
  group: Group;
  progression: Progression;
}

export interface Template {
  pairs: [[string, string], [string, string]];
  finisher: string;
  optional_finisher: [string, string];
}

export interface Library {
  templates: Record<TemplateId, Template>;
  knee_swaps: { A: Record<string, string>; B: Record<string, string>; desk: Record<string, string> };
  ladders: Record<string, Ladder>;
  exercises: Exercise[];
}

// ---------- Settings ----------

export interface DeskTargets {
  pushupsPerDay: number;
  chairSquatsPerHour: number;
  pullupSinglesPerDay: number;
}

export interface Profile {
  /** Local calendar date, YYYY-MM-DD. */
  programStartDate: string;
  /** Local clock time, HH:MM. */
  workStart: string;
  workEnd: string;
  deskTargets: DeskTargets;
  /** Weekly Peloton target in minutes (rides or classes). */
  pelotonMinutesWeek: number;
  /** Home workouts (strength sessions) a week. */
  homeWorkoutsWeek: number;
  timezone: string;
}

export interface Equipment {
  /** Pounds per dumbbell, any order (the engine sorts). */
  dumbbellSettingsLb: number[];
  /** Heaviest to lightest. */
  bands: string[];
}

// ---------- Logs ----------

export interface CheckIn {
  sorenessLegs: number;
  sorenessUpper: number;
  energy: number;
  kneePain: number;
  fightNext24h: boolean;
}

export type SessionKind = "strength" | "fight" | "ride" | "mobility" | "calibration" | "max_test";

export interface SessionLog {
  id: string;
  kind: SessionKind;
  template: TemplateId | null;
  /** ISO instant. */
  startedAt: string;
  minutes: number | null;
  checkIn: CheckIn | null;
  effort: number | null;
  override: boolean;
}

export interface SetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  setIndex: number;
  /** Per dumbbell. */
  weightLb: number | null;
  band: string | null;
  reps: number | null;
  seconds: number | null;
  /** 0 to 4, where 4 means 4 or more. */
  rir: number | null;
  kneeFlag: boolean;
}

export interface DeskSetLog {
  id: string;
  exerciseId: string;
  reps: number | null;
  seconds: number | null;
  /** ISO instant. */
  loggedAt: string;
}

export interface BodyMetric {
  kind: "weight_lb" | "waist_in";
  value: number;
  /** ISO instant. */
  measuredAt: string;
}

export interface History {
  sessions: SessionLog[];
  sets: SetLog[];
  deskSets: DeskSetLog[];
}

// ---------- Output ----------

export type Load =
  | { kind: "dumbbell"; lb: number }
  | { kind: "band"; band: string }
  | { kind: "bodyweight" }
  | { kind: "hold" };

/** Reps in reserve to aim for. `max: null` means "or more". */
export interface RirTarget {
  min: number;
  max: number | null;
}

export interface Prescription {
  exerciseId: string;
  name: string;
  cue: string;
  ladder: string;
  group: Group;
  load: Load;
  reps: Range | null;
  seconds: Range | null;
  sets: number;
  targetRir: RirTarget;
}

export interface Block {
  kind: "pair" | "emom" | "finisher" | "optional_finisher" | "pullup_extra";
  exercises: Prescription[];
  /** Seconds of rest after each round of the block, or null for EMOM. */
  restAfterSec: number | null;
  /** EMOM only: total minutes. */
  minutes?: number;
}

export type Suggestion =
  | {
      kind: "strength";
      template: TemplateId;
      timeBox: 10 | 20 | 30;
      programWeek: number;
      rounds: number;
      blocks: Block[];
      override: boolean;
      /** Pull-up max test: offered after 14 days, required by day 21. */
      maxTest: "not_due" | "offered" | "required";
      reasons: string[];
    }
  | { kind: "recovery"; options: ("ride_zone2_30" | "mobility_15")[]; reasons: string[] }
  | {
      kind: "rest_day";
      options: ("ride" | "mobility" | "desk_sets")[];
      canTrainAnyway: true;
      reasons: string[];
    }
  | { kind: "desk_break"; exerciseId: string; reps: number | null; seconds: number | null; reasons: string[] };
