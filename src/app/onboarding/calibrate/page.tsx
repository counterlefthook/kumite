import { redirect } from "next/navigation";
import { saveCalibration } from "@/app/actions";
import { exerciseById } from "@/engine/library";
import { CALIBRATION } from "@/lib/constants";
import { LIBRARY, loadAll } from "@/lib/data";
import { BackLink, BigButton, ErrorNote, Field, inputClass, Panel, Title } from "@/components/ui";

export default async function Calibrate({ searchParams }: PageProps<"/onboarding/calibrate">) {
  const data = await loadAll();
  if (!data?.equipment) redirect("/onboarding");
  const { error } = await searchParams;
  const settings = data.equipment.dumbbellSettingsLb;

  const WeightPick = ({ id }: { id: string }) => {
    const ex = exerciseById(LIBRARY, id);
    return (
      <Field label={ex.name}>
        <select name={`w_${id}`} defaultValue="" className={inputClass}>
          <option value="">Skip for now</option>
          {settings.map((w) => (
            <option key={w} value={w}>
              {w} lb{ex.dumbbells === 2 ? " each" : ""}
            </option>
          ))}
        </select>
      </Field>
    );
  };

  return (
    <>
      <Title sub="CALIBRATION" />
      <p className="m-0 text-[17px] text-dust">
        For each exercise, pick the dumbbell you can do for 10 to 12 reps with 2 reps left in the tank. Do the A exercises one day and the B
        exercises another if you like; skipped ones start at your lightest setting.
      </p>
      <ErrorNote message={typeof error === "string" ? error : null} />
      <form action={saveCalibration} className="flex flex-col gap-5">
        <Panel title="WORKOUT A">
          {CALIBRATION.A.map((id) => (
            <WeightPick key={id} id={id} />
          ))}
        </Panel>
        <Panel title="WORKOUT B">
          {CALIBRATION.B.map((id) => (
            <WeightPick key={id} id={id} />
          ))}
        </Panel>
        <Panel title="MAXES">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Push-ups">
              <input name="max_pushups" type="number" inputMode="numeric" min={0} max={200} className={inputClass} />
            </Field>
            <Field label="Chair squats" hint="Stop at 50">
              <input name="max_chair_squats" type="number" inputMode="numeric" min={0} max={50} className={inputClass} />
            </Field>
            <Field label="Strict pull-ups">
              <input name="max_pullups" type="number" inputMode="numeric" min={0} max={50} className={inputClass} />
            </Field>
          </div>
          <Field label="Heaviest band that gets you 5 assisted pull-ups">
            <select name="band_for_5" defaultValue="" className={inputClass}>
              <option value="">Skip for now</option>
              {data.equipment.bands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
        </Panel>
        <BigButton type="submit">SAVE CALIBRATION</BigButton>
      </form>
      <BackLink />
    </>
  );
}
