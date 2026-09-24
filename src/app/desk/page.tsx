import { redirect } from "next/navigation";
import { logDesk } from "@/app/actions";
import { deskBreak } from "@/engine/desk";
import { exerciseById } from "@/engine/library";
import { LIBRARY, loadAll } from "@/lib/data";
import { BackLink, BigButton, ErrorNote, Title } from "@/components/ui";

export default async function Desk({ searchParams }: PageProps<"/desk">) {
  const data = await loadAll();
  if (!data?.profile) redirect("/");
  const s = deskBreak(LIBRARY, data.profile, data.history, new Date(), null);
  if (s.kind !== "desk_break") redirect("/");
  const ex = exerciseById(LIBRARY, s.exerciseId);
  const reps = s.reps ?? 1;
  const { error } = await searchParams;

  return (
    <>
      <Title />
      <ErrorNote message={typeof error === "string" ? error : null} />
      <section className="flex flex-col items-center gap-2.5 border-[3px] border-gold-300 bg-stone-950/80 px-4 py-6 text-center">
        <span className="font-display text-[15px] font-bold tracking-[0.25em] text-gold-300">DO THIS</span>
        <span className="announce text-[88px] leading-none">{reps}</span>
        <span className="font-display text-[30px] font-black uppercase text-gold-100">{ex.name}</span>
        <span className="text-[16px] text-dust">{s.reasons.join(" ")}</span>
        {ex.cue ? <span className="text-[15px] text-ash">{ex.cue}</span> : null}
      </section>
      <form action={logDesk}>
        <input type="hidden" name="exercise_id" value={ex.id} />
        <input type="hidden" name="reps" value={reps} />
        <BigButton type="submit" className="min-h-[80px] text-[30px]">DONE</BigButton>
      </form>
      <BackLink />
    </>
  );
}
