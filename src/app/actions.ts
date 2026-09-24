"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { localDate } from "@/engine/calendar";
import { APP_VERSION, LIBRARY } from "@/lib/data";
import { CALIBRATION, ZONE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

// Every write in the app goes through these server actions, as Chris, under
// the database's row-level security. Log tables only ever get new rows.


function back(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

function int(form: FormData, key: string): number | null {
  const v = String(form.get(key) ?? "").trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

function dec(form: FormData, key: string): number | null {
  const v = String(form.get(key) ?? "").trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// ---------- sign-in ----------

export async function signIn(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  });
  if (error) back("/signin", "That email and password did not match.");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/signin");
}

// ---------- ideas ----------

export async function saveIdea(body: string, screen: string): Promise<{ ok: boolean; error?: string }> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Write something first." };
  const supabase = await createClient();
  const { error } = await supabase.from("dev_notes").insert({ body: text.slice(0, 4000), screen, app_version: APP_VERSION });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ---------- desk sets ----------

export async function logDesk(form: FormData) {
  const exerciseId = String(form.get("exercise_id") ?? "");
  const reps = int(form, "reps");
  if (!LIBRARY.exercises.some((e) => e.id === exerciseId && e.context.includes("desk")) || !reps || reps < 1) {
    back("/", "Could not log that desk set.");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("desk_sets").insert({ exercise_id: exerciseId, reps });
  if (error) back("/", error.message);
  revalidatePath("/");
  redirect("/");
}

// ---------- where Chris is today (Desk / Gym / Out) ----------

export async function setWhere(form: FormData) {
  const where = String(form.get("where") ?? "");
  if (where !== "desk" && where !== "gym" && where !== "out") back("/", "Pick desk, gym, or out.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("profile")
    .update({ location: where, location_date: localDate(new Date(), ZONE) })
    .not("user_id", "is", null);
  if (error) back("/", error.message);
  revalidatePath("/");
  redirect("/");
}

// ---------- other logs ----------

export async function logFight(form: FormData) {
  const from = String(form.get("from") ?? "/log");
  const minutes = int(form, "minutes");
  const effort = int(form, "effort");
  const type = String(form.get("fight_type") ?? "");
  if (!minutes || minutes < 1 || minutes > 600) back(from, "Minutes should be between 1 and 600.");
  if (effort !== null && (Number.isNaN(effort) || effort < 1 || effort > 10)) back(from, "Effort is 1 to 10.");
  if (type !== "kickboxing" && type !== "mma") back(from, "Pick kickboxing or MMA.");
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").insert({ kind: "fight", minutes, effort, fight_type: type });
  if (error) back(from, error.message);
  revalidatePath("/");
  redirect("/?done=fight");
}

export async function logPeloton(form: FormData) {
  const minutes = int(form, "minutes");
  const kj = dec(form, "output_kj");
  const kcal = dec(form, "kcal");
  const type = form.get("peloton_type") === "class" ? "class" : "ride";
  if (!minutes || minutes < 1 || minutes > 600) back("/log", "Minutes should be between 1 and 600.");
  if ((kj !== null && (Number.isNaN(kj) || kj < 0)) || (kcal !== null && (Number.isNaN(kcal) || kcal < 0))) {
    back("/log", "Output and calories should be numbers.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .insert({ kind: "ride", minutes, ride_output_kj: kj, ride_kcal: kcal, notes: `Peloton ${type}` });
  if (error) back("/log", error.message);
  revalidatePath("/");
  redirect("/?done=peloton");
}

export async function logBody(form: FormData) {
  const weight = dec(form, "weight_lb");
  const waist = dec(form, "waist_in");
  if (weight === null && waist === null) back("/log", "Enter a weight or a waist measurement.");
  if ((weight !== null && !(weight > 50 && weight < 600)) || (waist !== null && !(waist > 10 && waist < 100))) {
    back("/log", "That number looks off. Weight is in pounds, waist in inches.");
  }
  const rows = [
    ...(weight !== null ? [{ kind: "weight_lb", value: weight }] : []),
    ...(waist !== null ? [{ kind: "waist_in", value: waist }] : []),
  ];
  const supabase = await createClient();
  const { error } = await supabase.from("body_metrics").insert(rows);
  if (error) back("/log", error.message);
  revalidatePath("/");
  redirect("/?done=body");
}

// ---------- setup (onboarding and settings) ----------

function parseSettings(form: FormData): number[] | string {
  const list = String(form.get("dumbbell_list") ?? "").trim();
  let values: number[];
  if (list) {
    values = list.split(/[\s,]+/).filter(Boolean).map(Number);
  } else {
    const low = dec(form, "db_low");
    const high = dec(form, "db_high");
    const step = dec(form, "db_step");
    if (!low || !high || !step || low <= 0 || high < low || step <= 0) return "Enter the lowest weight, highest weight, and step, or type the list.";
    values = [];
    for (let w = low; w <= high + 1e-9; w += step) values.push(Math.round(w * 10) / 10);
  }
  if (values.some((v) => !Number.isFinite(v) || v <= 0)) return "Dumbbell settings should be positive numbers.";
  values = [...new Set(values)].sort((a, b) => a - b);
  if (values.length === 0 || values.length > 60) return "Enter between 1 and 60 dumbbell settings.";
  return values;
}

export async function saveSetup(form: FormData) {
  const from = String(form.get("from") ?? "/settings");
  const height = dec(form, "height_in");
  const weight = dec(form, "baseline_weight_lb");
  if (!height || !weight || height < 48 || height > 96 || weight < 80 || weight > 500) {
    back(from, "Check height (inches) and weight (pounds).");
  }
  const settings = parseSettings(form);
  if (typeof settings === "string") back(from, settings);
  const workStart = String(form.get("work_start") ?? "09:00");
  const workEnd = String(form.get("work_end") ?? "17:00");
  if (!(workEnd > workStart)) back(from, "Work end should be after work start.");
  const bands = String(form.get("bands") ?? "")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
  const targets = {
    pushups_per_day: int(form, "pushups_per_day") ?? 100,
    chair_squats_per_work_hour: int(form, "chair_squats_per_work_hour") ?? 25,
    pullup_singles_per_day: int(form, "pullup_singles_per_day") ?? 5,
  };
  if (Object.values(targets).some((v) => Number.isNaN(v) || v < 0 || v > 1000)) back(from, "Desk targets should be whole numbers.");
  const peloton = int(form, "peloton_minutes_week") ?? 60;
  const homeWorkouts = int(form, "home_workouts_week") ?? 3;
  if (Number.isNaN(peloton) || peloton < 0 || peloton > 1000) back(from, "Peloton minutes should be 0 to 1000.");
  if (Number.isNaN(homeWorkouts) || homeWorkouts < 0 || homeWorkouts > 7) back(from, "Home workouts should be 0 to 7.");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/signin");

  const profile = {
    user_id: userId,
    height_in: height!,
    baseline_weight_lb: weight!,
    program_start_date: String(form.get("program_start_date") || localDate(new Date(), ZONE)),
    work_start: workStart,
    work_end: workEnd,
    desk_targets: targets,
    peloton_minutes_week: peloton,
    home_workouts_week: homeWorkouts,
  };
  const equipment = {
    user_id: userId,
    dumbbell_settings_lb: settings as number[],
    bench: form.get("bench") === "flat" ? "flat" : "adjustable",
    pullup_bar: form.get("pullup_bar") === "on",
    bands,
  };
  const p = await supabase.from("profile").upsert(profile);
  if (p.error) back(from, p.error.message);
  const e = await supabase.from("equipment").upsert(equipment);
  if (e.error) back(from, e.error.message);
  revalidatePath("/", "layout");
  redirect(from === "/onboarding" ? "/onboarding/calibrate" : "/?done=settings");
}

// ---------- calibration ----------

export async function saveCalibration(form: FormData) {
  const from = "/onboarding/calibrate";
  const supabase = await createClient();
  const loads = (ids: readonly string[]) =>
    ids.flatMap((id, i) => {
      const w = dec(form, `w_${id}`);
      return w && w > 0 ? [{ exercise_id: id, set_index: i + 1, weight_lb: w, reps: 11, rir: 2 }] : [];
    });
  const a = loads(CALIBRATION.A);
  const b = loads(CALIBRATION.B);

  const pushups = int(form, "max_pushups");
  const squats = int(form, "max_chair_squats");
  const pullups = int(form, "max_pullups");
  const band = String(form.get("band_for_5") ?? "").trim();
  for (const [v, label, max] of [
    [pushups, "push-ups", 200],
    [squats, "chair squats", 50],
    [pullups, "strict pull-ups", 50],
  ] as const) {
    if (v !== null && (Number.isNaN(v) || v < 0 || v > max)) back(from, `Max ${label} should be 0 to ${max}.`);
  }
  const maxes = [
    ...(pushups ? [{ exercise_id: "desk_pushup", set_index: 10, reps: pushups }] : []),
    ...(squats ? [{ exercise_id: "chair_squat", set_index: 11, reps: squats }] : []),
    ...(pullups !== null ? [{ exercise_id: "strict_pullup", set_index: 12, reps: pullups }] : []),
    ...(band ? [{ exercise_id: "band_assisted_pullup", set_index: 13, band, reps: 5 }] : []),
  ];

  for (const [template, sets] of [
    ["A", [...a, ...maxes]],
    ["B", b],
  ] as const) {
    if (sets.length === 0) continue;
    const s = await supabase.from("sessions").insert({ kind: "calibration", template }).select("id").single();
    if (s.error) back(from, s.error.message);
    const r = await supabase.from("sets").insert(sets.map((x) => ({ ...x, session_id: s.data!.id })));
    if (r.error) back(from, r.error.message);
  }
  revalidatePath("/");
  redirect("/?done=calibration");
}

// ---------- workouts ----------

export async function startWorkout(form: FormData) {
  const template = form.get("template") === "B" ? "B" : "A";
  const timeBox = form.get("time_box") === "20" ? "20" : "30";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({ kind: "strength", template, time_box: timeBox })
    .select("id")
    .single();
  if (error) back("/plan", error.message);
  redirect(`/workout/${data!.id}`);
}

export async function logSet(form: FormData) {
  const sessionId = String(form.get("session_id") ?? "");
  const path = `/workout/${sessionId}`;
  const exerciseId = String(form.get("exercise_id") ?? "");
  const setIndex = int(form, "set_index");
  const weight = dec(form, "weight_lb");
  const reps = int(form, "reps");
  const seconds = int(form, "seconds");
  const rir = int(form, "rir");
  if (!LIBRARY.exercises.some((e) => e.id === exerciseId) || !setIndex || setIndex < 1) back(path, "Could not log that set.");
  if (reps === null && seconds === null) back(path, "Enter reps or seconds.");
  if ([reps, seconds].some((v) => v !== null && (Number.isNaN(v) || v < 0 || v > 500))) back(path, "Reps and seconds should be 0 to 500.");
  if (rir !== null && (Number.isNaN(rir) || rir < 0 || rir > 4)) back(path, "Reps in reserve is 0 to 4.");
  if (weight !== null && (Number.isNaN(weight) || weight < 0)) back(path, "Weight should be a number.");
  const supabase = await createClient();
  const { error } = await supabase.from("sets").insert({
    session_id: sessionId,
    exercise_id: exerciseId,
    set_index: setIndex,
    weight_lb: weight,
    band: String(form.get("band") ?? "") || null,
    reps,
    seconds,
    rir,
    knee_flag: form.get("knee_flag") === "on",
  });
  if (error) back(path, error.message);
  revalidatePath(path);
}

// ---------- desk nudges ----------

export async function saveSubscription(sub: {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}): Promise<{ ok: boolean; error?: string }> {
  const endpoint = String(sub?.endpoint ?? "");
  const p256dh = String(sub?.keys?.p256dh ?? "");
  const auth = String(sub?.keys?.auth ?? "");
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return { ok: false, error: "That subscription looks incomplete." };
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({ endpoint, p256dh, auth });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
