import { redirect } from "next/navigation";
import { localDate } from "@/engine/calendar";
import { ZONE } from "@/lib/constants";
import { loadAll } from "@/lib/data";
import { ErrorNote, Title } from "@/components/ui";
import { SetupForm } from "@/components/setup-form";

export default async function Onboarding({ searchParams }: PageProps<"/onboarding">) {
  const data = await loadAll();
  if (!data) redirect("/signin");
  const { error } = await searchParams;
  return (
    <>
      <Title sub="CHOOSE YOUR SETUP" />
      <p className="m-0 text-[17px] text-dust">A few numbers so Kumite can plan around your equipment and goals. You can change any of this later in Settings.</p>
      <ErrorNote message={typeof error === "string" ? error : null} />
      <SetupForm from="/onboarding" profile={data.profileRow} equipment={data.equipmentRow} today={localDate(new Date(), ZONE)} />
    </>
  );
}
