import { describe, expect, it } from "vitest";
import { deskBreak, deskTargets, miniSetSize } from "./desk";
import { at, LIB, makeHistory, PROFILE, type DeskSpec } from "./test-helpers";

// Calibration maxes: 24 push-ups, 30 chair squats.
const calibration = {
  kind: "calibration" as const,
  date: "2026-09-28",
  sets: { desk_pushup: [{ reps: 24 }], chair_squat: [{ reps: 30 }] },
};
const THURSDAY = "2026-10-01";
const done = (date: string, pushups: number, squats: number, pullups: number, squatEx = "chair_squat"): DeskSpec[] => [
  { ex: "desk_pushup", reps: pushups, date },
  { ex: squatEx, reps: squats, date },
  { ex: "pullup_single", reps: pullups, date },
];
const run = (desk: DeskSpec[], date: string, time: string, kneePain: number | null = null) =>
  deskBreak(LIB, PROFILE, makeHistory([calibration], desk), at(date, time), kneePain);

describe("required test 15: mini-sets and the desk squat swap", () => {
  it.each([
    ["no max yet: 1", null, 1],
    ["max 1: 1 (minimum)", 1, 1],
    ["max 7: 3 (half, rounded down)", 7, 3],
    ["max 30: 15", 30, 15],
  ])("mini-set size, %s", (_name, max, size) => expect(miniSetSize(max)).toBe(size));

  it("workday targets: 100 push-ups, 25 squats an hour over 9 to 5 (200), 5 pull-up singles", () => {
    expect(deskTargets(PROFILE, THURSDAY)).toEqual({ pushups: 100, squats: 200, pullups: 5 });
  });

  it("weekends show totals without targets", () => {
    expect(deskTargets(PROFILE, "2026-10-03")).toBeNull();
    expect(deskTargets(PROFILE, "2026-10-04")).toBeNull();
  });

  it.each([
    [
      "1 pm with squats furthest behind: chair squats, half the max",
      done(THURSDAY, 60, 20, 3),
      "13:00",
      null,
      { exerciseId: "chair_squat", reps: 15 },
    ],
    [
      "sore knee (pain 5) swaps chair squats for glute bridges, sized from the chair squat max",
      done(THURSDAY, 60, 20, 3),
      "13:00",
      5,
      { exerciseId: "glute_bridge", reps: 15 },
    ],
    [
      "knee pain of 3 keeps chair squats",
      done(THURSDAY, 60, 20, 3),
      "13:00",
      3,
      { exerciseId: "chair_squat" },
    ],
    [
      "glute bridges on a sore-knee day count toward the squat target",
      done(THURSDAY, 60, 150, 3, "glute_bridge"),
      "13:00",
      5,
      { exerciseId: "desk_pushup", reps: 12 },
    ],
    [
      "4 pm with no pull-ups yet: a single pull-up",
      done(THURSDAY, 90, 180, 0),
      "16:00",
      null,
      { exerciseId: "pullup_single", reps: 1 },
    ],
    ["before work with nothing done: tied, so push-ups first", [], "08:00", null, { exerciseId: "desk_pushup", reps: 12 }],
    [
      "Saturday: the one with the smallest share done",
      done("2026-10-03", 50, 10, 2),
      "12:00",
      null,
      { exerciseId: "chair_squat" },
    ],
  ])("desk break: %s", (_name, desk, time, knee, expected) => {
    const date = desk[0]?.date ?? THURSDAY;
    const s = run(desk, date, time, knee);
    expect(s).toMatchObject({ kind: "desk_break", ...expected });
  });

  it("explains the choice", () => {
    const s = run(done(THURSDAY, 60, 20, 3), THURSDAY, "13:00", 5);
    expect(s.reasons).toEqual([
      "Glute bridge: furthest behind today (20 of 200).",
      "Glute bridges instead of chair squats: knee pain above 3.",
    ]);
  });
});
