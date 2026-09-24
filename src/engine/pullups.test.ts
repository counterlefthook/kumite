import { describe, expect, it } from "vitest";
import { maxTestStatus, milestonesReached, prescribePullups, pullupState, stage4Target } from "./pullups";
import { at, EQUIPMENT, LIB, makeHistory, ZONE, type SessionSpec } from "./test-helpers";

// Bands heaviest to lightest: black, red, green, yellow. Calibration: 5 reps on red, max of 2 strict.
const calibration: SessionSpec = {
  kind: "calibration",
  date: "2026-09-28",
  sets: { band_assisted_pullup: [{ band: "red", reps: 5 }], strict_pullup: [{ reps: 2 }] },
};
const bandSession = (date: string, band: string, reps: number[]): SessionSpec => ({
  date,
  template: "A",
  sets: { band_assisted_pullup: reps.map((r) => ({ band, reps: r, rir: 1 })) },
});
const NOW = at("2026-10-20");
const state = (sessions: SessionSpec[]) => pullupState(EQUIPMENT, makeHistory(sessions), NOW, ZONE);

describe("required test 7: pull-up stages", () => {
  it.each([
    ["Stage 1 starts with the band from calibration", [calibration], 1, "red"],
    ["not every set at 8 stays on the same band", [calibration, bandSession("2026-09-30", "red", [8, 8, 7])], 1, "red"],
    ["all band sets at 8 move to the next lighter band (Stage 2)", [calibration, bandSession("2026-09-30", "red", [8, 8])], 2, "green"],
    [
      "and again to the lightest band",
      [calibration, bandSession("2026-09-30", "red", [8, 8]), bandSession("2026-10-02", "green", [8, 8, 8])],
      2,
      "yellow",
    ],
    [
      "all sets at 8 on the lightest band switch to strict sets (Stage 3)",
      [
        calibration,
        bandSession("2026-09-30", "red", [8, 8]),
        bandSession("2026-10-02", "green", [8, 8]),
        bandSession("2026-10-05", "yellow", [8, 8, 8]),
      ],
      3,
      "yellow",
    ],
  ])("%s", (_name, sessions, stage, band) => expect(state(sessions)).toMatchObject({ stage, band }));

  it.each([
    ["a max test of 4 does not reach Stage 4", 4, 1],
    ["a max test of 5 reaches Stage 4", 5, 4],
    ["a max test of 7 is Stage 4", 7, 4],
  ])("%s", (_name, reps, stage) => {
    const s = state([calibration, { kind: "max_test", date: "2026-10-14", sets: { strict_pullup: [{ reps }] } }]);
    expect(s.stage).toBe(stage);
    expect(s.latestMax).toBe(reps);
  });

  it("Stages 1 and 2 give band sets at the week's rounds, then 3 negatives", () => {
    const rx = prescribePullups(LIB, state([calibration]), 2, NOW, ZONE);
    expect(rx.main).toMatchObject({ exerciseId: "band_assisted_pullup", load: { kind: "band", band: "red" }, sets: 2, reps: [5, 8] });
    expect(rx.extra).toMatchObject({ exerciseId: "pullup_negative", sets: 1, reps: [3, 3] });
  });

  it("Stage 3 gives strict sets at max minus 1 (minimum 1), then a back-off set to 8 on the lightest band", () => {
    const s = { stage: 3 as const, band: "yellow", latestMax: 4, lastMaxTestDate: "2026-10-14" };
    const rx = prescribePullups(LIB, s, 3, NOW, ZONE);
    expect(rx.main).toMatchObject({ exerciseId: "strict_pullup", sets: 3, reps: [3, 3] });
    expect(rx.extra).toMatchObject({ exerciseId: "band_assisted_pullup", load: { kind: "band", band: "yellow" }, sets: 1, reps: [8, 8] });
    expect(prescribePullups(LIB, { ...s, latestMax: 1 }, 3, NOW, ZONE).main.reps).toEqual([1, 1]);
  });

  it.each([
    ["max 5, test week: 3 sets of 3", 5, 0, { sets: 3, reps: 3 }],
    ["max 5, one week on: reps first, 3 sets of 4", 5, 1, { sets: 3, reps: 4 }],
    ["max 5, two weeks on: reps at max minus 1, so a set is added", 5, 2, { sets: 4, reps: 4 }],
    ["max 5, three weeks on: 5 sets", 5, 3, { sets: 5, reps: 4 }],
    ["max 5, many weeks on: capped at 5 sets", 5, 9, { sets: 5, reps: 4 }],
    ["max 8, test week: 3 sets of 6", 8, 0, { sets: 3, reps: 6 }],
    ["max 8, one week on: 3 sets of 7", 8, 1, { sets: 3, reps: 7 }],
    ["max 8, two weeks on: 4 sets of 7", 8, 2, { sets: 4, reps: 7 }],
  ])("Stage 4, %s", (_name, max, weeks, expected) => expect(stage4Target(max, weeks)).toEqual(expected));

  it("Stage 4 counts program weeks since the latest max test", () => {
    const s = { stage: 4 as const, band: "yellow", latestMax: 5, lastMaxTestDate: "2026-10-07" };
    expect(prescribePullups(LIB, s, 3, at("2026-10-20"), ZONE).main).toMatchObject({ sets: 4, reps: [4, 4] });
  });

  it.each([
    ["13 days after the last test: not due", "2026-10-14", "2026-10-27", "not_due"],
    ["14 days: offered", "2026-10-14", "2026-10-28", "offered"],
    ["20 days: still offered", "2026-10-14", "2026-11-03", "offered"],
    ["21 days: required", "2026-10-14", "2026-11-04", "required"],
    ["never tested: offered", null, "2026-10-01", "offered"],
  ])("max test %s", (_name, last, today, status) => expect(maxTestStatus(last, today)).toBe(status));

  it("the calibration max counts as the first test", () => {
    expect(state([calibration]).lastMaxTestDate).toBe("2026-09-28");
  });

  it.each([
    ["4 to 5 celebrates 5", 4, 5, [5]],
    ["4 to 8 celebrates 5 and 8", 4, 8, [5, 8]],
    ["8 to 10 celebrates 10", 8, 10, [10]],
    ["5 to 5 celebrates nothing", 5, 5, []],
  ])("milestones: %s", (_name, prev, next, expected) => expect(milestonesReached(prev, next)).toEqual(expected));

  it("uses the week's rounds for band sets (2 in week 1, 3 later)", () => {
    const s = state([calibration]);
    expect(prescribePullups(LIB, s, 2, NOW, ZONE).main.sets).toBe(2);
    expect(prescribePullups(LIB, s, 3, NOW, ZONE).main.sets).toBe(3);
  });
});
