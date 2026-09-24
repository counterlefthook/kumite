import { clockToMinutes, isWorkday, localDate, localMinutes } from "./calendar";
import { foughtOn } from "./day";
import { deskBreak, deskDone, deskTargets, DESK_ORDER } from "./desk";
import { exerciseById } from "./library";
import type { History, Library, Profile } from "./types";

// Desk nudges by push notification (PLAN, Engine rules, "Desk nudges").
// The hourly job asks this whether to send one; at most once an hour follows
// from the schedule.

export interface Nudge {
  title: string;
  body: string;
  url: string;
}

export interface NudgeInput {
  now: Date;
  library: Library;
  profile: Profile;
  history: History;
  /** The Desk / Gym / Out switch says gym today. */
  gymToday: boolean;
}

/**
 * A nudge only on a workday, inside work hours, not on a fight day, while some
 * desk goal is behind where it should be by now. It names the next move.
 */
export function deskNudge(input: NudgeInput): Nudge | null {
  const { now, library: lib, profile, history } = input;
  const zone = profile.timezone;
  const date = localDate(now, zone);
  if (!isWorkday(date)) return null;
  const minutes = localMinutes(now, zone);
  const start = clockToMinutes(profile.workStart);
  const end = clockToMinutes(profile.workEnd);
  if (minutes < start || minutes >= end) return null;
  if (input.gymToday || foughtOn(history, date, zone)) return null;

  const targets = deskTargets(profile, date);
  if (!targets) return null;
  const done = deskDone(lib, history, date, zone);
  const share = (minutes - start) / (end - start);
  const behind = DESK_ORDER.some((slot) => done[slot] < targets[slot] && done[slot] < targets[slot] * share);
  if (!behind) return null;

  const s = deskBreak(lib, profile, history, now, null);
  if (s.kind !== "desk_break") return null;
  const round = history.deskSets.filter((d) => localDate(d.loggedAt, zone) === date && new Date(d.loggedAt) <= now).length + 1;
  return {
    title: "KUMITE",
    body: `ROUND ${round}: ${s.reps ?? 1} x ${exerciseById(lib, s.exerciseId).name}. ${s.reasons[0] ?? ""}`.trim(),
    url: "/",
  };
}
