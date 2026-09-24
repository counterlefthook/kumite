import { describe, expect, it } from "vitest";
import { generate, nextTemplate, type GenerateInput } from "./generate";
import { at, CALM, EQUIPMENT, LIB, makeHistory, PROFILE, times, type SessionSpec } from "./test-helpers";
import type { Suggestion } from "./types";

// Program week 1 starts Monday 2026-09-28; week 3 starts Monday 2026-10-12.
function run(overrides: Partial<GenerateInput> & { sessions?: SessionSpec[] } = {}): Suggestion {
  const { sessions = [], ...rest } = overrides;
  return generate({
    now: at("2026-10-01", "07:00"),
    library: LIB,
    profile: PROFILE,
    equipment: EQUIPMENT,
    history: makeHistory(sessions),
    checkIn: CALM,
    timeBox: 30,
    ...rest,
  });
}

function strength(s: Suggestion) {
  if (s.kind !== "strength") throw new Error(`expected strength, got ${s.kind}: ${s.reasons.join(" ")}`);
  return s;
}
const exercises = (s: Suggestion) => strength(s).blocks.flatMap((b) => b.exercises);
const find = (s: Suggestion, ladder: string) => exercises(s).find((e) => e.ladder === ladder);

describe("required test 10: guardrails", () => {
  it.each([
    ["upper-body soreness 4 suggests a ride or mobility", { ...CALM, sorenessUpper: 4 }],
    ["energy 2 suggests a ride or mobility", { ...CALM, energy: 2 }],
  ])("recovery check: %s", (_name, checkIn) => {
    const s = run({ checkIn });
    expect(s).toMatchObject({ kind: "recovery", options: ["ride_zone2_30", "mobility_15"] });
    expect(s.reasons[0]).toMatch(/^Easy day instead of strength/);
  });

  it("leg soreness 4 still trains, with squat and hinge capped at 2 sets, 2+ in reserve", () => {
    const s = run({ now: at("2026-10-13", "07:00"), checkIn: { ...CALM, sorenessLegs: 4 } });
    for (const ladder of ["rdl", "unilateral_squat"]) {
      expect(find(s, ladder)).toMatchObject({ sets: 2, targetRir: { min: 2, max: null } });
    }
    expect(find(s, "bench")).toMatchObject({ sets: 3 });
    expect(s.reasons).toContain("Legs capped at 2 sets, 2 or more reps in reserve: leg soreness 4 of 5.");
  });

  const yesterday: SessionSpec[] = [{ date: "2026-09-30", template: "A" }];
  it("strength yesterday suggests a ride, mobility, or desk sets, with train anyway", () => {
    expect(run({ sessions: yesterday })).toMatchObject({
      kind: "rest_day",
      options: ["ride", "mobility", "desk_sets"],
      canTrainAnyway: true,
    });
  });

  it("train anyway gives strength, marked as an override", () => {
    const s = strength(run({ sessions: yesterday, trainAnyway: true }));
    expect(s).toMatchObject({ template: "B", override: true });
    expect(s.reasons).toContain("Training anyway after strength yesterday.");
  });

  it("fight training in the next 24 hours caps squat and hinge at 2 sets, 2+ in reserve", () => {
    const s = run({ now: at("2026-10-13", "07:00"), checkIn: { ...CALM, fightNext24h: true } });
    expect(strength(s).rounds).toBe(3);
    for (const ladder of ["rdl", "unilateral_squat"]) {
      expect(find(s, ladder)).toMatchObject({ sets: 2, targetRir: { min: 2, max: null } });
    }
    expect(find(s, "bench")).toMatchObject({ sets: 3, targetRir: { min: 1, max: 2 } });
    expect(find(s, "pullup")).toMatchObject({ sets: 3 });
    expect(s.reasons.join(" ")).toMatch(/Legs capped at 2 sets.*fight training/);
  });

  it("knee pain above 3 in template A swaps the split squat for hip thrusts (hinge)", () => {
    const s = run({ checkIn: { ...CALM, kneePain: 4 } });
    expect(find(s, "unilateral_squat")).toBeUndefined();
    expect(find(s, "hip_thrust")).toMatchObject({ exerciseId: "db_hip_thrust", group: "hinge" });
    expect(s.reasons.join(" ")).toMatch(/Knee pain 4 of 10: the squat slot is Dumbbell hip thrust.*hinge/i);
  });

  it("knee pain above 3 in template B swaps the box squat for Romanian deadlifts", () => {
    const s = run({ sessions: [{ date: "2026-09-29", template: "A" }], checkIn: { ...CALM, kneePain: 6 } });
    expect(strength(s).template).toBe("B");
    expect(find(s, "box_squat")).toBeUndefined();
    expect(strength(s).blocks[0].exercises.map((e) => e.ladder)).toEqual(["rdl", "shoulder_press"]);
  });

  it("the knee swap uses that ladder's current rung and load", () => {
    const sessions: SessionSpec[] = [
      { kind: "calibration", date: "2026-09-28", sets: { db_hip_thrust: [{ w: 40, reps: 11, rir: 2 }] } },
    ];
    const s = run({ sessions, checkIn: { ...CALM, kneePain: 5 } });
    expect(find(s, "hip_thrust")).toMatchObject({ load: { kind: "dumbbell", lb: 40 } });
  });

  it("knee pain of 3 does not swap", () => {
    expect(find(run({ checkIn: { ...CALM, kneePain: 3 } }), "unilateral_squat")).toBeDefined();
  });
});

describe("required test 11: time boxes", () => {
  it("30 minutes: pair 1, then pair 2, at the week's rounds, then the finisher; arm finisher offered", () => {
    const s = strength(run({ timeBox: 30 }));
    expect(s.blocks.map((b) => b.kind)).toEqual(["pair", "pullup_extra", "pair", "finisher", "optional_finisher"]);
    expect(s.blocks[0].exercises.map((e) => e.exerciseId)).toEqual(["band_assisted_pullup", "db_romanian_deadlift"]);
    expect(s.blocks[2].exercises.map((e) => e.exerciseId)).toEqual(["db_split_squat", "db_bench_press"]);
    expect(s.blocks[3].exercises[0]).toMatchObject({ exerciseId: "plank", sets: 2, seconds: [30, 60] });
    expect(s.blocks[4].exercises.map((e) => e.exerciseId)).toEqual(["db_curl", "db_overhead_triceps_extension"]);
    expect(s.blocks.every((b) => b.restAfterSec === 75)).toBe(true);
    expect(s.reasons).toContain("2 rounds per pair in week 1 while soreness settles.");
  });

  it("20 minutes: both pairs, no finisher", () => {
    expect(strength(run({ timeBox: 20 })).blocks.map((b) => b.kind)).toEqual(["pair", "pullup_extra", "pair"]);
  });

  // Week 3, Thursday. Monday was template B, so today is A:
  // pair 1 is pull + hinge, pair 2 is squat + push.
  const monday = (sets: SessionSpec["sets"]): SessionSpec[] => [{ date: "2026-10-12", template: "B", sets }];
  it.each([
    [
      "squat and push already logged: pair 1 (pull and hinge) is further behind",
      monday({ goblet_box_squat: times(3, { w: 30, reps: 10, rir: 2 }), db_seated_shoulder_press: times(3, { w: 20, reps: 10, rir: 2 }) }),
      ["band_assisted_pullup", "db_romanian_deadlift"],
    ],
    [
      "pull and hinge already logged: pair 2 (squat and push) is further behind",
      monday({ db_chest_supported_row: times(3, { w: 30, reps: 10, rir: 2 }), db_hip_thrust: times(3, { w: 30, reps: 10, rir: 2 }) }),
      ["db_split_squat", "db_bench_press"],
    ],
    ["a tie keeps pair 1", monday({}), ["band_assisted_pullup", "db_romanian_deadlift"]],
  ])("10 minutes: EMOM, %s", (_name, sessions, ids) => {
    const s = strength(run({ now: at("2026-10-15", "07:00"), sessions, timeBox: 10 }));
    expect(s.blocks).toHaveLength(1);
    expect(s.blocks[0]).toMatchObject({ kind: "emom", minutes: 10, restAfterSec: null });
    expect(s.blocks[0].exercises.map((e) => e.exerciseId)).toEqual(ids);
    expect(s.blocks[0].exercises.every((e) => e.sets === 5)).toBe(true);
  });

  it("a desk break needs no check-in and skips the recovery check", () => {
    expect(run({ timeBox: "desk", checkIn: null }).kind).toBe("desk_break");
    expect(run({ timeBox: "desk", checkIn: { ...CALM, energy: 1 } }).kind).toBe("desk_break");
  });

  it("without a check-in (0.1), strength is planned with no caps or swaps", () => {
    const s = strength(run({ now: at("2026-10-13", "07:00"), checkIn: null }));
    expect(find(s, "rdl")).toMatchObject({ sets: 3, targetRir: { min: 1, max: 2 } });
    expect(find(s, "unilateral_squat")).toBeDefined();
    expect(s.reasons).toEqual([]);
  });
});

describe("required test 12: quota squeeze in the generator", () => {
  // Week 1: one strength session on Friday 2026-10-02; today is Saturday.
  const friday: SessionSpec[] = [{ date: "2026-10-02", template: "A" }];
  const saturday = at("2026-10-03", "07:00");

  it("when days run short, strength runs on back-to-back days in the 20-minute box", () => {
    const s = strength(run({ now: saturday, sessions: friday, timeBox: 30 }));
    expect(s).toMatchObject({ timeBox: 20, override: false, template: "B" });
    expect(s.blocks.map((b) => b.kind)).toEqual(["pair", "pair"]);
    expect(s.reasons.join(" ")).toMatch(/2 strength sessions left and 2 days in the week/);
  });

  it("a 10-minute pick stays at 10 minutes", () => {
    expect(strength(run({ now: saturday, sessions: friday, timeBox: 10 })).timeBox).toBe(10);
  });

  it("recovery still wins over the squeeze", () => {
    expect(run({ now: saturday, sessions: friday, checkIn: { ...CALM, energy: 2 } }).kind).toBe("recovery");
  });
});

describe("required test 13: A and B alternation", () => {
  const next = (sessions: SessionSpec[], now = at("2026-10-05", "07:00")) => nextTemplate(makeHistory(sessions), now);
  it.each<[string, SessionSpec[], "A" | "B"]>([
    ["no strength session yet: A", [], "A"],
    ["A on Sunday, then Monday of a new week: B", [{ date: "2026-10-04", template: "A" }], "B"],
    ["A Friday, B Sunday, then Monday: A", [{ date: "2026-10-02", template: "A" }, { date: "2026-10-04", template: "B" }], "A"],
    ["calibration of template B counts as B's first session: A", [{ kind: "calibration", date: "2026-10-03", template: "B" }], "A"],
    ["fight and ride sessions do not affect it", [{ date: "2026-10-02", template: "A" }, { kind: "fight", date: "2026-10-04" }], "B"],
  ])("%s", (_name, sessions, template) => expect(next(sessions)).toBe(template));

  it("the generator uses it across a week boundary (A on Saturday, B on Monday)", () => {
    expect(strength(run({ now: at("2026-10-05", "07:00"), sessions: [{ date: "2026-10-03", template: "A" }] })).template).toBe("B");
  });
});

describe("max test status on strength days", () => {
  it("is offered when no max test has happened", () => {
    expect(strength(run()).maxTest).toBe("offered");
  });
  it("is not due a week after calibration", () => {
    const s = run({ sessions: [{ kind: "calibration", date: "2026-09-28", sets: { strict_pullup: [{ reps: 2 }] } }] });
    expect(strength(s).maxTest).toBe("not_due");
  });
});
