import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Shared pieces of the Kumite look. Tap targets are at least 48 px.

export function Title({ sub }: { sub?: string }) {
  return (
    <header className="flex flex-col items-center gap-1.5">
      <h1 className="gold-text m-0 font-display text-[52px] font-black leading-none tracking-[0.08em]">KUMITE</h1>
      {sub ? <p className="m-0 font-display text-[13px] font-bold tracking-[0.2em] text-gold-500">{sub}</p> : null}
    </header>
  );
}

export function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col gap-3 border-2 border-gold-700 bg-stone-950/75 p-3.5 ${className}`}>
      {title ? <h2 className="m-0 font-display text-sm font-bold tracking-[0.2em] text-gold-300">{title}</h2> : null}
      {children}
    </section>
  );
}

/** A fighting-game health bar. Null target shows the count with no bar. */
export function HealthBar({ label, done, target, unit = "" }: { label: string; done: number; target: number | null; unit?: string }) {
  const pct = target ? Math.min(100, (done / target) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[17px] font-bold">{label}</span>
        <span className="text-[17px] font-bold text-gold-200">
          {target ? `${Math.min(done, target)} / ${target}${unit}` : `${done}${unit}`}
        </span>
      </div>
      {target ? (
        <div
          className="flex h-[18px] border-2 border-gold-500 bg-[#1a0b06] p-0.5"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={Math.min(done, target)}
        >
          <div className="flex flex-1 bg-blood-700">
            <div style={{ width: `${pct}%` }} className="bg-gradient-to-b from-[#f6e25a] to-[#d4a514]" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

const big = "flex min-h-[64px] w-full items-center justify-center border-[3px] border-gold-300 px-4 font-display font-black tracking-[0.08em] text-gold-100 no-underline active:translate-y-0.5";
const tones = {
  red: "bg-gradient-to-b from-blood-500 to-blood-800 shadow-[0_4px_0_#3d0400]",
  stone: "bg-gradient-to-b from-stone-600 to-stone-800 shadow-[0_4px_0_#5c3a0c]",
};

export function BigButton({ tone = "red", className = "", ...props }: ComponentProps<"button"> & { tone?: keyof typeof tones }) {
  return <button {...props} className={`${big} ${tones[tone]} text-[22px] disabled:opacity-60 ${className}`} />;
}

export function BigLink({ tone = "red", className = "", ...props }: ComponentProps<typeof Link> & { tone?: keyof typeof tones }) {
  return <Link {...props} className={`${big} ${tones[tone]} text-[22px] ${className}`} />;
}

export function BackLink({ href = "/", children = "Back" }: { href?: string; children?: ReactNode }) {
  return (
    <Link href={href} className="flex min-h-[52px] items-center justify-center border-2 border-gold-700 text-[17px] font-bold text-gold-300 no-underline">
      {children}
    </Link>
  );
}

export function Announce({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`announce text-center text-[44px] leading-tight ${className}`}>{children}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[15px] font-bold text-dust">{label}</span>
      {children}
      {hint ? <span className="text-[13px] text-ash">{hint}</span> : null}
    </label>
  );
}

export const inputClass = "min-h-[52px] w-full border-2 border-gold-700 bg-stone-950 px-3 text-[18px] text-bone outline-none focus:border-gold-300";

export function ErrorNote({ message }: { message?: string | null }) {
  return message ? <p className="m-0 border-2 border-blood-500 bg-blood-900/70 p-3 text-[15px]">{message}</p> : null;
}
