import { logFight } from "@/app/actions";
import { BigButton, Field, inputClass } from "@/components/ui";

export function FightForm({ from }: { from: string }) {
  return (
    <form action={logFight} className="flex flex-col gap-4">
      <input type="hidden" name="from" value={from} />
      <Field label="Class">
        <select name="fight_type" defaultValue="kickboxing" className={inputClass}>
          <option value="kickboxing">Kickboxing</option>
          <option value="mma">MMA</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Minutes">
          <input name="minutes" type="number" inputMode="numeric" min={1} max={600} defaultValue={60} required className={inputClass} />
        </Field>
        <Field label="Effort (1 to 10)">
          <input name="effort" type="number" inputMode="numeric" min={1} max={10} defaultValue={7} className={inputClass} />
        </Field>
      </div>
      <BigButton type="submit">LOG CLASS</BigButton>
    </form>
  );
}
