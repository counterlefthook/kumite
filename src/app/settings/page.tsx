import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { localDate } from "@/engine/calendar";
import { ZONE } from "@/lib/constants";
import { APP_VERSION, loadAll } from "@/lib/data";
import { BackLink, ErrorNote, Title } from "@/components/ui";
import { SetupForm } from "@/components/setup-form";
import { NudgeToggle } from "@/components/nudge-toggle";

export default async function Settings({ searchParams }: PageProps<"/settings">) {
  const data = await loadAll();
  if (!data) redirect("/signin");
  const { error } = await searchParams;
  return (
    <>
      <Title sub="SETTINGS" />
      <ErrorNote message={typeof error === "string" ? error : null} />
      <SetupForm from="/settings" profile={data.profileRow} equipment={data.equipmentRow} today={localDate(new Date(), ZONE)} />
      <NudgeToggle />
      <Link href="/onboarding/calibrate" className="flex min-h-[52px] items-center justify-center border-2 border-gold-700 text-[17px] font-bold text-gold-300">
        Recalibrate starting weights
      </Link>
      <form action={signOut}>
        <button type="submit" className="min-h-[52px] w-full border-2 border-blood-500 text-[17px] font-bold text-bone">
          Sign out
        </button>
      </form>
      <BackLink />
      <p className="m-0 text-center text-[13px] text-ash">Kumite {APP_VERSION}</p>
    </>
  );
}
