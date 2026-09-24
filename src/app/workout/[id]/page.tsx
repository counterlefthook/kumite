import { notFound, redirect } from "next/navigation";
import { generate } from "@/engine/generate";
import { exerciseById } from "@/engine/library";
import { ladderState, prescribe } from "@/engine/progression";
import type { History, Prescription } from "@/engine/types";
import { LIBRARY, loadAll } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { rangeLabel } from "@/lib/view";
import { ErrorNote, Title } from "@/components/ui";
import { WorkoutLogger, type BlockView, type ExerciseView } from "./logger";

const BLOCK_TITLES = { pair: "PAIR", pullup_extra: "NEGATIVES", finisher: "FINISHER", optional_finisher: "BONUS ROUND", emom: "EMOM" } as const;

export default async function Workout({ params, searchParams }: PageProps<"/workout/[id]">) {
  const { id } = await params;
  const { error } = await searchParams;
  const data = await loadAll();
  if (!data?.profile || !data.equipment) redirect("/");
  const session = data.history.sessions.find((s) => s.id === id && s.kind === "strength");
  if (!session) notFound();

  const supabase = await createClient();
  const { data: row } = await supabase.from("sessions_current").select("time_box").eq("id", id).maybeSingle();
  const timeBox = row?.time_box === "20" ? 20 : 30;

  // The plan as it stood when the session started, so logging sets does not move the targets.
  const started = new Date(session.startedAt);
  const earlier = new Set(data.history.sessions.filter((s) => new Date(s.startedAt) < started).map((s) => s.id));
  const before: History = {
    sessions: data.history.sessions.filter((s) => earlier.has(s.id)),
    sets: data.history.sets.filter((x) => earlier.has(x.sessionId)),
    deskSets: [],
  };
  const plan = generate({
    now: started,
    library: LIBRARY,
    profile: data.profile,
    equipment: data.equipment,
    history: before,
    checkIn: null,
    timeBox,
    trainAnyway: true,
  });
  if (plan.kind !== "strength") notFound();

  const logged = data.history.sets.filter((x) => x.sessionId === id);
  const template = session.template ?? plan.template;

  function view(p: Prescription): ExerciseView {
    const ex = exerciseById(LIBRARY, p.exerciseId);
    const flagged = ex.group === "squat" && logged.some((x) => x.exerciseId === p.exerciseId && x.kneeFlag);
    let target = p;
    let note: string | undefined;
    if (flagged) {
      const swapLadder = LIBRARY.knee_swaps[template][ex.ladder];
      if (swapLadder) {
        target = { ...prescribe(LIBRARY, ladderState(LIBRARY, data!.equipment!, before, swapLadder, started), p.sets), sets: p.sets };
        note = `Knee flagged: finish with ${target.name}.`;
      }
    }
    const sets = Array.from({ length: p.sets }, (_, i) => {
      const index = i + 1;
      const done = logged.find((x) => x.setIndex === index && (x.exerciseId === p.exerciseId || x.exerciseId === target.exerciseId));
      return {
        index,
        logged: done
          ? { weight: done.weightLb, reps: done.reps, seconds: done.seconds, rir: done.rir, band: done.band, knee: done.kneeFlag }
          : null,
      };
    });
    return {
      key: p.exerciseId,
      exerciseId: target.exerciseId,
      name: target.name,
      cue: target.cue,
      loadKind: target.load.kind,
      weight: target.load.kind === "dumbbell" ? target.load.lb : null,
      band: target.load.kind === "band" ? target.load.band : null,
      reps: target.reps ? [target.reps[0], target.reps[1]] : null,
      seconds: target.seconds ? [target.seconds[0], target.seconds[1]] : null,
      target: rangeLabel(target.reps, target.seconds),
      rirLabel: target.load.kind === "hold" ? "" : target.targetRir.max === null ? `${target.targetRir.min}+ in reserve` : `${target.targetRir.min}-${target.targetRir.max} in reserve`,
      squat: exerciseById(LIBRARY, target.exerciseId).group === "squat" && !flagged,
      note,
      sets,
    };
  }

  let pairNo = 0;
  const blocks: BlockView[] = plan.blocks.map((b, i) => {
    if (b.kind === "pair") pairNo++;
    return {
      key: `${b.kind}-${i}`,
      title: b.kind === "pair" ? `PAIR ${pairNo}` : BLOCK_TITLES[b.kind],
      meta: b.kind === "pair" ? "Superset, rest 75 s" : b.kind === "optional_finisher" ? "Optional arms" : "",
      optional: b.kind === "optional_finisher",
      exercises: b.exercises.map(view),
    };
  });

  return (
    <>
      <Title sub={`HOME WORKOUT ${template} / ${timeBox} MIN`} />
      <ErrorNote message={typeof error === "string" ? error : null} />
      <WorkoutLogger
        sessionId={id}
        settings={data.equipment.dumbbellSettingsLb}
        bands={data.equipment.bands}
        blocks={blocks}
      />
    </>
  );
}
