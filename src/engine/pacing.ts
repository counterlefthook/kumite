import { weekStart } from "./calendar";
import { exerciseById } from "./library";
import type { History, Library, SessionLog, SetLog, TargetGroup } from "./types";

export const TARGET_GROUPS: TargetGroup[] = ["squat", "pull", "hinge", "push"];
/** Tie-break order when deficits are equal. */
export const TIE_ORDER: TargetGroup[] = ["squat", "pull", "hinge", "push"];

export function isTargetGroup(g: string): g is TargetGroup {
  return (TARGET_GROUPS as string[]).includes(g);
}

/** A hard set is a working set in a strength session with 3 or fewer reps in reserve. */
export function isHardSet(set: SetLog, session: SessionLog): boolean {
  return session.kind === "strength" && set.rir !== null && set.rir <= 3;
}

export function hardSetsThisWeek(
  history: History,
  lib: Library,
  now: Date,
  zone: string,
): Record<TargetGroup, number> {
  const week = weekStart(now, zone);
  const counts: Record<TargetGroup, number> = { squat: 0, pull: 0, hinge: 0, push: 0 };
  const sessions = new Map(
    history.sessions
      .filter((s) => s.kind === "strength" && weekStart(s.startedAt, zone) === week && new Date(s.startedAt) <= now)
      .map((s) => [s.id, s]),
  );
  for (const set of history.sets) {
    const session = sessions.get(set.sessionId);
    if (!session || !isHardSet(set, session)) continue;
    const group = exerciseById(lib, set.exerciseId).group;
    if (isTargetGroup(group)) counts[group]++;
  }
  return counts;
}

export interface PaceRow {
  group: TargetGroup;
  pace: number;
  done: number;
  deficit: number;
}

/**
 * pace = target x day_index / 7, deficit = pace - hard sets logged this week.
 * Largest deficit first; ties in the order squat, pull, hinge, push.
 */
export function paceRanking(target: number, dayIdx: number, done: Record<TargetGroup, number>): PaceRow[] {
  const pace = (target * dayIdx) / 7;
  return TARGET_GROUPS.map((group) => ({ group, pace, done: done[group], deficit: pace - done[group] })).sort(
    (a, b) => b.deficit - a.deficit || TIE_ORDER.indexOf(a.group) - TIE_ORDER.indexOf(b.group),
  );
}
