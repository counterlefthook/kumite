"use client";

import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { saveIdea } from "@/app/actions";

// The idea button on every signed-in screen. Notes land in dev_notes with the
// screen and app version; Claude reads the open ones at the start of each task.
export function IdeaButton() {
  const screen = usePathname();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const result = await saveIdea(body, screen);
      if (result.ok) {
        setBody("");
        setMessage("Saved. It goes into the next update.");
        setTimeout(() => {
          setOpen(false);
          setMessage(null);
        }, 1200);
      } else {
        setMessage(result.error ?? "Could not save that.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-20 min-h-[48px] border-2 border-gold-300 bg-stone-800/95 px-4 font-display text-[15px] font-bold tracking-[0.1em] text-gold-200 shadow-[0_3px_0_#3d0400]"
      >
        IDEA
      </button>
      {open ? (
        <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Idea or problem"
            onClick={(e) => e.stopPropagation()}
            className="mx-auto flex w-full max-w-md flex-col gap-3 border-t-[3px] border-gold-300 bg-stone-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <h2 className="m-0 font-display text-xl font-black text-gold-200">Idea or problem</h2>
            <p className="m-0 text-[15px] text-dust">Anything you would change about the app.</p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="The DONE button should be bigger"
              className="w-full border-2 border-gold-700 bg-stone-950 p-3 text-[17px] text-bone outline-none focus:border-gold-300"
            />
            <p className="m-0 text-[13px] text-ash">Screen: {screen}</p>
            {message ? <p className="m-0 text-[15px] text-gold-200">{message}</p> : null}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-[56px] border-2 border-gold-700 text-[17px] font-bold text-gold-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending || !body.trim()}
                className="min-h-[56px] border-[3px] border-gold-300 bg-blood-600 font-display text-lg font-black text-gold-100 disabled:opacity-50"
              >
                {pending ? "SAVING" : "SAVE"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
