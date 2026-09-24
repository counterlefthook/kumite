import { describe, expect, it } from "vitest";
import { deskBreak, deskDone, deskMoves, deskTargets, miniSetSize, moveReps, pickMove, slotOf } from "./desk";
import { exerciseById } from "./library";
import { at, LIB, makeHistory, PROFILE, ZONE, type DeskSpec } from "./test-helpers";

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
const slotOfId = (id: string) => slotOf(exerciseById(LIB, id));

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
    ["1 pm with legs furthest behind: a legs move", done(THURSDAY, 60, 20, 3), "13:00", null, "squats"],
    ["4 pm with no pull-ups yet: pull-ups", done(THURSDAY, 90, 180, 0), "16:00", null, "pullups"],
    ["legs moves on a sore-knee day count toward the legs goal", done(THURSDAY, 60, 150, 3, "glute_bridge"), "13:00", 5, "pushups"],
    ["before work with nothing done: tied, so push first", [], "08:00", null, "pushups"],
    ["Saturday: the goal with the smallest share done", done("2026-10-03", 50, 10, 2), "12:00", null, "squats"],
  ])("desk break: %s", (_name, desk, time, knee, slot) => {
    const date = desk[0]?.date ?? THURSDAY;
    const s = run(desk, date, time, knee);
    if (s.kind !== "desk_break") throw new Error("expected a desk break");
    expect(slotOfId(s.exerciseId)).toBe(slot);
  });

  it("sore knee (pain above 3) keeps legs to glute bridges, sized from the chair squat max", () => {
    expect(run(done(THURSDAY, 60, 20, 3), THURSDAY, "13:00", 5)).toMatchObject({ exerciseId: "glute_bridge", reps: 15 });
  });

  it("explains the choice", () => {
    expect(run(done(THURSDAY, 60, 20, 3), THURSDAY, "13:00").reasons).toEqual(["Legs is furthest behind today (20 of 200)."]);
  });
});

describe("desk variety", () => {
  it("has several moves for push and legs, and pull-up singles for pull", () => {
    expect(deskMoves(LIB, "pushups").length).toBeGreaterThanOrEqual(6);
    expect(deskMoves(LIB, "squats").length).toBeGreaterThanOrEqual(6);
    expect(deskMoves(LIB, "pullups").map((e) => e.id)).toEqual(["pullup_single"]);
    expect(slotOf(exerciseById(LIB, "wall_sit"))).toBeNull();
  });

  it("every move counts toward its goal", () => {
    const desk: DeskSpec[] = [
      { ex: "desk_wide_pushup", reps: 10, date: THURSDAY },
      { ex: "desk_wall_pushup", reps: 20, date: THURSDAY },
      { ex: "desk_lunge", reps: 12, date: THURSDAY },
      { ex: "calf_raise", reps: 20, date: THURSDAY },
      { ex: "wall_sit", reps: 1, date: THURSDAY },
    ];
    expect(deskDone(LIB, makeHistory([], desk), THURSDAY, ZONE)).toEqual({ pushups: 30, squats: 32, pullups: 0 });
  });

  it("rotates: every push move comes up once before any repeats", () => {
    const desk: DeskSpec[] = [];
    const seen: string[] = [];
    for (let i = 0; i < deskMoves(LIB, "pushups").length; i++) {
      const time = `10:${String(i * 5).padStart(2, "0")}`;
      const move = pickMove(LIB, makeHistory([], desk), "pushups", at(THURSDAY, time), ZONE, null);
      seen.push(move.id);
      desk.push({ ex: move.id, reps: 5, date: THURSDAY, time });
    }
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("never repeats the move just done", () => {
    const desk: DeskSpec[] = deskMoves(LIB, "pushups").map((m, i) => ({ ex: m.id, reps: 5, date: THURSDAY, time: `09:${String(10 + i).padStart(2, "0")}` }));
    const last = desk.at(-1)!.ex;
    expect(pickMove(LIB, makeHistory([], desk), "pushups", at(THURSDAY, "11:00"), ZONE, null).id).not.toBe(last);
  });

  it("starts the day in a different order on different days", () => {
    const first = (date: string) => pickMove(LIB, makeHistory([], []), "pushups", at(date, "09:30"), ZONE, null).id;
    const firsts = new Set(["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"].map(first));
    expect(firsts.size).toBeGreaterThan(1);
  });

  it.each([
    ["push-up at 24 max: 12", "desk_pushup", 12],
    ["wall push-up (x2): 24", "desk_wall_pushup", 24],
    ["close-hands push-up (x0.6): 7", "desk_close_pushup", 7],
    ["lunge at 30 chair squat max (x0.8): 12", "desk_lunge", 12],
    ["pull-up single: always 1", "pullup_single", 1],
  ])("sizes mini-sets: %s", (_name, id, reps) => {
    expect(moveReps(makeHistory([calibration]), exerciseById(LIB, id), at(THURSDAY, "10:00"))).toBe(reps);
  });
});
