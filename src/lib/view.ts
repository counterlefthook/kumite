import { format } from "date-fns";
import { tz } from "@date-fns/tz";
import { programWeek } from "@/engine/calendar";
import type { Load, Profile } from "@/engine/types";

// Small display helpers shared by the screens.

export function dayLabel(now: Date, profile: Profile): string {
  const day = format(now, "EEEE", { in: tz(profile.timezone) }).toUpperCase();
  return `${day} / WEEK ${programWeek(now, profile.programStartDate, profile.timezone)}`;
}

export function loadLabel(load: Load): string {
  switch (load.kind) {
    case "dumbbell":
      return `${load.lb} lb`;
    case "band":
      return `${load.band[0]?.toUpperCase() ?? ""}${load.band.slice(1)} band`;
    case "hold":
      return "Hold";
    default:
      return "Bodyweight";
  }
}

export function rangeLabel(reps: readonly [number, number] | null, seconds: readonly [number, number] | null): string {
  if (reps) return reps[0] === reps[1] ? `${reps[0]} reps` : `${reps[0]}-${reps[1]} reps`;
  if (seconds) return `${seconds[0]}-${seconds[1]} sec`;
  return "";
}

export const DESK_NAMES = { pushups: "Push", squats: "Legs", pullups: "Pull-ups" } as const;
