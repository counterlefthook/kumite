import { describe, expect, it } from "vitest";
import rawLibrary from "../../docs/exercise-library.json";
import { exerciseAt, lastRung, parseLibrary } from "./library";

const copy = () => JSON.parse(JSON.stringify(rawLibrary));

describe("exercise library", () => {
  it("the real docs/exercise-library.json passes, with all 36 exercises", () => {
    expect(parseLibrary(copy()).exercises).toHaveLength(36);
  });

  it("looks up rungs", () => {
    const lib = parseLibrary(copy());
    expect(exerciseAt(lib, "bench", 2).id).toBe("db_incline_press");
    expect(lastRung(lib, "bench")).toBe(5);
  });

  it.each<[string, (lib: ReturnType<typeof copy>) => void, RegExp]>([
    ["an exercise on an unknown ladder", (l) => (l.exercises[0].ladder = "nope"), /unknown ladder/],
    ["a gap in a ladder's rungs", (l) => (l.exercises.find((e: { id: string }) => e.id === "db_incline_press").rung = 7), /rungs are not/],
    ["a duplicate exercise id", (l) => l.exercises.push({ ...l.exercises[0] }), /duplicate/],
    ["a backwards rep range", (l) => (l.exercises[3].reps = [12, 8]), /bad rep range/],
    ["a template using an unknown ladder", (l) => (l.templates.A.finisher = "nope"), /unknown ladder/],
    ["a knee swap to an unknown ladder", (l) => (l.knee_swaps.B.box_squat = "nope"), /unknown ladder/],
  ])("rejects %s", (_name, breakIt, message) => {
    const lib = copy();
    breakIt(lib);
    expect(() => parseLibrary(lib)).toThrow(message);
  });
});
