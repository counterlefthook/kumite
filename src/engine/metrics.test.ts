import { describe, expect, it } from "vitest";
import { deskStreak, e1rmHistory, epley, fightCalories, FIGHT_MET, sevenDayAverageWeight } from "./metrics";
import { at, LIB, makeHistory, PROFILE, weighIn, ZONE, type DeskSpec } from "./test-helpers";
import type { SessionLog } from "./types";

describe("required test 16: Epley and the 7-day average", () => {
  it.each([
    ["50 lb x 10 is about 66.7", 50, 10, 66.667],
    ["30 lb x 12 is 42", 30, 12, 42],
    ["55 lb x 1 is about 56.8", 55, 1, 56.833],
  ])("Epley: %s", (_name, w, r, e) => expect(epley(w, r)).toBeCloseTo(e, 2));

  it("uses the best set per session", () => {
    const history = makeHistory([
      { date: "2026-10-01", sets: { db_bench_press: [{ w: 30, reps: 12, rir: 1 }, { w: 35, reps: 8, rir: 1 }] } },
      { date: "2026-10-03", sets: { db_bench_press: [{ w: 35, reps: 10, rir: 1 }] } },
    ]);
    expect(e1rmHistory(history, "db_bench_press").map((r) => r.e1rm)).toEqual([epley(35, 8), epley(35, 10)]);
  });

  const now = at("2026-10-08", "09:00");
  it.each([
    ["two weigh-ins: not shown", [weighIn("2026-10-07", 204), weighIn("2026-10-08", 202)], null],
    ["three weigh-ins: their mean", [weighIn("2026-10-06", 205), weighIn("2026-10-07", 204), weighIn("2026-10-08", 202)], 203.667],
    [
      "a weigh-in 7 days ago is outside the window",
      [weighIn("2026-10-01", 250), weighIn("2026-10-02", 204), weighIn("2026-10-07", 204), weighIn("2026-10-08", 202)],
      203.333,
    ],
    ["a weigh-in later today is not counted yet", [weighIn("2026-10-06", 205), weighIn("2026-10-07", 204), weighIn("2026-10-08", 202, "18:00")], null],
  ])("7-day average: %s", (_name, metrics, avg) => {
    const result = sevenDayAverageWeight(metrics, now, ZONE);
    if (avg === null) expect(result).toBeNull();
    else expect(result).toBeCloseTo(avg, 2);
  });
});

describe("fight calories", () => {
  const fight = (minutes: number, effort: number): SessionLog => ({
    id: "f",
    kind: "fight",
    template: null,
    startedAt: at("2026-10-08", "19:00").toISOString(),
    minutes,
    checkIn: null,
    effort,
    override: false,
  });
  const three200 = [weighIn("2026-10-06", 200), weighIn("2026-10-07", 200), weighIn("2026-10-08", 200)];
  const now = at("2026-10-08", "21:00");

  it("uses Compendium code 15430 (MET 10.3): MET x kg x hours", () => {
    expect(FIGHT_MET).toEqual({ code: "15430", met: 10.3 });
    // 10.3 x 90.72 kg x 1 hour, about 934 kcal
    expect(fightCalories(fight(60, 7), three200, now, ZONE)).toBeCloseTo(10.3 * 200 * 0.45359237, 1);
  });

  it("uses the same MET whatever the effort", () => {
    expect(fightCalories(fight(90, 2), three200, now, ZONE)).toBeCloseTo(10.3 * 200 * 0.45359237 * 1.5, 1);
  });

  it("falls back to the latest weigh-in, and needs some weight", () => {
    expect(fightCalories(fight(60, 7), [weighIn("2026-09-01", 210)], now, ZONE)).toBeCloseTo(10.3 * 210 * 0.45359237, 1);
    expect(fightCalories(fight(60, 7), [], now, ZONE)).toBeNull();
  });
});

describe("desk streak", () => {
  const full = (date: string): DeskSpec[] => [
    { ex: "desk_pushup", reps: 100, date },
    { ex: "chair_squat", reps: 200, date },
    { ex: "pullup_single", reps: 5, date },
  ];
  const streak = (desk: DeskSpec[], date: string) => deskStreak(LIB, PROFILE, makeHistory([], desk), at(date, "12:00"));

  it.each([
    ["Mon to Wed met, Thursday unfinished: 3", [...full("2026-10-05"), ...full("2026-10-06"), ...full("2026-10-07")], "2026-10-08", 3],
    ["today met counts: 4", [...full("2026-10-05"), ...full("2026-10-06"), ...full("2026-10-07"), ...full("2026-10-08")], "2026-10-08", 4],
    ["weekends are skipped: Thu, Fri, Mon met, Tuesday unfinished: 3", [...full("2026-10-01"), ...full("2026-10-02"), ...full("2026-10-05")], "2026-10-06", 3],
    ["a missed workday breaks it: 1", [...full("2026-10-05"), ...full("2026-10-07")], "2026-10-08", 1],
    ["nothing logged: 0", [], "2026-10-08", 0],
  ])("%s", (_name, desk, date, expected) => expect(streak(desk, date)).toBe(expected));

  it("a fight day with desk goals unmet is skipped, not a break", () => {
    const desk = [...full("2026-10-05"), ...full("2026-10-07")];
    const history = makeHistory([{ kind: "fight", date: "2026-10-06", minutes: 60 }], desk);
    expect(deskStreak(LIB, PROFILE, history, at("2026-10-08", "12:00"))).toBe(2);
  });
});
