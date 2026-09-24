import { addLocalDays, isWorkday, localDate } from "./calendar";
import { deskTargetsMet } from "./desk";
import { sessionsInOrder, setsBySession } from "./progression";
import type { BodyMetric, History, Library, Profile, SessionLog } from "./types";

// Derived metrics (PLAN, Engine rules, "Derived metrics").

/** Estimated 1-rep max (Epley): weight x (1 + reps / 30). */
export function epley(weightLb: number, reps: number): number {
  return weightLb * (1 + reps / 30);
}

/** The best Epley estimate per session for one exercise. Compare only within that exercise. */
export function e1rmHistory(history: History, exerciseId: string): { sessionId: string; startedAt: string; e1rm: number }[] {
  const bySession = setsBySession(history);
  const rows = [];
  for (const s of sessionsInOrder(history)) {
    const estimates = (bySession.get(s.id) ?? [])
      .filter((x) => x.exerciseId === exerciseId && x.weightLb !== null && x.reps !== null && x.reps > 0)
      .map((x) => epley(x.weightLb as number, x.reps as number));
    if (estimates.length) rows.push({ sessionId: s.id, startedAt: s.startedAt, e1rm: Math.max(...estimates) });
  }
  return rows;
}

function weighIns(metrics: BodyMetric[], now: Date) {
  return metrics
    .filter((m) => m.kind === "weight_lb" && new Date(m.measuredAt) <= now)
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
}

/** Mean of weigh-ins over the 7 local days ending today; null with fewer than 3. */
export function sevenDayAverageWeight(metrics: BodyMetric[], now: Date, zone: string): number | null {
  const today = localDate(now, zone);
  const from = addLocalDays(today, -6);
  const values = weighIns(metrics, now)
    .filter((m) => {
      const d = localDate(m.measuredAt, zone);
      return d >= from && d <= today;
    })
    .map((m) => m.value);
  if (values.length < 3) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const LB_TO_KG = 0.45359237;

// MET value from the 2024 Adult Compendium of Physical Activities (Sports):
//   15430  Martial arts, different types, moderate pace (e.g. judo, jujitsu,
//          karate, kick boxing, tae kwon do, tai-bo, Muay Thai boxing)  MET 10.3
// Every fight session uses it, whatever the effort (decided 2026-09-24).
export const FIGHT_MET = { code: "15430", met: 10.3 } as const;

/**
 * Fight session calories: MET x body weight in kg x hours, using the 7-day
 * average weight or, failing that, the latest weigh-in. Null with no weight.
 */
export function fightCalories(session: SessionLog, metrics: BodyMetric[], now: Date, zone: string): number | null {
  if (session.kind !== "fight" || !session.minutes) return null;
  const weightLb = sevenDayAverageWeight(metrics, now, zone) ?? weighIns(metrics, now).at(-1)?.value ?? null;
  if (weightLb === null) return null;
  return FIGHT_MET.met * weightLb * LB_TO_KG * (session.minutes / 60);
}

/**
 * Consecutive workdays with every desk target met. Weekends are skipped, and
 * today counts only once its targets are met (an unfinished today does not
 * break the streak).
 */
export function deskStreak(lib: Library, profile: Profile, history: History, now: Date): number {
  const zone = profile.timezone;
  const today = localDate(now, zone);
  const earliest = history.deskSets.map((d) => localDate(d.loggedAt, zone)).sort()[0];
  if (!earliest) return 0;
  let streak = 0;
  for (let d = today; d >= earliest; d = addLocalDays(d, -1)) {
    if (!isWorkday(d)) continue;
    if (deskTargetsMet(lib, profile, history, d)) streak++;
    else if (d !== today) break;
  }
  return streak;
}
