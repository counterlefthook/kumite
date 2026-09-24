import { describe, expect, it } from "vitest";
import { addLocalDays, daysBetween, dayIndex, localDate, programWeek, weekStart } from "./calendar";
import { ZONE } from "./test-helpers";

describe("required test 14: week boundaries in America/Chicago", () => {
  it.each([
    ["Sunday 23:59 (summer time) is day 7 of the old week", "2026-09-27T23:59:00-05:00", "2026-09-27", 7, "2026-09-21"],
    ["Monday 00:00 (summer time) is day 1 of the new week", "2026-09-28T00:00:00-05:00", "2026-09-28", 1, "2026-09-28"],
    [
      "Sunday 23:59 on the day clocks go back is still the old week",
      "2026-11-01T23:59:00-06:00",
      "2026-11-01",
      7,
      "2026-10-26",
    ],
    ["the following Monday 00:00 (standard time) starts the new week", "2026-11-02T00:00:00-06:00", "2026-11-02", 1, "2026-11-02"],
    ["an instant stored in UTC is read in Chicago time", "2026-11-02T05:59:00Z", "2026-11-01", 7, "2026-10-26"],
    ["late Sunday evening UTC is still Sunday in Chicago", "2026-09-28T03:00:00Z", "2026-09-27", 7, "2026-09-21"],
    ["Sunday 23:59 when clocks go forward is still the old week", "2027-03-14T23:59:00-05:00", "2027-03-14", 7, "2027-03-08"],
  ])("%s", (_name, instant, date, day, monday) => {
    expect(localDate(instant, ZONE)).toBe(date);
    expect(dayIndex(instant, ZONE)).toBe(day);
    expect(weekStart(instant, ZONE)).toBe(monday);
  });

  it("the week that crosses the clock change is 7 calendar days long", () => {
    expect(daysBetween("2026-10-26", "2026-11-02")).toBe(7);
    expect(addLocalDays("2026-10-31", 2)).toBe("2026-11-02");
  });
});

describe("program week", () => {
  // Start on a Wednesday: its whole Monday-to-Sunday week is week 1.
  it.each([
    ["the Monday before a Wednesday start is week 1", "2026-09-28T08:00:00-05:00", 1],
    ["Sunday 23:59 of the start week is week 1", "2026-10-04T23:59:00-05:00", 1],
    ["the next Monday 00:00 is week 2", "2026-10-05T00:00:00-05:00", 2],
    ["dates before the start count as week 1", "2026-09-01T12:00:00-05:00", 1],
    ["the week holding the clock change is week 5", "2026-11-01T23:59:00-06:00", 5],
    ["the Monday after it is week 6", "2026-11-02T00:00:00-06:00", 6],
  ])("%s", (_name, instant, week) => expect(programWeek(instant, "2026-09-30", ZONE)).toBe(week));
});
