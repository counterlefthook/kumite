import { Announce, BackLink, ErrorNote, Panel, Title } from "@/components/ui";
import { FightForm } from "@/components/fight-form";

export default async function Fight({ searchParams }: PageProps<"/fight">) {
  const { error } = await searchParams;
  return (
    <>
      <Title />
      <Announce>FIGHT DAY</Announce>
      <Panel>
        <p className="m-0 text-[18px] leading-snug">That&apos;s your training for today. Nothing else planned.</p>
        <p className="m-0 text-[16px] text-dust">Log the class when you get back, so the week adds up. Desk sets are optional today.</p>
      </Panel>
      <ErrorNote message={typeof error === "string" ? error : null} />
      <Panel title="LOG THE CLASS">
        <FightForm from="/fight" />
      </Panel>
      <BackLink />
    </>
  );
}
