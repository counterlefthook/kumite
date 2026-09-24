import { redirect } from "next/navigation";
import { logBody, logPeloton } from "@/app/actions";
import { localDate } from "@/engine/calendar";
import { fightCalories, sevenDayAverageWeight } from "@/engine/metrics";
import { loadAll } from "@/lib/data";
import { BackLink, BigButton, ErrorNote, Field, inputClass, Panel, Title } from "@/components/ui";
import { FightForm } from "@/components/fight-form";

export default async function Log({ searchParams }: PageProps<"/log">) {
  const data = await loadAll();
  if (!data?.profile) redirect("/");
  const { error } = await searchParams;
  const now = new Date();
  const zone = data.profile.timezone;
  const avg = sevenDayAverageWeight(data.metrics, now, zone);
  const fights = data.history.sessions.filter((s) => s.kind === "fight").slice(-3).reverse();

  return (
    <>
      <Title sub="LOG" />
      <ErrorNote message={typeof error === "string" ? error : null} />

      <Panel title="PELOTON" className="scroll-mt-4">
        <form id="peloton" action={logPeloton} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select name="peloton_type" defaultValue="ride" className={inputClass}>
                <option value="ride">Ride</option>
                <option value="class">Class</option>
              </select>
            </Field>
            <Field label="Minutes">
              <input name="minutes" type="number" inputMode="numeric" min={1} max={600} defaultValue={30} required className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Output (kJ)" hint="Rides, optional">
              <input name="output_kj" type="number" inputMode="decimal" min={0} className={inputClass} />
            </Field>
            <Field label="Calories" hint="Peloton's figure, optional">
              <input name="kcal" type="number" inputMode="decimal" min={0} className={inputClass} />
            </Field>
          </div>
          <BigButton type="submit">LOG PELOTON</BigButton>
        </form>
      </Panel>

      <Panel title="FIGHT CLASS">
        <FightForm from="/log" />
        {fights.length ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[15px] text-dust">
            {fights.map((f) => {
              const kcal = fightCalories(f, data.metrics, now, zone);
              return (
                <li key={f.id}>
                  {localDate(f.startedAt, zone)}: {f.minutes} min{kcal ? `, about ${Math.round(kcal)} kcal` : ""}
                </li>
              );
            })}
          </ul>
        ) : null}
      </Panel>

      <Panel title="BODY">
        <form action={logBody} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight (lb)" hint="Mornings, optional">
              <input name="weight_lb" type="number" inputMode="decimal" step="0.1" className={inputClass} />
            </Field>
            <Field label="Waist (in)" hint="Weekly, at the navel">
              <input name="waist_in" type="number" inputMode="decimal" step="0.1" className={inputClass} />
            </Field>
          </div>
          <BigButton type="submit" tone="stone">SAVE</BigButton>
        </form>
        {avg !== null ? <p className="m-0 text-[15px] text-dust">7-day average: {avg.toFixed(1)} lb</p> : null}
      </Panel>

      <BackLink />
    </>
  );
}
