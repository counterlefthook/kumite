import rawLibrary from "../../docs/exercise-library.json";
import { parseLibrary } from "@/engine/library";
import type {
  BodyMetric,
  CheckIn,
  Equipment,
  History,
  Library,
  Profile,
  SessionKind,
  TemplateId,
} from "@/engine/types";
import type { Database, Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

// Loads Chris's settings and logs from Supabase and turns them into the shapes
// the engine takes. Only current rows (the *_current views) reach the engine.

export const LIBRARY: Library = parseLibrary(rawLibrary);
export const APP_VERSION = "0.1.0";

type ProfileRow = Database["public"]["Tables"]["profile"]["Row"];
type EquipmentRow = Database["public"]["Tables"]["equipment"]["Row"];

export interface Band {
  name: string;
  assist_lb?: number;
}

export interface Loaded {
  userId: string;
  profileRow: ProfileRow | null;
  equipmentRow: EquipmentRow | null;
  profile: Profile | null;
  equipment: Equipment | null;
  history: History;
  metrics: BodyMetric[];
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function toProfile(row: ProfileRow): Profile {
  const t = (row.desk_targets ?? {}) as Record<string, Json>;
  return {
    programStartDate: row.program_start_date,
    workStart: row.work_start.slice(0, 5),
    workEnd: row.work_end.slice(0, 5),
    deskTargets: {
      pushupsPerDay: num(t.pushups_per_day, 100),
      chairSquatsPerHour: num(t.chair_squats_per_work_hour, 25),
      pullupSinglesPerDay: num(t.pullup_singles_per_day, 5),
    },
    pelotonMinutesWeek: row.peloton_minutes_week ?? 60,
    homeWorkoutsWeek: row.home_workouts_week ?? 3,
    timezone: row.timezone,
  };
}

export function bandsOf(row: EquipmentRow | null): Band[] {
  return Array.isArray(row?.bands) ? (row.bands as unknown as Band[]).filter((b) => b && typeof b.name === "string") : [];
}

export function toEquipment(row: EquipmentRow): Equipment {
  return {
    dumbbellSettingsLb: (row.dumbbell_settings_lb ?? []).map(Number),
    bands: bandsOf(row).map((b) => b.name),
  };
}

function toCheckIn(v: Json | null): CheckIn | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return {
    sorenessLegs: num(v.soreness_legs, 1),
    sorenessUpper: num(v.soreness_upper, 1),
    energy: num(v.energy, 3),
    kneePain: num(v.knee_pain, 0),
    fightNext24h: v.fight_next_24h === true,
  };
}

export async function loadAll(): Promise<Loaded | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const [profile, equipment, sessions, sets, desk, metrics] = await Promise.all([
    supabase.from("profile").select("*").maybeSingle(),
    supabase.from("equipment").select("*").maybeSingle(),
    supabase.from("sessions_current").select("*").order("started_at"),
    supabase.from("sets_current").select("*"),
    supabase.from("desk_sets_current").select("*"),
    supabase.from("body_metrics_current").select("*"),
  ]);
  for (const r of [profile, equipment, sessions, sets, desk, metrics]) {
    if (r.error) throw new Error(r.error.message);
  }

  const history: History = {
    sessions: (sessions.data ?? []).map((s) => ({
      id: s.id!,
      kind: s.kind as SessionKind,
      template: (s.template as TemplateId | null) ?? null,
      startedAt: s.started_at!,
      minutes: s.minutes,
      checkIn: toCheckIn(s.check_in),
      effort: s.effort,
      override: s.override ?? false,
    })),
    sets: (sets.data ?? []).map((x) => ({
      id: x.id!,
      sessionId: x.session_id!,
      exerciseId: x.exercise_id!,
      setIndex: x.set_index!,
      weightLb: x.weight_lb === null ? null : Number(x.weight_lb),
      band: x.band,
      reps: x.reps,
      seconds: x.seconds,
      rir: x.rir,
      kneeFlag: x.knee_flag ?? false,
    })),
    deskSets: (desk.data ?? []).map((d) => ({
      id: d.id!,
      exerciseId: d.exercise_id!,
      reps: d.reps,
      seconds: d.seconds,
      loggedAt: d.logged_at!,
    })),
  };

  return {
    userId,
    profileRow: profile.data,
    equipmentRow: equipment.data,
    profile: profile.data ? toProfile(profile.data) : null,
    equipment: equipment.data ? toEquipment(equipment.data) : null,
    history,
    metrics: (metrics.data ?? []).map((m) => ({
      kind: m.kind as BodyMetric["kind"],
      value: Number(m.value),
      measuredAt: m.measured_at!,
    })),
  };
}
