import { describe, expect, it } from "vitest";
import { hardSetsThisWeek, paceRanking } from "./pacing";
import { at, LIB, makeHistory, times, ZONE } from "./test-helpers";
import type { TargetGroup } from "./types";

const done = (squat: number, pull: number, hinge: number, push: number): Record<TargetGroup, number> => ({ squat, pull, hinge, push });
const order = (rows: ReturnType<typeof paceRanking>) => rows.map((r) => r.group);

describe("required test 8: pace ranking", () => {
  it("Monday with nothing logged: all tied, so squat, pull, hinge, push", () => {
    const rows = paceRanking(6, 1, done(0, 0, 0, 0));
    expect(order(rows)).toEqual(["squat", "pull", "hinge", "push"]);
    expect(rows[0].pace).toBeCloseTo(6 / 7);
    expect(rows[0].deficit).toBeCloseTo(6 / 7);
  });

  it("Monday with pull already done: pull drops to last", () => {
    expect(order(paceRanking(6, 1, done(0, 2, 0, 0)))).toEqual(["squat", "hinge", "push", "pull"]);
  });

  it("Thursday with partial logs: biggest deficit first, ties broken squat, pull, hinge, push", () => {
    // pace = 9 x 4 / 7 = 5.14. Deficits: squat 2.14, pull 4.14, hinge 2.14, push 4.14.
    const rows = paceRanking(9, 4, done(3, 1, 3, 1));
    expect(order(rows)).toEqual(["pull", "push", "squat", "hinge"]);
    expect(rows[0].deficit).toBeCloseTo(36 / 7 - 1);
  });

  it("Thursday: a group ahead of pace has a negative deficit and ranks last", () => {
    const rows = paceRanking(6, 4, done(6, 2, 2, 2));
    expect(order(rows)).toEqual(["pull", "hinge", "push", "squat"]);
    expect(rows[3].deficit).toBeLessThan(0);
  });
});

describe("hard sets this week", () => {
  const history = makeHistory(
    [
      // Last week: not counted.
      { date: "2026-10-04", sets: { db_bench_press: times(3, { w: 30, reps: 10, rir: 1 }) } },
      // This week (Monday 2026-10-05 onward).
      {
        date: "2026-10-05",
        sets: {
          db_bench_press: [...times(2, { w: 30, reps: 10, rir: 1 }), { w: 30, reps: 12, rir: 4 }],
          db_hip_thrust: times(2, { w: 30, reps: 10, rir: 3 }),
          band_assisted_pullup: times(2, { band: "red", reps: 6, rir: 2 }),
        },
      },
      // Calibration sets are not working sets.
      { kind: "calibration", date: "2026-10-06", sets: { goblet_box_squat: times(3, { w: 30, reps: 11, rir: 2 }) } },
    ],
    [{ ex: "desk_pushup", reps: 20, date: "2026-10-06" }],
  );

  it("counts working sets with 3 or fewer in reserve; not 4+, calibration, desk sets, or last week", () => {
    expect(hardSetsThisWeek(history, LIB, at("2026-10-08"), ZONE)).toEqual(done(0, 2, 2, 2));
  });

  it("knee-swapped hip thrusts count toward hinge", () => {
    const swapped = makeHistory([{ date: "2026-10-05", sets: { db_hip_thrust: times(2, { w: 30, reps: 10, rir: 2 }) } }]);
    expect(hardSetsThisWeek(swapped, LIB, at("2026-10-06"), ZONE).hinge).toBe(2);
  });
});
