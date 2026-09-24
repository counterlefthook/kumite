import { describe, expect, it } from "vitest";
import { applyLegCap, legCapReason, quotaSqueeze, recoveryCheck, strengthYesterday } from "./guardrails";
import { at, CALM, makeHistory, ZONE } from "./test-helpers";
import type { Prescription } from "./types";

describe("recovery check", () => {
  it.each([
    ["calm check-in passes", CALM, false],
    ["leg soreness 5 alone passes (the leg cap handles it)", { ...CALM, sorenessLegs: 5 }, false],
    ["upper soreness 4 fails", { ...CALM, sorenessUpper: 4 }, true],
    ["energy 2 fails", { ...CALM, energy: 2 }, true],
    ["soreness 3 and energy 3 pass", { ...CALM, sorenessLegs: 3, sorenessUpper: 3, energy: 3 }, false],
  ])("%s", (_name, checkIn, fails) => expect(recoveryCheck(checkIn) !== null).toBe(fails));
});

describe("spacing", () => {
  const history = makeHistory([{ date: "2026-09-29", time: "21:30", template: "A" }]);
  it.each([
    ["the day after strength", "2026-09-30", true],
    ["two days after", "2026-10-01", false],
    ["the same day", "2026-09-29", false],
  ])("%s", (_name, date, expected) => expect(strengthYesterday(history, at(date, "08:00"), ZONE)).toBe(expected));
});

describe("required test 12: quota squeeze", () => {
  it.each([
    ["none done by Friday: 3 left in 3 days is short", 0, 5, true],
    ["one done by Thursday: 2 left in 4 days is fine", 1, 4, false],
    ["one done by Friday: 2 left in 3 days is fine", 1, 5, false],
    ["one done by Saturday: 2 left in 2 days is short", 1, 6, true],
    ["two done by Sunday: 1 left today is fine", 2, 7, false],
    ["all three done: never short", 3, 7, false],
  ])("%s", (_name, done, day, active) => expect(quotaSqueeze(done, day).active).toBe(active));
});

describe("leg cap", () => {
  const rx = (group: Prescription["group"], sets: number): Prescription => ({
    exerciseId: "x",
    name: "x",
    cue: "",
    ladder: "x",
    group,
    load: { kind: "bodyweight" },
    reps: [8, 12],
    seconds: null,
    sets,
    targetRir: { min: 1, max: 2 },
  });
  it.each([
    ["squat drops to 2 sets at 2+ in reserve", rx("squat", 3), 2, { min: 2, max: null }],
    ["hinge drops to 2 sets at 2+ in reserve", rx("hinge", 4), 2, { min: 2, max: null }],
    ["push is untouched", rx("push", 3), 3, { min: 1, max: 2 }],
    ["pull is untouched", rx("pull", 3), 3, { min: 1, max: 2 }],
  ])("%s", (_name, p, sets, rir) => expect(applyLegCap(p)).toMatchObject({ sets, targetRir: rir }));

  it.each([
    ["fight training in the next 24 hours", { ...CALM, fightNext24h: true }, true],
    ["leg soreness 4", { ...CALM, sorenessLegs: 4 }, true],
    ["a calm day", CALM, false],
  ])("applies for %s", (_name, checkIn, applies) => expect(legCapReason(checkIn) !== null).toBe(applies));
});
