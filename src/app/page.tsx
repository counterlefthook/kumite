import Link from "next/link";
import { redirect } from "next/navigation";
import { logDesk, setWhere } from "@/app/actions";
import { localDate } from "@/engine/calendar";
import { planDay } from "@/engine/day";
import { exerciseById } from "@/engine/library";
import { LIBRARY, loadAll, whereToday, type Where } from "@/lib/data";
import { dayLabel, DESK_NAMES } from "@/lib/view";
import { Announce, BigButton, BigLink, ErrorNote, HealthBar, Panel, Title } from "@/components/ui";
import { FightForm } from "@/components/fight-form";

const DONE_MESSAGES: Record<string, string> = {
  fight: "Class logged.",
  peloton: "Peloton logged.",
  body: "Saved.",
  settings: "Settings saved.",
  calibration: "Calibration saved. Starting weights are set.",
};

const PLACES: { id: Where; label: string }[] = [
  { id: "desk", label: "DESK" },
  { id: "gym", label: "GYM" },
  { id: "out", label: "OUT" },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const data = await loadAll();
  if (!data) redirect("/signin");
  if (!data.profile || !data.equipment) redirect("/onboarding");

  const now = new Date();
  const today = localDate(now, data.profile.timezone);
  const where = whereToday(data.profileRow, today);
  const day = planDay({ now, library: LIBRARY, profile: data.profile, history: data.history, gymToday: where === "gym" });
  const calibrated = data.history.sessions.some((s) => s.kind === "calibration");
  const params = await searchParams;
  const doneMessage = typeof params.done === "string" ? DONE_MESSAGES[params.done] : undefined;
  const error = typeof params.error === "string" ? params.error : null;
  const move = day.deskNow.kind === "desk_break" ? day.deskNow : null;
  const moveEx = move ? exerciseById(LIBRARY, move.exerciseId) : null;
  const round = data.history.deskSets.filter((d) => localDate(d.loggedAt, data.profile!.timezone) === today).length + 1;

  return (
    <>
      <Title sub={dayLabel(now, data.profile)} />
      <ErrorNote message={error} />
      {doneMessage ? <p className="m-0 border-2 border-gold-700 bg-stone-950/80 p-3 text-center text-[16px] text-gold-200">{doneMessage}</p> : null}
      {!calibrated ? (
        <Link href="/onboarding/calibrate" className="border-2 border-dashed border-gold-500 p-3 text-[16px] text-gold-200">
          Set your starting weights: calibrate the A and B exercises.
        </Link>
      ) : null}

      <form action={setWhere} className="flex flex-col gap-2">
        <span className="text-center font-display text-[14px] font-bold tracking-[0.2em] text-gold-300">
          {where ? "WHERE YOU ARE" : "WHERE ARE YOU?"}
        </span>
        <div className="grid grid-cols-3 gap-2">
          {PLACES.map((p) => (
            <button
              key={p.id}
              type="submit"
              name="where"
              value={p.id}
              aria-pressed={where === p.id}
              className={`min-h-[60px] border-[3px] font-display text-[20px] font-black tracking-[0.08em] ${
                where === p.id
                  ? "border-gold-300 bg-gradient-to-b from-blood-500 to-blood-800 text-gold-100 shadow-[0_4px_0_#3d0400]"
                  : "border-gold-700 bg-stone-900/90 text-gold-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </form>

      {day.flawless ? <Announce>FLAWLESS</Announce> : null}

      {where === "desk" && move && moveEx ? (
        <section className="flex flex-col items-center gap-2 border-[3px] border-gold-300 bg-stone-950/85 px-4 py-5 text-center">
          <span className="font-display text-[14px] font-bold tracking-[0.25em] text-gold-300">ROUND {round} / DO THIS</span>
          <span className="announce text-[80px] leading-none">{move.reps}</span>
          <span className="font-display text-[28px] font-black uppercase leading-tight text-gold-100">{moveEx.name}</span>
          <span className="text-[16px] text-dust">{move.reasons.join(" ")}</span>
          {moveEx.cue ? <span className="text-[15px] text-ash">{moveEx.cue}</span> : null}
          <form action={logDesk} className="mt-2 w-full">
            <input type="hidden" name="exercise_id" value={moveEx.id} />
            <input type="hidden" name="reps" value={move.reps ?? 1} />
            <BigButton type="submit" className="min-h-[76px] text-[30px]">DONE</BigButton>
          </form>
        </section>
      ) : null}

      {where === "gym" ? (
        <>
          <Announce>FIGHT DAY</Announce>
          <Panel>
            <p className="m-0 text-[17px] leading-snug">That&apos;s your training for today. Log the class when you get back. Desk sets are optional.</p>
            <FightForm from="/" />
          </Panel>
        </>
      ) : null}

      {where === "out" ? (
        <Panel title="TODAY'S PLAN">
          {day.noGym.kind === "home_workout" ? (
            <>
              <p className="m-0 text-[18px] font-bold">Home workout, {day.noGym.timeBox} minutes.</p>
              <p className="m-0 text-[15px] text-dust">{day.noGym.reason}</p>
              <BigLink href="/plan">SEE THE WORKOUT</BigLink>
            </>
          ) : day.noGym.kind === "peloton" ? (
            <>
              <p className="m-0 text-[18px] font-bold">Peloton: {day.noGym.minutesLeft} minutes to go this week.</p>
              <p className="m-0 text-[15px] text-dust">{day.noGym.reason}</p>
              <BigLink href="/log#peloton">LOG PELOTON</BigLink>
            </>
          ) : (
            <>
              <p className="m-0 text-[18px] font-bold">Rest day.</p>
              <p className="m-0 text-[15px] text-dust">{day.noGym.reason}</p>
            </>
          )}
        </Panel>
      ) : null}

      {day.fightDay && where !== "gym" ? (
        <p className="m-0 border-2 border-gold-300 bg-blood-800 p-3 text-[17px]">
          <b>Fight day.</b> Desk sets are optional today.
        </p>
      ) : null}

      <Panel title={day.desk[0].target === null ? "DESK SETS TODAY" : "TODAY AT THE DESK"}>
        {day.desk.map((bar) => (
          <HealthBar key={bar.slot} label={DESK_NAMES[bar.slot]} done={bar.done} target={bar.target} />
        ))}
      </Panel>

      <Panel title="THIS WEEK">
        <HealthBar label="Peloton" done={day.pelotonMinutes} target={day.pelotonTarget || null} unit=" min" />
        <HealthBar label="Home workouts" done={day.homeWorkouts} target={day.homeTarget || null} />
      </Panel>

      {day.nudge ? (
        <div className="flex gap-2.5 border-2 border-gold-300 bg-blood-800 p-3.5 text-[17px] leading-snug">
          <span aria-hidden="true" className="font-display text-[22px] font-black leading-none text-[#ffcf3a]">!</span>
          <span>{day.nudge}</span>
        </div>
      ) : null}

      <nav className="grid grid-cols-2 gap-3">
        <Link href="/log" className="flex min-h-[52px] items-center justify-center border-2 border-gold-700 text-[17px] font-bold text-gold-300">
          Log Peloton, weight
        </Link>
        <Link href="/settings" className="flex min-h-[52px] items-center justify-center border-2 border-gold-700 text-[17px] font-bold text-gold-300">
          Settings
        </Link>
      </nav>
    </>
  );
}
