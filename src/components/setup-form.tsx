import { saveSetup } from "@/app/actions";
import type { Database } from "@/lib/database.types";
import { bandsOf } from "@/lib/data";
import { BigButton, Field, inputClass, Panel } from "@/components/ui";

type ProfileRow = Database["public"]["Tables"]["profile"]["Row"];
type EquipmentRow = Database["public"]["Tables"]["equipment"]["Row"];

// Profile, equipment, and targets. Used by onboarding and Settings.
export function SetupForm({ from, profile, equipment, today }: { from: string; profile: ProfileRow | null; equipment: EquipmentRow | null; today: string }) {
  const t = (profile?.desk_targets ?? {}) as Record<string, number>;
  const settings = (equipment?.dumbbell_settings_lb ?? []).map(Number);
  return (
    <form action={saveSetup} className="flex flex-col gap-5">
      <input type="hidden" name="from" value={from} />
      <Panel title="YOU">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Height (inches)">
            <input name="height_in" type="number" inputMode="decimal" step="0.5" defaultValue={profile?.height_in ?? 74} required className={inputClass} />
          </Field>
          <Field label="Weight (lb)">
            <input name="baseline_weight_lb" type="number" inputMode="decimal" step="0.1" defaultValue={profile?.baseline_weight_lb ?? 205} required className={inputClass} />
          </Field>
        </div>
        <Field label="Program start date">
          <input name="program_start_date" type="date" defaultValue={profile?.program_start_date ?? today} className={inputClass} />
        </Field>
      </Panel>

      <Panel title="DUMBBELLS AND BANDS">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Lowest">
            <input name="db_low" type="number" inputMode="decimal" step="0.5" defaultValue={settings[0] ?? 5} className={inputClass} />
          </Field>
          <Field label="Highest">
            <input name="db_high" type="number" inputMode="decimal" step="0.5" defaultValue={settings.at(-1) ?? 55} className={inputClass} />
          </Field>
          <Field label="Step">
            <input name="db_step" type="number" inputMode="decimal" step="0.5" defaultValue={settings.length > 1 ? settings[1] - settings[0] : 5} className={inputClass} />
          </Field>
        </div>
        <Field label="Or type every setting" hint="Overrides the three boxes above, for example 5, 10, 12.5, 15">
          <input name="dumbbell_list" defaultValue="" placeholder={settings.join(", ")} className={inputClass} />
        </Field>
        <Field label="Bands, heaviest to lightest" hint="Separated by commas, for example black, red, green, yellow">
          <input name="bands" defaultValue={bandsOf(equipment).map((b) => b.name).join(", ")} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bench">
            <select name="bench" defaultValue={equipment?.bench ?? "adjustable"} className={inputClass}>
              <option value="adjustable">Adjustable</option>
              <option value="flat">Flat</option>
            </select>
          </Field>
          <label className="flex min-h-[52px] items-center gap-3 self-end border-2 border-gold-700 px-3 text-[17px]">
            <input name="pullup_bar" type="checkbox" defaultChecked={equipment?.pullup_bar ?? true} className="h-6 w-6" />
            Pull-up bar
          </label>
        </div>
      </Panel>

      <Panel title="DAILY DESK GOALS">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Work starts">
            <input name="work_start" type="time" defaultValue={profile?.work_start?.slice(0, 5) ?? "09:00"} className={inputClass} />
          </Field>
          <Field label="Work ends">
            <input name="work_end" type="time" defaultValue={profile?.work_end?.slice(0, 5) ?? "17:00"} className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Push-ups a day">
            <input name="pushups_per_day" type="number" inputMode="numeric" defaultValue={t.pushups_per_day ?? 100} className={inputClass} />
          </Field>
          <Field label="Squats an hour">
            <input name="chair_squats_per_work_hour" type="number" inputMode="numeric" defaultValue={t.chair_squats_per_work_hour ?? 25} className={inputClass} />
          </Field>
          <Field label="Pull-ups a day">
            <input name="pullup_singles_per_day" type="number" inputMode="numeric" defaultValue={t.pullup_singles_per_day ?? 5} className={inputClass} />
          </Field>
        </div>
      </Panel>

      <Panel title="WEEKLY GOALS">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Peloton minutes">
            <input name="peloton_minutes_week" type="number" inputMode="numeric" defaultValue={profile?.peloton_minutes_week ?? 60} className={inputClass} />
          </Field>
          <Field label="Home workouts">
            <input name="home_workouts_week" type="number" inputMode="numeric" min={0} max={7} defaultValue={profile?.home_workouts_week ?? 3} className={inputClass} />
          </Field>
        </div>
      </Panel>

      <BigButton type="submit">SAVE</BigButton>
    </form>
  );
}
