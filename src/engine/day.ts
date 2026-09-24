import { localDate, weekStart } from "./calendar";
import { deskBreak, deskDone, deskTargets, DESK_ORDER, type DeskSlot } from "./desk";
import { squeezeFor, strengthSessionsThisWeek, strengthYesterday } from "./guardrails";
import type { History, Library, Profile, Suggestion } from "./types";

// Planning the day (PLAN, Engine rules, "Planning the day"). Version 0.1 has no
// check-in: the home screen shows goals, and two questions do the rest.

export interface DeskBar {
  slot: DeskSlot;
  done: number;
  /** Null on weekends, which show totals without targets. */
  target: number | null;
}

export type NoGymPlan =
  | { kind: "home_workout"; timeBox: 20 | 30; reason: string }
  | { kind: "peloton"; minutesLeft: number; reason: string }
  | { kind: "rest"; reason: string };

export interface DayPlan {
  date: string;
  fightDay: boolean;
  /** Desk goals do not count against the nudge or the streak on a fight day. */
  deskExcused: boolean;
  desk: DeskBar[];
  /** Every desk goal met today. */
  flawless: boolean;
  pelotonMinutes: number;
  pelotonTarget: number;
  homeWorkouts: number;
  homeTarget: number;
  nudge: string | null;
  noGym: NoGymPlan;
  deskNow: Suggestion;
}

export interface DayInput {
  now: Date;
  library: Library;
  profile: Profile;
  history: History;
  /** "Gym today?" answered yes (the kickboxing or MMA gym). */
  gymToday: boolean;
}

/** Peloton minutes this week: every `ride` session, rides and classes alike. */
export function pelotonMinutesThisWeek(history: History, now: Date, zone: string): number {
  const week = weekStart(now, zone);
  return history.sessions
    .filter((s) => s.kind === "ride" && new Date(s.startedAt) <= now && weekStart(s.startedAt, zone) === week)
    .reduce((sum, s) => sum + (s.minutes ?? 0), 0);
}

/** A fight session logged on this local date. */
export function foughtOn(history: History, date: string, zone: string): boolean {
  return history.sessions.some((s) => s.kind === "fight" && localDate(s.startedAt, zone) === date);
}

/**
 * No gym today: whichever is further behind this week as a share of its target,
 * home workouts or Peloton minutes (a tie goes to the home workout). A home
 * workout is not offered the day after one unless the week is short.
 */
export function noGymPlan(history: History, profile: Profile, now: Date): NoGymPlan {
  const zone = profile.timezone;
  const home = strengthSessionsThisWeek(history, now, zone);
  const minutes = pelotonMinutesThisWeek(history, now, zone);
  const homeShare = profile.homeWorkoutsWeek > 0 ? home / profile.homeWorkoutsWeek : 1;
  const pelotonShare = profile.pelotonMinutesWeek > 0 ? minutes / profile.pelotonMinutesWeek : 1;
  const minutesLeft = Math.max(0, profile.pelotonMinutesWeek - minutes);
  const peloton: NoGymPlan = {
    kind: "peloton",
    minutesLeft,
    reason: `${minutesLeft} minutes on the Peloton to go this week.`,
  };
  const rest: NoGymPlan = { kind: "rest", reason: "This week's workouts and Peloton minutes are done. Rest, or do some desk sets." };

  const homeShort = homeShare < 1;
  const pelotonShort = pelotonShare < 1;
  if (!homeShort && !pelotonShort) return rest;
  const wantsHome = homeShort && (!pelotonShort || homeShare <= pelotonShare);
  if (!wantsHome) return peloton;

  const next = home + 1;
  if (strengthYesterday(history, now, zone)) {
    const squeeze = squeezeFor(history, now, zone);
    if (squeeze.active) {
      return {
        kind: "home_workout",
        timeBox: 20,
        reason: `Home workout ${next} of ${profile.homeWorkoutsWeek}, back to back in 20 minutes: the week is running short.`,
      };
    }
    return pelotonShort
      ? { ...peloton, reason: `Home workout yesterday, so a Peloton day. ${peloton.reason}` }
      : { kind: "rest", reason: "Home workout yesterday, so rest today, or do some desk sets." };
  }
  return { kind: "home_workout", timeBox: 30, reason: `Home workout ${next} of ${profile.homeWorkoutsWeek} this week.` };
}

export function planDay(input: DayInput): DayPlan {
  const { now, library: lib, profile, history } = input;
  const zone = profile.timezone;
  const date = localDate(now, zone);
  const fightDay = input.gymToday || foughtOn(history, date, zone);

  const targets = deskTargets(profile, date);
  const done = deskDone(lib, history, date, zone);
  const desk: DeskBar[] = DESK_ORDER.map((slot) => ({ slot, done: done[slot], target: targets ? targets[slot] : null }));
  const flawless = targets !== null && DESK_ORDER.every((slot) => done[slot] >= targets[slot]);

  const pelotonMinutes = pelotonMinutesThisWeek(history, now, zone);
  const minutesLeft = Math.max(0, profile.pelotonMinutesWeek - pelotonMinutes);
  const deskToday = DESK_ORDER.some((slot) => done[slot] > 0);
  const nudge =
    minutesLeft > 0
      ? `${deskToday ? "You've done some desk sets, but you" : "You"} still need ${minutesLeft} minutes on the Peloton this week: a class or a ride.`
      : null;

  return {
    date,
    fightDay,
    deskExcused: fightDay,
    desk,
    flawless,
    pelotonMinutes,
    pelotonTarget: profile.pelotonMinutesWeek,
    homeWorkouts: strengthSessionsThisWeek(history, now, zone),
    homeTarget: profile.homeWorkoutsWeek,
    nudge,
    noGym: noGymPlan(history, profile, now),
    deskNow: deskBreak(lib, profile, history, now, null),
  };
}
