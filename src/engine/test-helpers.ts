// Builders for engine tests: a real library, sample settings, and short fake
// histories. Only test files import this.

import { TZDate } from "@date-fns/tz";
import rawLibrary from "../../docs/exercise-library.json";
import { parseLibrary } from "./library";
import type {
  BodyMetric,
  CheckIn,
  DeskSetLog,
  Equipment,
  History,
  Profile,
  SessionKind,
  SetLog,
  TemplateId,
} from "./types";

export const ZONE = "America/Chicago";
export const LIB = parseLibrary(rawLibrary);

/** An adjustable pair from 5 to 55 lb in 5 lb steps. */
export const EQUIPMENT: Equipment = {
  dumbbellSettingsLb: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
  bands: ["black", "red", "green", "yellow"],
};

/** Program week 1 starts Monday 2026-09-28. */
export const PROFILE: Profile = {
  programStartDate: "2026-09-28",
  workStart: "09:00",
  workEnd: "17:00",
  deskTargets: { pushupsPerDay: 100, chairSquatsPerHour: 25, pullupSinglesPerDay: 5 },
  pelotonMinutesWeek: 60,
  homeWorkoutsWeek: 3,
  timezone: ZONE,
};

export const CALM: CheckIn = { sorenessLegs: 2, sorenessUpper: 2, energy: 4, kneePain: 0, fightNext24h: false };

/** A Chicago wall-clock time as a Date, e.g. at("2026-09-28", "18:00"). */
export function at(date: string, time = "18:00"): Date {
  return new Date(new TZDate(`${date}T${time}:00`, ZONE).getTime());
}

export interface SetSpec {
  w?: number;
  reps?: number;
  rir?: number;
  sec?: number;
  band?: string;
  knee?: boolean;
}

/** n identical sets. */
export function times(n: number, spec: SetSpec): SetSpec[] {
  return Array.from({ length: n }, () => ({ ...spec }));
}

export interface SessionSpec {
  kind?: SessionKind;
  date: string;
  time?: string;
  template?: TemplateId | null;
  checkIn?: CheckIn | null;
  minutes?: number;
  effort?: number;
  sets?: Record<string, SetSpec[]>;
}

export interface DeskSpec {
  ex: string;
  reps: number;
  date: string;
  time?: string;
}

export function makeHistory(sessions: SessionSpec[], desk: DeskSpec[] = []): History {
  const setRows: SetLog[] = [];
  const sessionRows = sessions.map((s, i) => {
    const id = `s${i + 1}`;
    for (const [exerciseId, specs] of Object.entries(s.sets ?? {})) {
      specs.forEach((x, j) =>
        setRows.push({
          id: `${id}-${exerciseId}-${j}`,
          sessionId: id,
          exerciseId,
          setIndex: setRows.length,
          weightLb: x.w ?? null,
          band: x.band ?? null,
          reps: x.reps ?? null,
          seconds: x.sec ?? null,
          rir: x.rir ?? null,
          kneeFlag: x.knee ?? false,
        }),
      );
    }
    return {
      id,
      kind: s.kind ?? "strength",
      template: s.template ?? null,
      startedAt: at(s.date, s.time).toISOString(),
      minutes: s.minutes ?? null,
      checkIn: s.checkIn ?? null,
      effort: s.effort ?? null,
      override: false,
    };
  });
  const deskRows: DeskSetLog[] = desk.map((d, i) => ({
    id: `d${i + 1}`,
    exerciseId: d.ex,
    reps: d.reps,
    seconds: null,
    loggedAt: at(d.date, d.time ?? "10:00").toISOString(),
  }));
  return { sessions: sessionRows, sets: setRows, deskSets: deskRows };
}

export function weighIn(date: string, value: number, time = "07:00"): BodyMetric {
  return { kind: "weight_lb", value, measuredAt: at(date, time).toISOString() };
}
