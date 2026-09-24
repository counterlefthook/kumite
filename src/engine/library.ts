import type { Exercise, Library, Range, TemplateId } from "./types";

// Reads docs/exercise-library.json (passed in as plain data) and checks its shape,
// so a typo in the library fails loudly instead of mis-planning a workout.

const LOADS = ["dumbbell", "bodyweight", "band_assist", "hold"];
const PROGRESSIONS = ["pullup_stages", "none", "double_progression", "holds", "mini_sets"];
const GROUPS = ["push", "pull", "squat", "hinge", "core", "arms", "mixed"];

function fail(msg: string): never {
  throw new Error(`Exercise library: ${msg}`);
}

function isRange(v: unknown): v is Range {
  return Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && n > 0) && v[0] <= v[1];
}

export function parseLibrary(raw: unknown): Library {
  if (!raw || typeof raw !== "object") fail("not an object");
  const lib = raw as Library;
  if (!lib.ladders || typeof lib.ladders !== "object") fail("missing ladders");
  if (!Array.isArray(lib.exercises)) fail("missing exercises");

  for (const [id, ladder] of Object.entries(lib.ladders)) {
    if (!GROUPS.includes(ladder.group)) fail(`ladder ${id} has unknown group ${ladder.group}`);
    if (!PROGRESSIONS.includes(ladder.progression)) fail(`ladder ${id} has unknown progression ${ladder.progression}`);
  }

  const ids = new Set<string>();
  for (const e of lib.exercises) {
    if (ids.has(e.id)) fail(`duplicate exercise ${e.id}`);
    ids.add(e.id);
    const ladder = lib.ladders[e.ladder];
    if (!ladder) fail(`${e.id} is on unknown ladder ${e.ladder}`);
    if (!LOADS.includes(e.load)) fail(`${e.id} has unknown load ${e.load}`);
    if (ladder.group !== "mixed" && e.group !== ladder.group) fail(`${e.id} group ${e.group} differs from its ladder`);
    if (!Number.isInteger(e.rung) || e.rung < 1) fail(`${e.id} has a bad rung`);
    if (e.reps !== null && !isRange(e.reps)) fail(`${e.id} has a bad rep range`);
    if (e.seconds !== null && !isRange(e.seconds)) fail(`${e.id} has a bad seconds range`);
    if (ladder.progression !== "mini_sets") {
      if ((e.reps === null) === (e.seconds === null)) fail(`${e.id} needs exactly one of reps or seconds`);
      if ((e.load === "hold") !== (e.seconds !== null)) fail(`${e.id}: holds use seconds, everything else reps`);
    }
    if (typeof e.cue !== "string" || !e.name) fail(`${e.id} is missing a name or cue`);
  }

  // Rungs on each ladder run 1, 2, 3... with no gaps.
  for (const ladder of Object.keys(lib.ladders)) {
    const rungs = lib.exercises.filter((e) => e.ladder === ladder).map((e) => e.rung).sort((a, b) => a - b);
    if (rungs.length === 0) fail(`ladder ${ladder} has no exercises`);
    rungs.forEach((r, i) => r !== i + 1 && fail(`ladder ${ladder} rungs are not 1..${rungs.length}`));
  }

  for (const t of ["A", "B"] as TemplateId[]) {
    const tpl = lib.templates?.[t];
    if (!tpl) fail(`missing template ${t}`);
    const used = [...tpl.pairs.flat(), tpl.finisher, ...tpl.optional_finisher];
    if (tpl.pairs.length !== 2 || tpl.pairs.some((p) => p.length !== 2)) fail(`template ${t} needs two pairs`);
    used.forEach((l) => lib.ladders[l] || fail(`template ${t} uses unknown ladder ${l}`));
    for (const [from, to] of Object.entries(lib.knee_swaps?.[t] ?? {})) {
      if (!tpl.pairs.flat().includes(from)) fail(`knee swap ${t}.${from} is not in template ${t}`);
      if (!lib.ladders[to]) fail(`knee swap ${t}.${from} goes to unknown ladder ${to}`);
    }
  }
  for (const [from, to] of Object.entries(lib.knee_swaps?.desk ?? {})) {
    if (!ids.has(from) || !ids.has(to)) fail(`desk knee swap ${from} -> ${to} names an unknown exercise`);
  }
  return lib;
}

export function exerciseById(lib: Library, id: string): Exercise {
  const e = lib.exercises.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown exercise ${id}`);
  return e;
}

/** Exercises on a ladder, easiest first. */
export function ladderExercises(lib: Library, ladder: string): Exercise[] {
  return lib.exercises.filter((e) => e.ladder === ladder).sort((a, b) => a.rung - b.rung);
}

export function exerciseAt(lib: Library, ladder: string, rung: number): Exercise {
  const e = ladderExercises(lib, ladder).find((x) => x.rung === rung);
  if (!e) throw new Error(`Ladder ${ladder} has no rung ${rung}`);
  return e;
}

export function lastRung(lib: Library, ladder: string): number {
  return ladderExercises(lib, ladder).length;
}
