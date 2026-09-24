import { describe, expect, it } from "vitest";
import { noGymPlan, pelotonMinutesThisWeek, planDay } from "./day";
import { slotOf } from "./desk";
import { exerciseById } from "./library";
import { at, LIB, makeHistory, PROFILE, ZONE, type DeskSpec, type SessionSpec } from "./test-helpers";

// Week of Monday 2026-10-05. Targets: 3 home workouts, 60 Peloton minutes.
const home = (date: string, template: "A" | "B" = "A"): SessionSpec => ({ date, template, time: "07:00" });
const ride = (date: string, minutes: number): SessionSpec => ({ kind: "ride", date, minutes, time: "19:00" });
const plan = (sessions: SessionSpec[], date: string) => noGymPlan(makeHistory(sessions), PROFILE, at(date, "08:00"));

describe("no gym today: whichever is further behind", () => {
  it.each<[string, SessionSpec[], string, object]>([
    ["Monday with nothing done: tied, so a home workout", [], "2026-10-05", { kind: "home_workout", timeBox: 30 }],
    [
      "1 of 3 home workouts vs 40 of 60 minutes: home workout",
      [home("2026-10-05"), ride("2026-10-06", 40)],
      "2026-10-08",
      { kind: "home_workout", timeBox: 30, reason: "Home workout 2 of 3 this week." },
    ],
    [
      "2 of 3 home workouts vs 20 of 60 minutes: Peloton, 40 to go",
      [home("2026-10-05"), home("2026-10-07", "B"), ride("2026-10-06", 20)],
      "2026-10-09",
      { kind: "peloton", minutesLeft: 40 },
    ],
    [
      "home workouts done, 30 minutes short: Peloton",
      [home("2026-10-05"), home("2026-10-07", "B"), home("2026-10-09"), ride("2026-10-06", 30)],
      "2026-10-11",
      { kind: "peloton", minutesLeft: 30 },
    ],
    [
      "both done: rest",
      [home("2026-10-05"), home("2026-10-07", "B"), home("2026-10-09"), ride("2026-10-06", 60)],
      "2026-10-11",
      { kind: "rest" },
    ],
    [
      "home workout further behind, but one yesterday: a Peloton day instead",
      [home("2026-10-05"), ride("2026-10-05", 40)],
      "2026-10-06",
      { kind: "peloton", minutesLeft: 20, reason: "Home workout yesterday, so a Peloton day. 20 minutes on the Peloton to go this week." },
    ],
    [
      "home workout yesterday and Peloton done: rest",
      [home("2026-10-05"), ride("2026-10-05", 60)],
      "2026-10-06",
      { kind: "rest" },
    ],
    [
      "home workout Friday, only 1 done, Saturday: back to back in 20 minutes",
      [home("2026-10-09"), ride("2026-10-08", 50)],
      "2026-10-10",
      { kind: "home_workout", timeBox: 20 },
    ],
  ])("%s", (_name, sessions, date, expected) => expect(plan(sessions, date)).toMatchObject(expected));

  it("Peloton minutes count every ride session this week, not last week's", () => {
    const history = makeHistory([ride("2026-10-04", 45), ride("2026-10-05", 20), ride("2026-10-07", 25)]);
    expect(pelotonMinutesThisWeek(history, at("2026-10-08"), ZONE)).toBe(45);
  });
});

describe("the home screen", () => {
  const desk = (date: string, pushups: number, squats: number, pullups: number): DeskSpec[] => [
    { ex: "desk_pushup", reps: pushups, date },
    { ex: "chair_squat", reps: squats, date },
    { ex: "pullup_single", reps: pullups, date },
  ];
  const day = (sessions: SessionSpec[], deskSets: DeskSpec[], date: string, gymToday = false) =>
    planDay({ now: at(date, "13:00"), library: LIB, profile: PROFILE, history: makeHistory(sessions, deskSets), gymToday });

  it("shows desk bars against today's goals, and the week's totals", () => {
    const d = day([home("2026-10-05"), ride("2026-10-06", 20)], desk("2026-10-07", 50, 40, 2), "2026-10-07");
    expect(d.desk).toEqual([
      { slot: "pushups", done: 50, target: 100 },
      { slot: "squats", done: 40, target: 200 },
      { slot: "pullups", done: 2, target: 5 },
    ]);
    expect(d).toMatchObject({ pelotonMinutes: 20, pelotonTarget: 60, homeWorkouts: 1, homeTarget: 3, flawless: false, fightDay: false });
    expect(d.deskNow.kind).toBe("desk_break");
    if (d.deskNow.kind === "desk_break") expect(slotOf(exerciseById(LIB, d.deskNow.exerciseId))).toBe("squats");
  });

  it.each([
    ["with desk sets today", desk("2026-10-07", 10, 0, 0), "You've done some desk sets, but you still need 60 minutes on the Peloton this week: a class or a ride."],
    ["with none", [], "You still need 60 minutes on the Peloton this week: a class or a ride."],
  ])("nudges about Peloton minutes %s", (_name, deskSets, text) => {
    expect(day([], deskSets, "2026-10-07").nudge).toBe(text);
  });

  it("no nudge once the Peloton minutes are done", () => {
    expect(day([ride("2026-10-06", 60)], [], "2026-10-07").nudge).toBeNull();
  });

  it("FLAWLESS when every desk goal is met", () => {
    expect(day([], desk("2026-10-07", 100, 200, 5), "2026-10-07").flawless).toBe(true);
  });

  it.each([
    ["answering yes to the gym", [], true],
    ["a fight session logged today", [{ kind: "fight" as const, date: "2026-10-07", minutes: 60 }], false],
  ])("a fight day from %s excuses the desk goals", (_name, sessions, gym) => {
    expect(day(sessions, [], "2026-10-07", gym)).toMatchObject({ fightDay: true, deskExcused: true });
  });

  it("weekends show desk totals without targets", () => {
    const d = day([], desk("2026-10-10", 20, 0, 1), "2026-10-10");
    expect(d.desk[0]).toEqual({ slot: "pushups", done: 20, target: null });
    expect(d.flawless).toBe(false);
  });
});
