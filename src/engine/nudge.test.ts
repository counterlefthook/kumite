import { describe, expect, it } from "vitest";
import { deskReps, nudgeDeskTargets, pickNudge, type NudgeInput } from "./nudge";
import { at, LIB, makeHistory, PROFILE, type DeskSpec, type SessionSpec } from "./test-helpers";
import type { Profile } from "./types";

// Desk hours 8:00 to 16:00 (v0.2). Week of Monday 2026-10-05: 3 home
// workouts and 60 Peloton minutes are the weekly targets.
const P: Profile = { ...PROFILE, workStart: "08:00", workEnd: "16:00" };
// Targets on a weekday: 100 push-ups, 25 an hour × 8 hours = 200 squats, 5 pull-up singles.

const MON = "2026-10-05";
const TUE = "2026-10-06";
const SUN = "2026-10-11";

const strength = (date: string, time = "07:00"): SessionSpec => ({ date, template: "A", time });
const fight = (date: string, time = "18:00"): SessionSpec => ({ kind: "fight", date, time, minutes: 60 });
const ride = (date: string, minutes: number): SessionSpec => ({ kind: "ride", date, minutes, time: "19:00" });
const pushups = (date: string, reps: number, time: string): DeskSpec => ({ ex: "desk_pushup", reps, date, time });
const squats = (date: string, reps: number, time: string): DeskSpec => ({ ex: "chair_squat", reps, date, time });
const singles = (date: string, reps: number, time: string): DeskSpec => ({ ex: "pullup_single", reps, date, time });

function nudge(date: string, time: string, sessions: SessionSpec[] = [], desk: DeskSpec[] = [], extra: Partial<NudgeInput> = {}) {
  return pickNudge({
    now: at(date, time),
    library: LIB,
    profile: P,
    history: makeHistory(sessions, desk),
    lastNudgeAt: null,
    ...extra,
  });
}

const PICK = { title: "20 min Upper Body Strength", minutes: 20, url: "https://members.onepeloton.com/classes/strength?modal=classDetailsModal&classId=abc" };

describe("when a nudge is due", () => {
  it.each<[string, string, string, string | null]>([
    ["7:00 on a weekday: morning plan", MON, "07:00", "morning"],
    ["7:10 still counts as 7:00 (the job can run late)", MON, "07:10", "morning"],
    ["7:20 is too late for the morning plan", MON, "07:20", null],
    ["8:00: first desk nudge", MON, "08:00", "desk"],
    ["12:03: a desk nudge", MON, "12:03", "desk"],
    ["16:00: last desk nudge", MON, "16:00", "desk"],
    ["17:00: past desk hours", MON, "17:00", null],
    ["12:30: between nudges", MON, "12:30", null],
    ["Saturday 10:00: no desk nudges on weekends", "2026-10-10", "10:00", null],
    ["Saturday 7:00: the morning plan still runs", "2026-10-10", "07:00", "morning"],
    ["Sunday 19:00: the recap", SUN, "19:00", "recap"],
    ["Monday 19:00: no recap", MON, "19:00", null],
    ["2:00: the middle of the night", MON, "02:00", null],
  ])("%s", (_name, date, time, kind) => expect(nudge(date, time)?.kind ?? null).toBe(kind));

  it("18:30 on a strength day with nothing logged: evening catch-up", () => {
    expect(nudge(MON, "18:30")?.kind).toBe("evening");
  });
});

describe("the desk nudge", () => {
  it("at 8:00 with nothing done, asks for push-ups first (tie goes push-ups, squats, pull-ups)", () => {
    expect(nudge(MON, "08:00")).toMatchObject({ kind: "desk", exerciseId: "desk_pushup", reps: 15, text: "15 push-up." });
  });

  it("opens the DONE screen for that exact set", () => {
    expect(nudge(MON, "08:00")?.action).toBe("/do?ex=desk_pushup&reps=15");
  });

  it("picks whichever is furthest behind pace", () => {
    // By noon half the day is gone: 50 push-ups and 100 squats are due. Push-ups are done; squats are 100 short.
    expect(nudge(MON, "12:00", [], [pushups(MON, 60, "09:00")])).toMatchObject({ exerciseId: "chair_squat", reps: 20 });
  });

  it("asks for a pull-up single as a single", () => {
    expect(nudge(MON, "12:00", [], [pushups(MON, 60, "09:00"), squats(MON, 120, "09:30")])).toMatchObject({
      exerciseId: "pullup_single",
      reps: 1,
      text: "1 pull-up single.",
    });
  });

  it("sizes the mini-set from the latest max once one is logged", () => {
    const sessions: SessionSpec[] = [{ kind: "max_test", date: "2026-10-02", time: "07:00", sets: { desk_pushup: [{ reps: 34 }] } }];
    expect(nudge(MON, "08:00", sessions)).toMatchObject({ exerciseId: "desk_pushup", reps: 17 });
  });

  it("never asks for more than is left today", () => {
    expect(nudge(MON, "15:00", [], [pushups(MON, 92, "09:00"), squats(MON, 200, "09:30"), singles(MON, 5, "10:00")])).toMatchObject({
      exerciseId: "desk_pushup",
      reps: 8,
    });
  });

  it("is skipped once every desk target is met", () => {
    expect(nudge(MON, "14:00", [], [pushups(MON, 100, "09:00"), squats(MON, 200, "09:30"), singles(MON, 5, "10:00")])).toBeNull();
  });

  it("is skipped within 60 minutes of a fight or strength session starting", () => {
    expect(nudge(MON, "09:00", [strength(MON, "08:20")])).toBeNull();
    expect(nudge(MON, "09:00", [fight(MON, "08:20")])).toBeNull();
  });

  it("is not skipped once the session is more than 60 minutes old", () => {
    expect(nudge(MON, "10:00", [strength(MON, "08:20")])?.kind).toBe("desk");
  });

  it("is skipped within 45 minutes of the last nudge", () => {
    expect(nudge(MON, "09:00", [], [], { lastNudgeAt: at(MON, "08:30").toISOString() })).toBeNull();
    expect(nudge(MON, "09:00", [], [], { lastNudgeAt: at(MON, "08:00").toISOString() })?.kind).toBe("desk");
  });

  // By noon: squats on pace (100 of 200), pull-ups ahead (3 of 5), push-ups 10 behind (40 of 100), so push-ups lead.
  const NOON = [squats(MON, 100, "09:00"), singles(MON, 3, "09:30")];

  it("does not ask for the exercise logged in the last 20 minutes", () => {
    expect(nudge(MON, "12:00", [], [...NOON, pushups(MON, 40, "11:50")])).toMatchObject({ exerciseId: "chair_squat" });
  });

  it("keeps the first pick when that set is more than 20 minutes old", () => {
    expect(nudge(MON, "12:00", [], [...NOON, pushups(MON, 40, "11:30")])).toMatchObject({ exerciseId: "desk_pushup" });
  });

  it("keeps the first pick when a different exercise was just logged", () => {
    expect(nudge(MON, "12:00", [], [...NOON, pushups(MON, 40, "09:15"), singles(MON, 1, "11:55")])).toMatchObject({
      exerciseId: "desk_pushup",
    });
  });

  it("halves the targets on a fight day, from the toggle or a logged fight", () => {
    expect(nudgeDeskTargets(P, MON, true)).toEqual({ pushups: 50, squats: 100, pullups: 2.5 });
    const done = [pushups(MON, 50, "09:00"), squats(MON, 100, "09:30"), singles(MON, 3, "10:00")];
    expect(nudge(MON, "14:00", [], done, { fightDay: true })).toBeNull();
    expect(nudge(MON, "14:00", [fight(MON, "06:00")], done)).toBeNull();
    expect(nudge(MON, "14:00", [], done)?.kind).toBe("desk");
  });

  it("has no targets on a weekend", () => {
    expect(nudgeDeskTargets(P, "2026-10-10", false)).toBeNull();
  });
});

describe("the morning plan", () => {
  it("names the class pick on a strength day", () => {
    expect(nudge(MON, "07:00", [], [], { classPick: PICK })).toMatchObject({
      kind: "morning",
      text: "Strength day: 20 min Upper Body Strength, 20 min.",
      url: PICK.url,
    });
  });

  it("falls back to a generic strength line without a pick", () => {
    expect(nudge(MON, "07:00")?.text).toBe("Strength day: a 30 minute Peloton strength class, or the home workout.");
  });

  it("says fight day when the toggle is on or a fight is logged", () => {
    expect(nudge(MON, "07:00", [], [], { fightDay: true })?.text).toBe("Fight day. Desk sets are halved.");
    expect(nudge(MON, "07:00", [fight(MON, "06:30")])?.text).toBe("Fight day. Desk sets are halved.");
  });

  it("says Peloton day when strength was yesterday and minutes are short", () => {
    expect(nudge(TUE, "07:00", [strength(MON)])?.text).toBe("Peloton day: 60 minutes to go this week.");
  });

  it("says rest day when the week's quota is done", () => {
    const done = [strength(MON), strength("2026-10-07"), strength("2026-10-09"), ride(TUE, 60)];
    expect(nudge("2026-10-10", "07:00", done)?.text).toBe("Rest day. Desk sets only.");
  });
});

describe("the evening catch-up", () => {
  it("fires on a strength day with no strength session logged, naming the pick", () => {
    expect(nudge(MON, "18:30", [], [], { classPick: { ...PICK, title: "10 min Core", minutes: 10 } })).toMatchObject({
      kind: "evening",
      text: "Still time for a 10 minute class: 10 min Core.",
    });
  });

  it("does not fire once a strength session is logged today", () => {
    expect(nudge(MON, "18:30", [strength(MON, "12:00")])).toBeNull();
  });

  it("does not fire on a fight day", () => {
    expect(nudge(MON, "18:30", [fight(MON, "17:00")])).toBeNull();
    expect(nudge(MON, "18:30", [], [], { fightDay: true })).toBeNull();
  });

  it("does not fire the day after a strength session (a Peloton or rest day)", () => {
    expect(nudge(TUE, "18:30", [strength(MON)])).toBeNull();
  });
});

describe("deskReps", () => {
  it.each<[string, number, number]>([
    ["default push-ups before any max", 100, 15],
    ["capped by what is left", 4, 4],
    ["never below 1", 0.2, 1],
  ])("%s", (_name, remaining, expected) => expect(deskReps("pushups", makeHistory([]), at(MON, "10:00"), remaining)).toBe(expected));
});
