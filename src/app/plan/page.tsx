import { redirect } from "next/navigation";
import { startWorkout } from "@/app/actions";
import { noGymPlan } from "@/engine/day";
import { generate } from "@/engine/generate";
import { strengthSessionsThisWeek } from "@/engine/guardrails";
import { LIBRARY, loadAll } from "@/lib/data";
import { loadLabel, rangeLabel } from "@/lib/view";
import { Announce, BackLink, BigButton, BigLink, ErrorNote, Panel, Title } from "@/components/ui";

export default async function Plan({ searchParams }: PageProps<"/plan">) {
  const data = await loadAll();
  if (!data?.profile || !data.equipment) redirect("/");
  const now = new Date();
  const plan = noGymPlan(data.history, data.profile, now);
  const { error } = await searchParams;

  if (plan.kind === "peloton") {
    return (
      <>
        <Title />
        <Announce>PELOTON</Announce>
        <Panel>
          <p className="m-0 text-[20px] font-bold">{plan.minutesLeft} minutes to go this week.</p>
          <p className="m-0 text-[16px] text-dust">{plan.reason} A class or a ride both count.</p>
        </Panel>
        <BigLink href="/log#peloton">LOG PELOTON</BigLink>
        <BackLink />
      </>
    );
  }
  if (plan.kind === "rest") {
    return (
      <>
        <Title />
        <Announce>REST</Announce>
        <Panel>
          <p className="m-0 text-[18px]">{plan.reason}</p>
        </Panel>
        <BigLink href="/" tone="stone">DESK SETS</BigLink>
        <BackLink />
      </>
    );
  }

  const s = generate({
    now,
    library: LIBRARY,
    profile: data.profile,
    equipment: data.equipment,
    history: data.history,
    checkIn: null,
    timeBox: plan.timeBox,
    trainAnyway: true,
  });
  if (s.kind !== "strength") redirect("/");
  const round = strengthSessionsThisWeek(data.history, now, data.profile.timezone) + 1;
  const rows = s.blocks
    .filter((b) => b.kind !== "optional_finisher")
    .flatMap((b) => b.exercises)
    .map((e) => ({
      id: e.exerciseId,
      name: e.name,
      detail:
        e.exerciseId === "pullup_negative"
          ? "3 slow reps, 3-5 s down"
          : `${loadLabel(e.load)}, ${e.sets} x ${rangeLabel(e.reps, e.seconds)}`,
    }));

  return (
    <>
      <Title />
      <div className="flex flex-col items-center gap-1">
        <Announce>ROUND {round}</Announce>
        <p className="m-0 text-[18px] font-bold text-gold-100">OK, here&apos;s what we&apos;re going to do.</p>
      </div>
      <ErrorNote message={typeof error === "string" ? error : null} />
      <section className="flex flex-col border-[3px] border-gold-300 bg-stone-950/85">
        <div className="flex items-baseline justify-between border-b-2 border-[#5c3a0c] px-3.5 py-3">
          <span className="font-display text-[17px] font-black tracking-[0.06em] text-gold-300">HOME WORKOUT {s.template}</span>
          <span className="text-[15px] text-dust">{s.timeBox} min</span>
        </div>
        {rows.map((r) => (
          <div key={r.id} className="flex min-h-[60px] flex-col justify-center gap-0.5 border-b border-[#3a2410] px-3.5 py-2 last:border-b-0">
            <span className="text-[18px] font-bold">{r.name}</span>
            <span className="text-[15px] text-dust">{r.detail}</span>
          </div>
        ))}
      </section>
      {s.reasons.length ? <p className="m-0 text-[15px] text-dust">{s.reasons.join(" ")}</p> : null}
      <p className="m-0 text-[15px] text-dust">{plan.reason}</p>
      <form action={startWorkout}>
        <input type="hidden" name="template" value={s.template} />
        <input type="hidden" name="time_box" value={s.timeBox} />
        <BigButton type="submit" className="min-h-[76px] text-[30px] tracking-[0.2em]">FIGHT</BigButton>
      </form>
      <BackLink />
    </>
  );
}
