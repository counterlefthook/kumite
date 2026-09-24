import { describe, expect, it } from "vitest";
import {
  floorToSetting,
  ladderState,
  prescribe,
  setsFor,
  settingDown,
  settingUp,
  widen,
  type LadderState,
} from "./progression";
import { EQUIPMENT, LIB, makeHistory, times, type SessionSpec } from "./test-helpers";
import type { Range } from "./types";

const S = EQUIPMENT.dumbbellSettingsLb;

// A calibration session at `w` for the ladder's rung 1, then the given sessions, one a day.
function replay(ladder: string, calibration: number | null, sessions: Record<string, ReturnType<typeof times>>[]): LadderState {
  const rung1 = LIB.exercises.find((e) => e.ladder === ladder && e.rung === 1)!.id;
  const specs: SessionSpec[] = [];
  if (calibration !== null) specs.push({ kind: "calibration", date: "2026-09-28", sets: { [rung1]: [{ w: calibration, reps: 11, rir: 2 }] } });
  sessions.forEach((sets, i) => specs.push({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, sets }));
  return ladderState(LIB, EQUIPMENT, makeHistory(specs), ladder);
}

describe("dumbbell settings", () => {
  it.each([
    ["one setting up from 30 is 35", settingUp(S, 30), 35],
    ["one setting up from 55 stays at 55", settingUp(S, 55), 55],
    ["one setting down from 30 is 25", settingDown(S, 30), 25],
    ["one setting down from the lowest stays at the lowest", settingDown(S, 5), 5],
    ["75% of 55 rounds down to 40", floorToSetting(S, 55 * 0.75), 40],
    ["a target below the lowest setting uses the lowest", floorToSetting(S, 3), 5],
  ])("%s", (_name, actual, expected) => expect(actual).toBe(expected));

  it.each<[string, Range, Range | null]>([
    ["8 to 12 widens to 12 to 15", [8, 12], [12, 15]],
    ["12 to 15 widens to 15 to 20", [12, 15], [15, 20]],
    ["10 to 15 widens to 15 to 20", [10, 15], [15, 20]],
    ["8 to 15 (curls, triceps) widens to 15 to 20", [8, 15], [15, 20]],
    ["15 to 20 does not widen further", [15, 20], null],
  ])("%s", (_name, range, expected) => expect(widen(range)).toEqual(expected));
});

describe("required test 1: topped below the highest setting", () => {
  it.each([
    ["topped at 30 moves to 35", 30, 35],
    ["topped at 50 moves to 55", 50, 55],
  ])("%s", (_name, load, next) => {
    const s = replay("bench", load, [{ db_bench_press: times(3, { w: load, reps: 12, rir: 1 }) }]);
    expect(s).toMatchObject({ exerciseId: "db_bench_press", loadLb: next, reps: [8, 12] });
  });

  it("topping needs at least 1 rep in reserve on every set", () => {
    const s = replay("bench", 30, [{ db_bench_press: [...times(2, { w: 30, reps: 12, rir: 1 }), { w: 30, reps: 12, rir: 0 }] }]);
    expect(s.loadLb).toBe(30);
  });
});

describe("required test 2: topped at the highest setting widens, then moves up a rung", () => {
  const top = (reps: number) => ({ db_bench_press: times(3, { w: 55, reps, rir: 1 }) });
  it.each<[string, Record<string, ReturnType<typeof times>>[], Partial<LadderState>]>([
    ["8 to 12 topped at 55 widens to 12 to 15", [top(12)], { exerciseId: "db_bench_press", loadLb: 55, reps: [12, 15] }],
    ["then 12 to 15 topped widens to 15 to 20", [top(12), top(15)], { loadLb: 55, reps: [15, 20] }],
    [
      "then 15 to 20 topped moves to the incline press at 75% rounded down (40 lb), base range",
      [top(12), top(15), top(20)],
      { exerciseId: "db_incline_press", rung: 2, loadLb: 40, reps: [8, 12] },
    ],
    [
      "10 to 15 (split squat) topped at 55 widens to 15 to 20",
      [{ db_split_squat: times(3, { w: 55, reps: 15, rir: 1 }) }],
      { exerciseId: "db_split_squat", reps: [15, 20] },
    ],
  ])("%s", (_name, sessions, expected) => {
    const ladder = Object.keys(sessions[0])[0] === "db_split_squat" ? "unilateral_squat" : "bench";
    expect(replay(ladder, 55, sessions)).toMatchObject(expected);
  });

  it("with 2.5 lb steps, 75% of 55 (41.25) rounds down to 40, not 42.5", () => {
    const fine = { ...EQUIPMENT, dumbbellSettingsLb: Array.from({ length: 21 }, (_, i) => 5 + i * 2.5) };
    const history = makeHistory(
      [12, 15, 20].map((reps, i) => ({ date: `2026-10-0${i + 1}`, sets: { db_bench_press: times(3, { w: 55, reps, rir: 1 }) } })),
    );
    expect(ladderState(LIB, fine, history, "bench")).toMatchObject({ exerciseId: "db_incline_press", loadLb: 40 });
  });

  it("moving up to a bodyweight rung drops the load", () => {
    const s = replay("bench", null, [
      { db_bench_press_tempo: times(3, { w: 55, reps: 12, rir: 1 }) },
      { db_bench_press_tempo: times(3, { w: 55, reps: 15, rir: 1 }) },
      { db_bench_press_tempo: times(3, { w: 55, reps: 20, rir: 1 }) },
    ]);
    expect(s).toMatchObject({ exerciseId: "feet_elevated_pushup", loadLb: null, reps: [10, 15] });
  });
});

describe("required test 3: topped at 15 to 20 on the last rung adds a set, capped at 4", () => {
  const last = (reps: number) => ({ single_leg_hip_thrust: times(3, { w: 55, reps, rir: 1 }) });
  it.each([
    ["once: 3 rounds become 4 sets", [last(15), last(20)], 3, 4, 1],
    ["once: 2 rounds become 3 sets", [last(15), last(20)], 2, 3, 1],
    ["twice: 2 rounds become 4 sets", [last(15), last(20), last(20)], 2, 4, 2],
    ["twice: 3 rounds stay capped at 4 sets", [last(15), last(20), last(20)], 3, 4, 2],
    ["three times at 4 rounds stays at 4 sets", [last(15), last(20), last(20), last(20)], 4, 4, 3],
  ])("%s", (_name, sessions, rounds, sets, extra) => {
    const s = replay("hip_thrust", 55, sessions);
    expect(s).toMatchObject({ exerciseId: "single_leg_hip_thrust", reps: [15, 20], complete: true, extraSets: extra });
    expect(setsFor(s, rounds)).toBe(sets);
  });

  it("an unfinished ladder uses the week's rounds", () => {
    expect(setsFor(replay("hip_thrust", 30, []), 3)).toBe(3);
  });
});

describe("required test 4: misses", () => {
  const miss = { db_bench_press: [{ w: 30, reps: 9, rir: 1 }, { w: 30, reps: 7, rir: 0 }, { w: 30, reps: 6, rir: 0 }] };
  const ok = { db_bench_press: times(3, { w: 30, reps: 9, rir: 2 }) };
  it.each([
    ["a single miss holds", [miss], 30],
    ["a miss in two consecutive sessions drops one setting", [miss, miss], 25],
    ["miss, fine, miss holds", [miss, ok, miss], 30],
  ])("%s", (_name, sessions, load) => {
    const s = replay("bench", 30, sessions);
    expect(s.loadLb).toBe(load);
    expect(s.reps).toEqual([8, 12]);
  });

  it("two misses at the lowest setting stay at the lowest", () => {
    const low = { db_bench_press: times(3, { w: 5, reps: 6, rir: 0 }) };
    expect(replay("bench", 5, [low, low]).loadLb).toBe(5);
  });
});

describe("required test 5: mixed results hold weight and range", () => {
  it.each([
    ["some sets at the top, some not", [{ w: 30, reps: 12, rir: 1 }, { w: 30, reps: 12, rir: 1 }, { w: 30, reps: 10, rir: 1 }]],
    ["all inside the range", times(3, { w: 30, reps: 10, rir: 2 })],
  ])("%s", (_name, sets) => {
    expect(replay("bench", 30, [{ db_bench_press: sets }])).toMatchObject({ loadLb: 30, reps: [8, 12] });
  });
});

describe("required test 6: bodyweight and hold progressions", () => {
  it.each<[string, Record<string, ReturnType<typeof times>>[], Partial<LadderState>]>([
    [
      "bodyweight topped at 10 to 15 widens to 15 to 20",
      [{ feet_elevated_pushup: times(3, { reps: 15, rir: 1 }) }],
      { exerciseId: "feet_elevated_pushup", reps: [15, 20], extraSets: 0 },
    ],
    [
      "bodyweight topped at 15 to 20 on the last rung adds a set",
      [{ feet_elevated_pushup: times(3, { reps: 15, rir: 1 }) }, { feet_elevated_pushup: times(3, { reps: 20, rir: 1 }) }],
      { reps: [15, 20], extraSets: 1, complete: true },
    ],
  ])("%s", (_name, sessions, expected) => expect(replay("bench", null, sessions)).toMatchObject(expected));

  const plank = (sec: number) => ({ plank: times(3, { sec }) });
  const hollow = (sec: number) => ({ hollow_hold: times(3, { sec }) });
  it.each<[string, Record<string, ReturnType<typeof times>>[], Partial<LadderState>]>([
    ["a plank short of 60 seconds holds", [plank(50)], { exerciseId: "plank", seconds: [30, 60] }],
    ["a plank topped at 60 seconds moves to the hollow hold", [plank(60)], { exerciseId: "hollow_hold", seconds: [20, 40] }],
    ["hollow hold (last rung) topped at 40 goes to 30 to 55", [plank(60), hollow(40)], { seconds: [30, 55] }],
    ["then 40 to 70", [plank(60), hollow(40), hollow(55)], { seconds: [40, 70] }],
    ["then 50 to 85", [plank(60), hollow(40), hollow(55), hollow(70)], { seconds: [50, 85] }],
    ["then the top is capped at 90", [plank(60), hollow(40), hollow(55), hollow(70), hollow(85)], { seconds: [60, 90] }],
    ["and stays at 60 to 90", [plank(60), hollow(40), hollow(55), hollow(70), hollow(85), hollow(90)], { seconds: [60, 90] }],
  ])("%s", (_name, sessions, expected) => expect(replay("core_front", null, sessions)).toMatchObject(expected));

  it("side plank climbs 20-45, 30-60, 40-75, 50-90, then holds", () => {
    const side = (sec: number) => ({ side_plank: times(2, { sec }) });
    const ranges = [[], [side(45)], [side(45), side(60)], [side(45), side(60), side(75)], [side(45), side(60), side(75), side(90)]].map(
      (sessions) => replay("core_side", null, sessions).seconds,
    );
    expect(ranges).toEqual([[20, 45], [30, 60], [40, 75], [50, 90], [50, 90]]);
  });
});

describe("knee flags, calibration, and what was actually done", () => {
  it.each<[string, Record<string, ReturnType<typeof times>>[], Partial<LadderState>]>([
    [
      "a knee flag on rung 2 drops to rung 1 at the same weight",
      [{ db_reverse_lunge: [{ w: 30, reps: 12, rir: 2 }, { w: 30, reps: 8, rir: 2, knee: true }] }],
      { exerciseId: "db_split_squat", loadLb: 30, reps: [10, 15] },
    ],
    [
      "a knee flag on rung 1 drops one setting",
      [{ db_split_squat: [{ w: 30, reps: 15, rir: 1, knee: true }] }],
      { exerciseId: "db_split_squat", loadLb: 25 },
    ],
  ])("%s", (_name, sessions, expected) => expect(replay("unilateral_squat", 30, sessions)).toMatchObject(expected));

  it.each([
    ["calibration sets rung 1's starting load", 25, 25],
    ["no calibration starts at the lowest setting", null, 5],
  ])("%s", (_name, calibration, load) => expect(replay("rdl", calibration, []).loadLb).toBe(load));

  it("progresses from the weight actually logged, not the one suggested", () => {
    const s = replay("bench", 30, [{ db_bench_press: times(3, { w: 40, reps: 12, rir: 1 }) }]);
    expect(s.loadLb).toBe(45);
  });

  it("prescribes the current state with 1 to 2 reps in reserve", () => {
    const p = prescribe(LIB, replay("bench", 30, []), 3);
    expect(p).toMatchObject({ exerciseId: "db_bench_press", load: { kind: "dumbbell", lb: 30 }, reps: [8, 12], sets: 3, targetRir: { min: 1, max: 2 } });
  });
});
