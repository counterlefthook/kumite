"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { logSet } from "@/app/actions";

export interface ExerciseView {
  key: string;
  exerciseId: string;
  name: string;
  cue: string;
  loadKind: "dumbbell" | "band" | "bodyweight" | "hold";
  weight: number | null;
  band: string | null;
  reps: [number, number] | null;
  seconds: [number, number] | null;
  target: string;
  rirLabel: string;
  squat: boolean;
  note?: string;
  sets: {
    index: number;
    logged: { weight: number | null; reps: number | null; seconds: number | null; rir: number | null; band: string | null; knee: boolean } | null;
  }[];
}

export interface BlockView {
  key: string;
  title: string;
  meta: string;
  optional: boolean;
  exercises: ExerciseView[];
}

const REST_SEC = 75;

function Stepper({ label, value, onDown, onUp }: { label: string; value: string; onDown: () => void; onUp: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[14px] font-bold text-dust">{label}</span>
      <div className="grid grid-cols-[56px_1fr_56px] items-center border-2 border-gold-700 bg-stone-950">
        <button type="button" onClick={onDown} aria-label={`${label} down`} className="h-[56px] text-[28px] font-bold text-gold-200">-</button>
        <span className="text-center text-[26px] font-bold">{value}</span>
        <button type="button" onClick={onUp} aria-label={`${label} up`} className="h-[56px] text-[28px] font-bold text-gold-200">+</button>
      </div>
    </div>
  );
}

function LogButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[64px] border-[3px] border-gold-300 bg-gradient-to-b from-blood-500 to-blood-800 font-display text-[22px] font-black tracking-[0.08em] text-gold-100 shadow-[0_4px_0_#3d0400] disabled:opacity-60"
    >
      {pending ? "LOGGING" : "LOG SET"}
    </button>
  );
}

function SetEditor({
  sessionId,
  ex,
  setIndex,
  settings,
  bands,
  onLogged,
}: {
  sessionId: string;
  ex: ExerciseView;
  setIndex: number;
  settings: number[];
  bands: string[];
  onLogged: () => void;
}) {
  const last = [...ex.sets].reverse().find((s) => s.logged)?.logged;
  const [weight, setWeight] = useState<number | null>(last?.weight ?? ex.weight);
  const [band, setBand] = useState<string | null>(last?.band ?? ex.band);
  const [reps, setReps] = useState<number>(last?.reps ?? ex.reps?.[1] ?? 0);
  const [seconds, setSeconds] = useState<number>(last?.seconds ?? ex.seconds?.[1] ?? 0);
  const [rir, setRir] = useState<number>(2);
  const [knee, setKnee] = useState(false);

  const stepWeight = (dir: 1 | -1) => {
    if (weight === null) return;
    const sorted = [...settings].sort((a, b) => a - b);
    const next = dir > 0 ? sorted.find((s) => s > weight) : [...sorted].reverse().find((s) => s < weight);
    if (next !== undefined) setWeight(next);
  };

  return (
    <form action={logSet} onSubmit={onLogged} className="flex flex-col gap-3 border-t-2 border-[#5c3a0c] pt-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="exercise_id" value={ex.exerciseId} />
      <input type="hidden" name="set_index" value={setIndex} />
      {ex.loadKind === "dumbbell" && weight !== null ? <input type="hidden" name="weight_lb" value={weight} /> : null}
      {ex.loadKind === "band" && band ? <input type="hidden" name="band" value={band} /> : null}
      {ex.seconds ? <input type="hidden" name="seconds" value={seconds} /> : <input type="hidden" name="reps" value={reps} />}
      {ex.loadKind !== "hold" ? <input type="hidden" name="rir" value={rir} /> : null}
      {knee ? <input type="hidden" name="knee_flag" value="on" /> : null}

      <span className="font-display text-[15px] font-bold tracking-[0.15em] text-gold-300">SET {setIndex}</span>
      {ex.loadKind === "dumbbell" && weight !== null ? (
        <Stepper label="Weight (each)" value={`${weight} lb`} onDown={() => stepWeight(-1)} onUp={() => stepWeight(1)} />
      ) : null}
      {ex.loadKind === "band" && bands.length ? (
        <label className="flex flex-col gap-1">
          <span className="text-[14px] font-bold text-dust">Band</span>
          <select
            value={band ?? ""}
            onChange={(e) => setBand(e.target.value)}
            className="min-h-[56px] border-2 border-gold-700 bg-stone-950 px-3 text-[20px] text-bone"
          >
            {bands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {ex.seconds ? (
        <Stepper label="Seconds" value={`${seconds}`} onDown={() => setSeconds(Math.max(0, seconds - 5))} onUp={() => setSeconds(seconds + 5)} />
      ) : (
        <Stepper label="Reps" value={`${reps}`} onDown={() => setReps(Math.max(0, reps - 1))} onUp={() => setReps(reps + 1)} />
      )}
      {ex.loadKind !== "hold" ? (
        <div className="flex flex-col gap-1">
          <span className="text-[14px] font-bold text-dust">Reps in reserve</span>
          <div className="grid grid-cols-5 gap-2">
            {[0, 1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRir(n)}
                aria-pressed={rir === n}
                className={`h-[52px] border-2 text-[20px] font-bold ${rir === n ? "border-gold-300 bg-blood-600 text-gold-100" : "border-gold-700 bg-stone-950 text-bone"}`}
              >
                {n === 4 ? "4+" : n}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {ex.squat ? (
        <button
          type="button"
          onClick={() => setKnee(!knee)}
          aria-pressed={knee}
          className={`min-h-[52px] border-2 text-[17px] font-bold ${knee ? "border-gold-300 bg-blood-800 text-gold-100" : "border-gold-700 text-dust"}`}
        >
          {knee ? "Knee pain above 3: flagged" : "Knee pain above 3?"}
        </button>
      ) : null}
      <LogButton />
    </form>
  );
}

function RestTimer({ endsAt, onClear }: { endsAt: number; onClear: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return (
    <button
      type="button"
      onClick={onClear}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-20 min-h-[48px] border-2 border-gold-300 bg-blood-800 px-4 font-display text-[18px] font-black text-gold-100"
    >
      {left > 0 ? `REST ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "GO"}
    </button>
  );
}

/** After a set, open the next exercise in the block that still has sets left (supersets alternate). */
function nextInBlock(block: BlockView, key: string): string {
  const left = (e: ExerciseView) => e.sets.filter((s) => !s.logged).length - (e.key === key ? 1 : 0);
  const i = block.exercises.findIndex((e) => e.key === key);
  for (let step = 1; step <= block.exercises.length; step++) {
    const e = block.exercises[(i + step) % block.exercises.length];
    if (left(e) > 0) return e.key;
  }
  return key;
}

export function WorkoutLogger({ sessionId, settings, bands, blocks }: { sessionId: string; settings: number[]; bands: string[]; blocks: BlockView[] }) {
  const all = blocks.flatMap((b) => (b.optional ? [] : b.exercises));
  const firstOpen = all.find((e) => e.sets.some((s) => !s.logged))?.key ?? null;
  const [open, setOpen] = useState<string | null>(firstOpen);
  const [restEnds, setRestEnds] = useState<number | null>(null);
  const finished = all.every((e) => e.sets.every((s) => s.logged));

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block) => (
        <section
          key={block.key}
          className={`flex flex-col gap-3 border-[3px] p-3 ${block.optional ? "border-dashed border-gold-500" : "border-gold-700 bg-stone-950/80"}`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="m-0 font-display text-[16px] font-black tracking-[0.12em] text-gold-200">{block.title}</h2>
            <span className="text-[14px] text-dust">{block.meta}</span>
          </div>
          {block.exercises.map((ex) => {
            const next = ex.sets.find((s) => !s.logged);
            const isOpen = open === ex.key && next;
            return (
              <div key={ex.key} className="flex flex-col gap-2 border-2 border-[#3a2410] bg-stone-900 p-3">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : ex.key)}
                  className="flex flex-col gap-1 text-left"
                  aria-expanded={Boolean(isOpen)}
                >
                  <span className="text-[19px] font-bold leading-tight">{ex.name}</span>
                  <span className="text-[16px]">
                    <b className="text-gold-200">
                      {ex.loadKind === "dumbbell" ? `${ex.weight} lb` : ex.loadKind === "band" ? `${ex.band} band` : ex.loadKind === "hold" ? "Hold" : "Bodyweight"}
                    </b>{" "}
                    {ex.sets.length} x {ex.target} <span className="text-dust">{ex.rirLabel}</span>
                  </span>
                  {ex.note ? <span className="text-[15px] text-gold-200">{ex.note}</span> : null}
                </button>
                <div className="flex flex-wrap gap-2">
                  {ex.sets.map((s) => (
                    <span
                      key={s.index}
                      className={`flex h-[44px] min-w-[44px] items-center justify-center border-2 px-2 text-[15px] font-bold ${s.logged ? "border-gold-300 bg-blood-600 text-gold-100" : "border-gold-700 text-dust"}`}
                    >
                      {s.logged
                        ? `${s.logged.weight ? `${s.logged.weight}x` : ""}${s.logged.reps ?? `${s.logged.seconds}s`}`
                        : s.index}
                    </span>
                  ))}
                </div>
                {isOpen && next ? (
                  <SetEditor
                    key={`${ex.exerciseId}-${next.index}`}
                    sessionId={sessionId}
                    ex={ex}
                    setIndex={next.index}
                    settings={settings}
                    bands={bands}
                    onLogged={() => {
                      setRestEnds(Date.now() + REST_SEC * 1000);
                      setOpen(nextInBlock(block, ex.key));
                    }}
                  />
                ) : null}
                {!next ? <span className="font-display text-[14px] font-black tracking-[0.15em] text-gold-300">DONE</span> : null}
              </div>
            );
          })}
        </section>
      ))}
      {finished ? <div className="announce text-center text-[40px]">FINISHED</div> : null}
      <Link
        href="/"
        className="flex min-h-[64px] items-center justify-center border-[3px] border-gold-300 bg-gradient-to-b from-stone-600 to-stone-800 font-display text-[20px] font-black tracking-[0.08em] text-gold-100"
      >
        {finished ? "BACK HOME" : "END WORKOUT"}
      </Link>
      {restEnds ? <RestTimer endsAt={restEnds} onClear={() => setRestEnds(null)} /> : null}
    </div>
  );
}
