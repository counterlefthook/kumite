import { dayIndex, localDate } from "./calendar";
import { deskBreak } from "./desk";
import {
  applyLegCap,
  kneeSwapActive,
  legCapReason,
  recoveryCheck,
  squeezeFor,
  strengthYesterday,
} from "./guardrails";
import { hardSetsThisWeek, paceRanking } from "./pacing";
import { sessionsInOrder } from "./progression";
import { maxTestStatus, pullupState } from "./pullups";
import { targetsFor } from "./targets";
import { buildTimeBox, slotLadder, type SessionContext } from "./timebox";
import type { CheckIn, Equipment, History, Library, Profile, Suggestion, TargetGroup, TemplateId, TimeBox } from "./types";

// The single entry point: today's suggestion, with a plain-language reason for
// every adjustment (PLAN, Engine rules, "Choosing today's suggestion").

export interface GenerateInput {
  now: Date;
  library: Library;
  profile: Profile;
  equipment: Equipment;
  history: History;
  /**
   * Optional. Version 0.1 has no check-in (decided 2026-09-24): without one,
   * the recovery check, leg cap, and check-in knee swap are skipped.
   */
  checkIn: CheckIn | null;
  timeBox: TimeBox;
  /** "Train anyway" after strength yesterday; logged as override = true. */
  trainAnyway?: boolean;
}

/**
 * A if no strength session exists yet, otherwise the opposite of the most recent
 * one. Calibration sessions count as their template's first session.
 * Alternation ignores week boundaries.
 */
export function nextTemplate(history: History, now: Date): TemplateId {
  const last = sessionsInOrder(history, now)
    .filter((s) => (s.kind === "strength" || s.kind === "calibration") && s.template)
    .at(-1);
  if (!last) return "A";
  return last.template === "A" ? "B" : "A";
}

function roundsReason(week: number, rounds: number, holding: boolean): string | null {
  if (week <= 2) return `${rounds} rounds per pair in week ${week} while soreness settles.`;
  if (week >= 5 && holding) return `${rounds} rounds per pair: recovery has held over the last two weeks.`;
  if (week >= 5) return `${rounds} rounds per pair: recovery has not held over the last two weeks.`;
  return null;
}

export function generate(input: GenerateInput): Suggestion {
  const { now, library: lib, profile, equipment, history, checkIn } = input;
  const zone = profile.timezone;

  if (input.timeBox === "desk") return deskBreak(lib, profile, history, now, checkIn?.kneePain ?? null);
  const recovery = checkIn ? recoveryCheck(checkIn) : null;
  if (recovery) return { kind: "recovery", options: ["ride_zone2_30", "mobility_15"], reasons: [recovery] };

  const reasons: string[] = [];
  let box: 10 | 20 | 30 = input.timeBox;
  let override = false;
  if (strengthYesterday(history, now, zone)) {
    const squeeze = squeezeFor(history, now, zone);
    if (squeeze.active) {
      if (box === 30) box = 20;
      reasons.push(
        `Strength on back-to-back days in the 20-minute box: ${squeeze.strengthLeft} strength sessions left and ${squeeze.daysLeft} days in the week.`,
      );
    } else if (input.trainAnyway) {
      override = true;
      reasons.push("Training anyway after strength yesterday.");
    } else {
      return {
        kind: "rest_day",
        options: ["ride", "mobility", "desk_sets"],
        canTrainAnyway: true,
        reasons: ["Strength yesterday: leave a day between strength sessions."],
      };
    }
  }

  const template = nextTemplate(history, now);
  const targets = targetsFor(history.sessions, now, profile.programStartDate, zone);
  const rr = roundsReason(targets.week, targets.rounds, targets.holding);
  if (rr) reasons.push(rr);

  const done = hardSetsThisWeek(history, lib, now, zone);
  const deficits = Object.fromEntries(
    paceRanking(targets.hardSets, dayIndex(now, zone), done).map((r) => [r.group, r.deficit]),
  ) as Record<TargetGroup, number>;

  const pullups = pullupState(equipment, history, now, zone);
  const ctx: SessionContext = {
    lib,
    equipment,
    history,
    now,
    zone,
    template,
    rounds: targets.rounds,
    kneeSwap: checkIn ? kneeSwapActive(checkIn) : false,
    pullups,
    deficits,
  };
  const built = buildTimeBox(ctx, box);
  reasons.push(...built.reasons);
  let blocks = built.blocks;

  if (checkIn && ctx.kneeSwap) {
    for (const [from, to] of Object.entries(lib.knee_swaps[template])) {
      if (slotLadder(ctx, from) !== to) continue;
      const swapped = blocks.flatMap((b) => b.exercises).find((e) => e.ladder === to);
      if (swapped) {
        reasons.push(
          `Knee pain ${checkIn.kneePain} of 10: the squat slot is ${swapped.name} today (counts toward ${swapped.group}).`,
        );
      }
    }
  }

  const cap = checkIn ? legCapReason(checkIn) : null;
  if (cap) {
    blocks = blocks.map((b) => ({ ...b, exercises: b.exercises.map(applyLegCap) }));
    reasons.push(cap);
  }

  for (const e of blocks.flatMap((b) => (b.kind === "emom" ? [] : b.exercises))) {
    if (e.ladder !== "pullup" && e.sets > targets.rounds) {
      reasons.push(`${e.name}: ${e.sets} sets, since the top of its ladder is done.`);
    }
  }

  return {
    kind: "strength",
    template,
    timeBox: box,
    programWeek: targets.week,
    rounds: targets.rounds,
    blocks,
    override,
    maxTest: maxTestStatus(pullups.lastMaxTestDate, localDate(now, zone)),
    reasons,
  };
}
