import { describe, expect, it } from "vitest";
import { deskNudge } from "./nudge";
import { at, LIB, makeHistory, PROFILE, type DeskSpec, type SessionSpec } from "./test-helpers";

// Thursday 2026-10-01, work hours 9:00 to 17:00.
const THU = "2026-10-01";
const nudge = (time: string, desk: DeskSpec[] = [], sessions: SessionSpec[] = [], gymToday = false, date = THU) =>
  deskNudge({ now: at(date, time), library: LIB, profile: PROFILE, history: makeHistory(sessions, desk), gymToday });
const full = (date: string): DeskSpec[] => [
  { ex: "desk_pushup", reps: 100, date, time: "09:30" },
  { ex: "chair_squat", reps: 200, date, time: "09:40" },
  { ex: "pullup_single", reps: 5, date, time: "09:50" },
];

describe("desk nudges", () => {
  it("nudges at 11:00 with nothing done, naming the next move", () => {
    const n = nudge("11:00");
    expect(n).not.toBeNull();
    expect(n!.title).toBe("KUMITE");
    expect(n!.body).toMatch(/^ROUND 1: \d+ x .+\. .+ is furthest behind today/);
  });

  it.each<[string, string, DeskSpec[], SessionSpec[], boolean, string]>([
    ["before work", "08:30", [], [], false, THU],
    ["after work", "17:00", [], [], false, THU],
    ["on a weekend", "11:00", [], [], false, "2026-10-03"],
    ["when every goal is met", "11:00", full(THU), [], false, THU],
    ["when the switch says gym", "11:00", [], [], true, THU],
    ["after a fight class today", "11:00", [], [{ kind: "fight", date: THU, time: "07:00", minutes: 60 }], false, THU],
  ])("stays silent %s", (_name, time, desk, sessions, gym, date) => {
    expect(nudge(time, desk, sessions, gym, date)).toBeNull();
  });

  it("stays silent while every goal is on pace", () => {
    // 10:00 is 1/8 of the workday: on pace is 12.5 push-ups, 25 squats, 0.6 pull-ups.
    const desk: DeskSpec[] = [
      { ex: "desk_pushup", reps: 20, date: THU, time: "09:30" },
      { ex: "chair_squat", reps: 30, date: THU, time: "09:40" },
      { ex: "pullup_single", reps: 1, date: THU, time: "09:50" },
    ];
    expect(nudge("10:00", desk)).toBeNull();
  });

  it("counts rounds from today's desk sets", () => {
    const desk: DeskSpec[] = [{ ex: "desk_pushup", reps: 10, date: THU, time: "09:30" }];
    expect(nudge("13:00", desk)!.body).toMatch(/^ROUND 2:/);
  });
});
