import { answerGym } from "@/app/actions";
import { BackLink, BigButton, Title } from "@/components/ui";

export default function Gym() {
  return (
    <>
      <Title />
      <section className="flex flex-col gap-4 border-[3px] border-gold-300 bg-stone-950/85 p-4">
        <h2 className="m-0 text-center font-display text-[24px] font-black text-gold-100">Going to the gym today?</h2>
        <p className="m-0 text-center text-[16px] text-dust">Kickboxing or MMA. If yes, that&apos;s the day&apos;s training.</p>
        <form action={answerGym} className="grid grid-cols-2 gap-3">
          <BigButton type="submit" name="answer" value="yes">YES</BigButton>
          <BigButton type="submit" name="answer" value="no" tone="stone">NO</BigButton>
        </form>
      </section>
      <BackLink />
    </>
  );
}
