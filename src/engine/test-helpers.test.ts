import { expect, it } from "vitest";
import { localDate, localMinutes } from "./calendar";
import { at, ZONE } from "./test-helpers";
it("the test helper at() reads wall-clock time in Chicago, not UTC", () => {
  expect(at("2026-10-01", "11:00").toISOString()).toBe("2026-10-01T16:00:00.000Z");
  expect(localMinutes(at("2026-10-01", "11:00"), ZONE)).toBe(660);
  expect(at("2026-11-02", "00:00").toISOString()).toBe("2026-11-02T06:00:00.000Z");
  expect(localDate(at("2026-11-01", "23:59"), ZONE)).toBe("2026-11-01");
});
