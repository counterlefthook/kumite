import { dayIndex, localDate, localMinutes } from "./calendar";
import { CHAIR_SQUAT, DESK_PUSHUP, PULLUP_SINGLE, deskDone, deskRanking, deskTargets, miniSetSize, type DeskSlot } from "./desk";
import { foughtOn, noGymPlan } from "./day";
import { exerciseById } from "./library";
import { latestMax } from "./progression";
import type { History, Library, Profile } from "./types";

// Reminders (docs/PLAN.md, Engine rules, "Nudge rules (v0.2)").
//
// pickNudge() is called by a scheduled server job roughly once an hour and
// answers one question: is a nudge due right now, and which one? It is pure:
// the current instant, the settings, the log, and the time of the last nudge
// are all passed in, so the same inputs always give the same answer and every
// rule can be tested against a fixed clock.

export type NudgeKind = "morning" | "desk" | "evening" | "recap";

export interface ClassPick {
  title: string;
  minutes: number;
  /** Peloton deep link. */
  url: string;
}

export interface Nudge {
  kind: NudgeKind;
  /** One sentence. */
  text: string;
  /** App path the notification opens. */
  action: string;
  /** Desk nudges: the exact set to log. */
  exerciseId?: string;
  reps?: number;
  /** Class nudges: the Peloton link. */
  url?: string;
}

export interface NudgeInput {
  now: Date;
  library: Library;
  profile: Profile;
  history: History;
  /** ISO instant of the most recent nudge sent on any channel, or null. */
  lastNudgeAt: string | null;
  /** The home-screen "Fight day" toggle. A logged fight session also counts. */
  fightDay?: boolean;
  /** Today's recommended class, when the caller has one. */
  classPick?: ClassPick | null;
}

/** A scheduled job can land a few minutes late; a nudge is due for this long after its minute. */
export const DUE_WINDOW_MIN = 15;
/** No desk nudge within this many minutes of any nudge. */
export const COOLDOWN_MIN = 45;
/** A desk set this recent means "ask for a different exercise than that one". */
export const JUST_LOGGED_MIN = 20;
/** A fight or strength session started this recently means "skip the desk nudge". */
export const JUST_TRAINED_MIN = 60;
/** Mini-set sizes before any max is logged (no calibration gate in v0.2). */
export const DEFAULT_MINI_SET: Record<DeskSlot, number> = { pushups: 15, squats: 20, pullups: 1 };

const MORNING_MIN = 7 * 60;
const DESK_FIRST_HOUR = 8;
const DESK_LAST_HOUR = 16;
const EVENING_MIN = 18 * 60 + 30;
const RECAP_MIN = 19 * 60;

function within(minutes: number, target: number): boolean {
  return minutes >= target && minutes < target + DUE_WINDOW_MIN;
}

function minutesAgo(instant: string, now: Date): number {
  return (now.getTime() - new Date(instant).getTime()) / 60_000;
}

/** Desk targets for the day, halved on a fight day; null on weekends. */
export function nudgeDeskTargets(profile: Profile, date: string, fightDay: boolean): Record<DeskSlot, number> | null {
  const targets = deskTargets(profile, date);
  if (!targets) return null;
  if (!fightDay) return targets;
  return { pushups: targets.pushups / 2, squats: targets.squats / 2, pullups: targets.pullups / 2 };
}

/** A profile whose desk targets are halved, so the ranking sees fight-day pace. */
function halved(profile: Profile): Profile {
  const t = profile.deskTargets;
  return {
    ...profile,
    deskTargets: { pushupsPerDay: t.pushupsPerDay / 2, chairSquatsPerHour: t.chairSquatsPerHour / 2, pullupSinglesPerDay: t.pullupSinglesPerDay / 2 },
  };
}

function exerciseFor(slot: DeskSlot): string {
  return slot === "pushups" ? DESK_PUSHUP : slot === "squats" ? CHAIR_SQUAT : PULLUP_SINGLE;
}

/** The mini-set: half the latest max, or the default before any max exists, never more than what is left today. */
export function deskReps(slot: DeskSlot, history: History, now: Date, remaining: number): number {
  if (slot === "pullups") return 1;
  const max = latestMax(history, exerciseFor(slot), now);
  const mini = max === null ? DEFAULT_MINI_SET[slot] : miniSetSize(max);
  return Math.max(1, Math.min(mini, Math.ceil(remaining)));
}

function deskNudge(input: NudgeInput, date: string, fightDay: boolean): Nudge | null {
  const { now, library: lib, history, lastNudgeAt } = input;
  const zone = input.profile.timezone;
  const profile = fightDay ? halved(input.profile) : input.profile;
  const targets = nudgeDeskTargets(input.profile, date, fightDay);
  if (!targets) return null;

  const done = deskDone(lib, history, date, zone);
  const remainingFor = (slot: DeskSlot) => targets[slot] - done[slot];
  if ((["pushups", "squats", "pullups"] as DeskSlot[]).every((s) => remainingFor(s) <= 0)) return null;

  const justTrained = history.sessions.some((s) => {
    const ago = minutesAgo(s.startedAt, now);
    return (s.kind === "fight" || s.kind === "strength") && ago >= 0 && ago < JUST_TRAINED_MIN;
  });
  if (justTrained) return null;

  if (lastNudgeAt !== null) {
    const ago = minutesAgo(lastNudgeAt, now);
    if (ago >= 0 && ago < COOLDOWN_MIN) return null;
  }

  const ranking = deskRanking(lib, profile, history, now).filter((s) => remainingFor(s) > 0);
  // An exercise logged in the last 20 minutes is not asked for again.
  const justLogged = new Set(
    history.deskSets
      .filter((d) => {
        const ago = minutesAgo(d.loggedAt, now);
        return ago >= 0 && ago < JUST_LOGGED_MIN;
      })
      .map((d) => d.exerciseId),
  );
  const fresh = ranking.filter((s) => !justLogged.has(exerciseFor(s)));
  const slot = fresh.length > 0 ? fresh[0] : ranking[0];

  const exerciseId = exerciseFor(slot);
  const reps = deskReps(slot, history, now, remainingFor(slot));
  const name = exerciseById(lib, exerciseId).name.toLowerCase();
  const text = slot === "pullups" ? `1 pull-up single.` : `${reps} ${name}.`;
  return { kind: "desk", text, action: `/do?ex=${exerciseId}&reps=${reps}`, exerciseId, reps };
}

function morningNudge(input: NudgeInput, fightDay: boolean): Nudge {
  const { history, profile, now, classPick } = input;
  if (fightDay) return { kind: "morning", text: "Fight day. Desk sets are halved.", action: "/" };
  const plan = noGymPlan(history, profile, now);
  if (plan.kind === "home_workout") {
    if (classPick) {
      return {
        kind: "morning",
        text: `Strength day: ${classPick.title}, ${classPick.minutes} min.`,
        action: "/",
        url: classPick.url,
      };
    }
    return { kind: "morning", text: `Strength day: a ${plan.timeBox} minute Peloton strength class, or the home workout.`, action: "/" };
  }
  if (plan.kind === "peloton") {
    return { kind: "morning", text: `Peloton day: ${plan.minutesLeft} minutes to go this week.`, action: "/" };
  }
  return { kind: "morning", text: "Rest day. Desk sets only.", action: "/" };
}

function eveningNudge(input: NudgeInput, date: string, fightDay: boolean): Nudge | null {
  const { history, profile, now, classPick } = input;
  if (fightDay) return null;
  const zone = profile.timezone;
  const strengthToday = history.sessions.some((s) => s.kind === "strength" && localDate(s.startedAt, zone) === date);
  if (strengthToday) return null;
  if (noGymPlan(history, profile, now).kind !== "home_workout") return null;
  if (classPick) {
    return { kind: "evening", text: `Still time for a 10 minute class: ${classPick.title}.`, action: "/", url: classPick.url };
  }
  return { kind: "evening", text: "Still time for a 10 minute class, or the 10 minute home workout.", action: "/" };
}

/** The one nudge due right now, or null. */
export function pickNudge(input: NudgeInput): Nudge | null {
  const { now, profile, history } = input;
  const zone = profile.timezone;
  const date = localDate(now, zone);
  const minutes = localMinutes(now, zone);
  const day = dayIndex(now, zone);
  const fightDay = Boolean(input.fightDay) || foughtOn(history, date, zone);

  if (day === 7 && within(minutes, RECAP_MIN)) return { kind: "recap", text: "Weekly recap.", action: "/" };
  if (within(minutes, EVENING_MIN)) return eveningNudge(input, date, fightDay);
  if (within(minutes, MORNING_MIN)) return morningNudge(input, fightDay);

  const hour = Math.floor(minutes / 60);
  if (day <= 5 && hour >= DESK_FIRST_HOUR && hour <= DESK_LAST_HOUR && within(minutes, hour * 60)) {
    return deskNudge(input, date, fightDay);
  }
  return null;
}
