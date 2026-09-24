import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { planDay } from "@/engine/day";
import { GYM_COOKIE } from "@/lib/constants";
import { LIBRARY, loadAll } from "@/lib/data";
import { dayLabel, DESK_NAMES } from "@/lib/view";
import { localDate } from "@/engine/calendar";
import { Announce, BigLink, HealthBar, Panel, Title } from "@/components/ui";

const DONE_MESSAGES: Record<string, string> = {
  desk: "Logged. Keep chipping away.",
  fight: "Class logged.",
  peloton: "Peloton logged.",
  body: "Saved.",
  settings: "Settings saved.",
  calibration: "Calibration saved. Starting weights are set.",
};

export default async function Home({ searchParams }: PageProps<"/">) {
  const data = await loadAll();
  if (!data) redirect("/signin");
  if (!data.profile || !data.equipment) redirect("/onboarding");

  const now = new Date();
  const zone = data.profile.timezone;
  const gymCookie = (await cookies()).get(GYM_COOKIE)?.value;
  const day = planDay({
    now,
    library: LIBRARY,
    profile: data.profile,
    history: data.history,
    gymToday: gymCookie === localDate(now, zone),
  });
  const calibrated = data.history.sessions.some((s) => s.kind === "calibration");
  const done = (await searchParams).done;
  const doneMessage = typeof done === "string" ? DONE_MESSAGES[done] : undefined;

  return (
    <>
      <Title sub={dayLabel(now, data.profile)} />

      {doneMessage ? <p className="m-0 border-2 border-gold-700 bg-stone-950/80 p-3 text-center text-[16px] text-gold-200">{doneMessage}</p> : null}
      {day.flawless ? <Announce>FLAWLESS</Announce> : null}
      {!calibrated ? (
        <Link href="/onboarding/calibrate" className="border-2 border-dashed border-gold-500 p-3 text-[16px] text-gold-200">
          Set your starting weights: calibrate the A and B exercises.
        </Link>
      ) : null}

      {day.fightDay ? (
        <p className="m-0 border-2 border-gold-300 bg-blood-800 p-3 text-[17px]">
          <b>Fight day.</b> That&apos;s your training. Desk sets are optional today.
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

      <div className="flex flex-col gap-3">
        <BigLink href="/desk" tone="stone">AT YOUR DESK?</BigLink>
        {day.fightDay ? (
          <BigLink href="/fight">LOG YOUR CLASS</BigLink>
        ) : (
          <BigLink href="/gym">GYM TODAY?</BigLink>
        )}
      </div>

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
