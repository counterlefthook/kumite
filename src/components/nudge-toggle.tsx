"use client";

import { useEffect, useState, useTransition } from "react";
import { removeSubscription, saveSubscription } from "@/app/actions";

// "Turn on nudges" in Settings. iPhone only allows this inside the app added
// to the home screen, and asks permission once.
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function NudgeToggle() {
  const [state, setState] = useState<"checking" | "unsupported" | "off" | "on">("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && Boolean(publicKey);
    (supported
      ? navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => reg.pushManager.getSubscription())
          .then((sub): "on" | "off" => (sub ? "on" : "off"))
      : Promise.resolve<"unsupported">("unsupported")
    )
      .catch((): "unsupported" => "unsupported")
      .then(setState);
  }, [publicKey]);

  function turnOn() {
    start(async () => {
      setMessage(null);
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Notifications are blocked. Turn them on for Kumite in iPhone Settings, then try again.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey!) });
      const result = await saveSubscription(JSON.parse(JSON.stringify(sub)));
      if (result.ok) {
        setState("on");
        setMessage("Nudges are on.");
      } else {
        setMessage(result.error ?? "Could not turn on nudges.");
      }
    });
  }

  function turnOff() {
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removeSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      setMessage("Nudges are off.");
    });
  }

  return (
    <section className="flex flex-col gap-3 border-2 border-gold-700 bg-stone-950/75 p-3.5">
      <h2 className="m-0 font-display text-sm font-bold tracking-[0.2em] text-gold-300">DESK NUDGES</h2>
      <p className="m-0 text-[15px] text-dust">
        At most once an hour during work hours, only while you&apos;re behind. Silent on fight days and weekends.
      </p>
      {state === "unsupported" ? (
        <p className="m-0 text-[15px] text-ash">Open Kumite from your home screen icon to turn these on.</p>
      ) : (
        <button
          type="button"
          disabled={pending || state === "checking"}
          onClick={state === "on" ? turnOff : turnOn}
          className={`min-h-[56px] border-[3px] font-display text-[18px] font-black tracking-[0.08em] disabled:opacity-60 ${
            state === "on" ? "border-gold-700 text-gold-300" : "border-gold-300 bg-blood-600 text-gold-100"
          }`}
        >
          {state === "on" ? "TURN OFF NUDGES" : "TURN ON NUDGES"}
        </button>
      )}
      {message ? <p className="m-0 text-[15px] text-gold-200">{message}</p> : null}
    </section>
  );
}
