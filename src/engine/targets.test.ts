import { describe, expect, it } from "vitest";
import { recoveryHolding, targetsFor, weeklyTargets } from "./targets";
import { at, CALM, makeHistory, PROFILE, ZONE } from "./test-helpers";
import type { CheckIn } from "./types";

const ci = (soreness: number, energy: number): CheckIn => ({ ...CALM, sorenessLegs: soreness, sorenessUpper: 1, energy });
// Check-ins on given dates, each attached to a strength session.
const withCheckIns = (rows: [string, CheckIn][]) =>
  makeHistory(rows.map(([date, checkIn]) => ({ kind: "strength", date, checkIn }))).sessions;

describe("required test 9: weekly targets and rounds", () => {
  it.each([
    ["week 1: 6 hard sets, 2 rounds", 1, false, { hardSets: 6, rounds: 2 }],
    ["week 2: 6 hard sets, 2 rounds", 2, true, { hardSets: 6, rounds: 2 }],
    ["week 3: 9 hard sets, 3 rounds", 3, true, { hardSets: 9, rounds: 3 }],
    ["week 4: 9 hard sets, 3 rounds", 4, false, { hardSets: 9, rounds: 3 }],
    ["week 5, recovery holding: 12 hard sets, 4 rounds", 5, true, { hardSets: 12, rounds: 4 }],
    ["week 5, recovery not holding: 9 hard sets, 3 rounds", 5, false, { hardSets: 9, rounds: 3 }],
    ["week 9, recovery holding: 12 hard sets, 4 rounds", 9, true, { hardSets: 12, rounds: 4 }],
  ])("%s", (_name, week, holding, expected) => expect(weeklyTargets(week, holding)).toEqual(expected));

  // Week 5 starts Monday 2026-10-26; the previous two weeks run 10-12 to 10-25.
  const NOW = at("2026-10-27");
  it.each<[string, [string, CheckIn][], boolean]>([
    ["averages of soreness 3 and energy 3 hold", [["2026-10-13", ci(3, 3)], ["2026-10-20", ci(3, 3)]], true],
    ["one sore day averaged with an easy one still holds", [["2026-10-13", ci(4, 3)], ["2026-10-20", ci(2, 4)]], true],
    ["average soreness above 3 does not hold", [["2026-10-13", ci(4, 4)], ["2026-10-20", ci(3, 4)]], false],
    ["average energy below 3 does not hold", [["2026-10-13", ci(2, 2)], ["2026-10-20", ci(2, 3)]], false],
    ["check-ins older than two weeks are ignored", [["2026-10-05", ci(5, 1)], ["2026-10-20", ci(2, 4)]], true],
    ["this week's check-ins are ignored", [["2026-10-27", ci(5, 1)], ["2026-10-20", ci(2, 4)]], true],
    ["no check-ins at all does not hold", [], false],
  ])("%s", (_name, rows, holding) => expect(recoveryHolding(withCheckIns(rows), NOW, ZONE)).toBe(holding));

  it("upper-body soreness counts through overall soreness", () => {
    const upper: CheckIn = { ...CALM, sorenessLegs: 1, sorenessUpper: 5, energy: 4 };
    expect(recoveryHolding(withCheckIns([["2026-10-20", upper]]), NOW, ZONE)).toBe(false);
  });

  it("put together: week 5 with recovery holding gets 12 and 4", () => {
    const sessions = withCheckIns([["2026-10-20", ci(2, 4)]]);
    expect(targetsFor(sessions, NOW, PROFILE.programStartDate, ZONE)).toEqual({ week: 5, holding: true, hardSets: 12, rounds: 4 });
  });
});
