import { isTargetGroup } from "./pacing";
import { ladderState, prescribe } from "./progression";
import { prescribePullups, type PullupState } from "./pullups";
import type { Block, Equipment, History, Library, Prescription, TargetGroup, TemplateId } from "./types";

// Time boxes (PLAN, Engine rules, "Choosing today's suggestion", step 4).

export const DEFAULT_REST_SEC = 75;
export const EMOM_MINUTES = 10;
export const EMOM_SETS = 5;

export interface SessionContext {
  lib: Library;
  equipment: Equipment;
  history: History;
  now: Date;
  zone: string;
  template: TemplateId;
  rounds: number;
  kneeSwap: boolean;
  pullups: PullupState;
  deficits: Record<TargetGroup, number>;
}

/** The ladder that fills a template slot today, after any knee swap. */
export function slotLadder(ctx: SessionContext, ladder: string): string {
  return ctx.kneeSwap ? (ctx.lib.knee_swaps[ctx.template][ladder] ?? ladder) : ladder;
}

function prescribeSlot(ctx: SessionContext, ladder: string, rounds: number): { main: Prescription; extra: Prescription | null } {
  if (ladder === "pullup") return prescribePullups(ctx.lib, ctx.pullups, rounds, ctx.now, ctx.zone);
  const state = ladderState(ctx.lib, ctx.equipment, ctx.history, ladder, ctx.now);
  return { main: prescribe(ctx.lib, state, rounds), extra: null };
}

function pairBlocks(ctx: SessionContext, pair: [string, string]): Block[] {
  const slots = pair.map((l) => prescribeSlot(ctx, slotLadder(ctx, l), ctx.rounds));
  const blocks: Block[] = [{ kind: "pair", exercises: slots.map((s) => s.main), restAfterSec: DEFAULT_REST_SEC }];
  for (const s of slots) {
    if (s.extra) blocks.push({ kind: "pullup_extra", exercises: [s.extra], restAfterSec: DEFAULT_REST_SEC });
  }
  return blocks;
}

/** Combined deficit of a pair's two groups (core and arms count as 0). */
export function pairDeficit(ctx: SessionContext, pair: [string, string]): number {
  return pair
    .map((l) => ctx.lib.ladders[slotLadder(ctx, l)].group)
    .reduce((sum, g) => sum + (isTargetGroup(g) ? ctx.deficits[g] : 0), 0);
}

export function buildTimeBox(ctx: SessionContext, box: 10 | 20 | 30): { blocks: Block[]; reasons: string[] } {
  const tpl = ctx.lib.templates[ctx.template];
  const [pair1, pair2] = tpl.pairs;

  if (box === 10) {
    // Pair 2 only when it is strictly further behind; a tie keeps pair 1.
    const usePair2 = pairDeficit(ctx, pair2) > pairDeficit(ctx, pair1);
    const pair = usePair2 ? pair2 : pair1;
    const exercises = pair.map((l) => ({ ...prescribeSlot(ctx, slotLadder(ctx, l), EMOM_SETS).main, sets: EMOM_SETS }));
    const groups = exercises.map((e) => e.group).join(" and ");
    return {
      blocks: [{ kind: "emom", exercises, restAfterSec: null, minutes: EMOM_MINUTES }],
      reasons: [`10-minute EMOM on pair ${usePair2 ? 2 : 1} (${groups}): the pair furthest behind this week's pace.`],
    };
  }

  const blocks = [...pairBlocks(ctx, pair1), ...pairBlocks(ctx, pair2)];
  if (box === 20) return { blocks, reasons: [] };

  const finisher = prescribeSlot(ctx, tpl.finisher, ctx.rounds).main;
  const arms = tpl.optional_finisher.map((l) => prescribeSlot(ctx, l, ctx.rounds).main);
  blocks.push({ kind: "finisher", exercises: [finisher], restAfterSec: DEFAULT_REST_SEC });
  blocks.push({ kind: "optional_finisher", exercises: arms, restAfterSec: DEFAULT_REST_SEC });
  return { blocks, reasons: [] };
}
