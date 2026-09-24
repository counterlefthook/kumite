import { signIn } from "@/app/actions";
import { BigButton, ErrorNote, Field, inputClass, Title } from "@/components/ui";

export default async function SignIn({ searchParams }: PageProps<"/signin">) {
  const { error } = await searchParams;
  return (
    <>
      <div className="mt-10">
        <Title sub="ENTER THE TOURNAMENT" />
      </div>
      <form action={signIn} className="flex flex-col gap-4 border-2 border-gold-700 bg-stone-950/80 p-4">
        <ErrorNote message={typeof error === "string" ? error : null} />
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </Field>
        <BigButton type="submit">FIGHT</BigButton>
      </form>
      <p className="m-0 text-center text-[14px] text-ash">One account. A forgotten password is reset in the Supabase dashboard.</p>
    </>
  );
}
