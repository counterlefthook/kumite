import { addLocalDays, dayIndex, localDate, weekStart } from "./calendar";
import type { CheckIn, History, Prescription } from "./types";

// Guardrails (PLAN, Engine rules, "Choosing today's suggestion", steps 1, 2, 5, 6).

/**
 * Upper-body soreness of 4 or more, or energy of 2 or less, swaps strength for a
 * ride or mobility. Sore legs alone get the leg cap instead (decided 2026-09-24).
 */
export function recoveryCheck(c: CheckIn): string | null {
  const reasons: string[] = [];
  if (c.sorenessUpper >= 4) reasons.push(`upper-body soreness ${c.sorenessUpper} of 5`);
  if (c.energy <= 2) reasons.push(`energy ${c.energy} of 5`);
  return reasons.length ? `Easy day instead of strength: ${reasons.join(" and ")}.` : null;
}

function strengthDates(history: History, now: Date, zone: string): string[] {
  return history.sessions
    .filter((s) => s.kind === "strength" && new Date(s.startedAt) <= now)
    .map((s) => localDate(s.startedAt, zone));
}

export function strengthYesterday(history: History, now: Date, zone: string): boolean {
  const yesterday = addLocalDays(localDate(now, zone), -1);
  return strengthDates(history, now, zone).includes(yesterday);
}

export function strengthSessionsThisWeek(history: History, now: Date, zone: string): number {
  const week = weekStart(now, zone);
  return history.sessions.filter(
    (s) => s.kind === "strength" && new Date(s.startedAt) <= now && weekStart(s.startedAt, zone) === week,
  ).length;
}

export interface Squeeze {
  active: boolean;
  strengthLeft: number;
  daysLeft: number;
}

/**
 * With strength_left = 3 - strength sessions this week and days_left counting
 * today, the week is short when 2 x strength_left - 1 > days_left.
 */
export function quotaSqueeze(strengthThisWeek: number, dayIdx: number): Squeeze {
  const strengthLeft = Math.max(0, 3 - strengthThisWeek);
  const daysLeft = 7 - dayIdx + 1;
  return { active: 2 * strengthLeft - 1 > daysLeft, strengthLeft, daysLeft };
}

export function squeezeFor(history: History, now: Date, zone: string): Squeeze {
  return quotaSqueeze(strengthSessionsThisWeek(history, now, zone), dayIndex(now, zone));
}

/** Fight training within 24 hours, or leg soreness of 4 or more, caps squat and hinge work. */
export function legCapReason(c: CheckIn): string | null {
  if (c.fightNext24h) return "Legs capped at 2 sets, 2 or more reps in reserve: fight training in the next 24 hours.";
  if (c.sorenessLegs >= 4) return `Legs capped at 2 sets, 2 or more reps in reserve: leg soreness ${c.sorenessLegs} of 5.`;
  return null;
}

/** At most 2 sets, ending 2 or more reps short, for squat and hinge exercises. */
export function applyLegCap(p: Prescription): Prescription {
  if (p.group !== "squat" && p.group !== "hinge") return p;
  return { ...p, sets: Math.min(p.sets, 2), targetRir: { min: 2, max: null } };
}

/** Knee pain above 3 at check-in swaps the squat slot. */
export function kneeSwapActive(c: CheckIn): boolean {
  return c.kneePain > 3;
}
