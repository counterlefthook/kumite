# Kumite build plan

This plan takes Kumite from an empty folder to version 0.1 in production. `docs/SPEC.md` says what the app does; this file says how to build it, in what order, and how to know each step worked.

Each task runs the same way: a branch, a plan-mode review with Chris, the build, then typecheck, lint, tests, and build all passing. Chris tests the Vercel preview URL on his phone before the branch merges into `main`. Tick the boxes as work finishes.

## Stage 1: Setup

### Task 1.1: Scaffold the app

- [x] Create a Next.js app with TypeScript, Tailwind, ESLint, the App Router, a `src/` directory, and the `@/*` import alias. `create-next-app` refuses folders that already contain files, so scaffold into a temporary folder and move its contents up, leaving `CLAUDE.md`, `KICKOFF.md`, and `docs/` untouched.
- [x] Add Vitest with an `npm test` script, and an `npm run typecheck` script (`tsc --noEmit`).
- [x] Add an ESLint `no-restricted-imports` rule that blocks React, Next, and Supabase imports inside `src/engine/`, so the engine stays pure by construction.
- [x] Initialize git and make the first commit on `main`.
- Done when: `npm run build`, `npm test`, `npm run lint`, and `npm run typecheck` all pass on the empty scaffold.

### Task 1.2: GitHub

- [x] Create a private repo named `kumite` on Chris's counterlefthook GitHub account. If the GitHub CLI (`gh`) is installed and signed in, use `gh repo create`. Otherwise Chris creates an empty private repo on github.com (no README, no .gitignore, no license) and Claude Code adds it as the remote.
- [x] Push `main`.
- Done when: the code shows up on GitHub.

### Task 1.3: Supabase

Chris, in the Supabase dashboard:
- [x] Create a project named `kumite` in the East US (North Virginia) region, which sits next to Vercel's default function region, so database calls stay short. Use the same Supabase account and organization as Baby Tracker; each app gets its own project. Save the database password in a password manager.
- [x] Security options when creating the project: Enable Data API on, Enable automatic RLS on, Automatically expose new tables off. Migrations grant access table by table (see Task 2.1).
- [x] Copy the project URL and the publishable key from the project's API settings.
- [x] In Authentication, Users, choose Add user, then Create new user: Chris's email, a strong password saved in the password manager, and Auto Confirm User on, so no confirmation email is sent.
- [x] In the Authentication sign-in settings, turn off Allow new users to sign up. The app has a sign-in screen and no sign-up screen.

Claude Code:
- [x] Run `npx supabase init`, then `npx supabase link --project-ref <ref>`. Chris supplies the project ref and database password when prompted.
- [x] Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and confirm git ignores it.
- Done when: `npx supabase migration list` connects to the hosted project without errors.

### Task 1.4: Vercel

- [x] Create a Vercel project from the GitHub repo. Chris can do this in the Vercel dashboard, or ask Claude in chat to create it with the Vercel connector.
- [x] Chris adds `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the Vercel project's environment variables for Production and Preview. Keys are pasted directly into Vercel and never into a chat.
- Done when: the production URL shows the scaffold, and a pushed test branch gets its own preview URL.

## Stage 2: Build version 0.1

### Task 2.1: Schema and seed data (branch `feat/schema`)

- [x] Migration `init`: the tables in the Schema section below, with row-level security. New tables are not exposed automatically, so the migration also grants each table's allowed actions to the `authenticated` role, matching the policies (log tables get select and insert only). The `anon` role gets no grants on user tables.
- [x] Migration `seed_exercises`: insert every exercise from `docs/exercise-library.json`. Generate the SQL from the JSON with a small script checked into `scripts/`, so the seed can be regenerated if the library changes.
- [x] A `*_current` view for each log table that hides superseded and voiding rows. Create each view with `security_invoker = true`; without it, a Postgres view runs with its owner's permissions and skips row-level security.
- [x] Checks in `supabase/checks.sql`: signed-out access refused, own rows only, no edits or deletes on logs, corrections and voids, value limits. `npm test` runs them against a local Postgres (PGlite) with every migration applied; `node scripts/check-db.mjs` runs them against the hosted project.
- [x] Push the migrations and generate TypeScript types into `src/lib/database.types.ts`.
- Done when: the migrations apply cleanly, a request with the publishable key and no signed-in user is refused by every table and view, a signed-in user reads back all 36 exercises, and `node scripts/check-db.mjs` passes.

### Task 2.2: Workout engine (branch `feat/engine`)

Build the engine as pure functions with tests written alongside each rule. This comes before any screen because a rule bug here would mis-progress Chris for weeks without anything looking broken.

- [x] Module layout in `src/engine/`: `types.ts`, `library.ts` (reads and validates the exercise library shape), `calendar.ts`, `targets.ts`, `pacing.ts`, `progression.ts`, `pullups.ts`, `guardrails.ts`, `timebox.ts`, `desk.ts`, `metrics.ts`, and `generate.ts` as the single entry point that returns a workout plan.
- [x] Time-zone math uses a well-maintained library (for example `date-fns` with `@date-fns/tz`), never hand-written offsets.
- [x] Implement every rule in the Engine rules section below.
- [x] Write every test in the Required tests section below, as table-driven Vitest cases with plain-language names.
- Done when: all required tests pass, and the lint rule confirms nothing in `src/engine/` imports React, Next, or Supabase.

### Task 2.3: Kumite look and install (branch `feat/look`)

Moved up from the end of the stage (decided 2026-09-24) so every screen after it is built in the Kumite style.

- [x] Design tokens (colors, fonts, spacing) defined in one place: an original fighting-game style with dark stone, blood red, fire orange, and carved gold, at strong contrast. No game or film logos, names, characters, or fonts.
- [x] A carved display face for the title and big headings (for example Cinzel, loaded through `next/font`), and a highly readable face for body text and logging (for example Atkinson Hyperlegible).
- [x] Shared pieces the later screens reuse: the gold title, a health-bar progress meter, a stone panel, and big buttons (at least 48 px, most 64 px or more).
- [x] A title screen replaces the Next.js starter page.
- [x] An original Kumite emblem as the app icon (192 px, 512 px, and a 180 px Apple touch icon).
- [x] Web app manifest: name, short name, theme color, and standalone display.
- Done when: the production URL shows the Kumite title screen, and Chris adds Kumite from Safari's Share menu to his home screen and it launches full screen with the Kumite icon.

### Task 2.4: Sign-in (branch `feat/auth`)

- [x] A sign-in screen with email and password through Supabase Auth, and no sign-up or forgot-password flow. Chris signs in once inside the installed app (it keeps its storage separate from Safari), and the session then refreshes itself on every visit. No emailed links or codes anywhere; a forgotten password is reset in the Supabase dashboard.
- [x] Use `@supabase/ssr` following Supabase's current Next.js guide for the server client, browser client, and session refresh.
- [x] Every route requires sign-in except the sign-in page, the manifest, and icons.
- [x] A sign-out button in Settings.
- Done when: Chris signs in on the installed app and is still signed in after closing and reopening it.

### Task 2.5: Idea button (branch `feat/ideas`)

Modeled on Baby Tracker's dev notes.

- [x] Migration `dev_notes`: `id`, `user_id`, `body`, `screen`, `app_version`, `status` (`open`, `planned`, `done`), `addressed_in`, `created_at`, with row-level security. Chris inserts and reads his own notes; status changes are made by Claude from the cloud session with the Supabase access token.
- [x] An idea button on every screen that opens a sheet with a text box and saves the note with the current screen and app version.
- [x] At the start of each later task, Claude reads the open notes and raises them with Chris; notes that ship get `status = done` and the version.
- Done when: a note saved on the phone appears in the table with its screen and version.

### Task 2.6: Onboarding and calibration (branch `feat/onboarding`)

- [x] Profile: height, weight, and a program start date that defaults to today.
- [x] Equipment: dumbbell settings (enter the lowest weight, highest weight, and step, or type the list), bench type, pull-up bar, and bands listed heaviest to lightest.
- [x] Work hours (default 9:00 to 17:00), desk targets, the weekly Peloton target (default 60 minutes), and home workouts a week (default 3), prefilled with the defaults in Engine rules. A migration adds `peloton_minutes_week` and `home_workouts_week` to `profile`.
- [x] Calibration, which can run across two sessions (Chris enters the setting he found for each rung-1 exercise, plus his maxes and band; each template's entries save as one calibration session) (the A exercises, then the B exercises), each counting as that template's first session. For rung 1 of each ladder, find the dumbbell setting done for 10 to 12 reps with 2 in reserve. Also record max push-ups, max chair squats (capped at 50), max strict pull-ups, and the heaviest band that allows 5 assisted pull-ups.
- Done when: onboarding saves the profile and equipment rows, and the calibration sets feed the engine's starting loads.

### Task 2.7: Day planner in the engine (branch `feat/day-planner`)

- [x] Make the check-in optional in `generate()`: with none, the recovery check, leg cap, and check-in knee swap are skipped.
- [x] Add `planDay()` in `src/engine/day.ts` following "Planning the day" below: the home screen's bars, the nudge, and the answer to "Gym today?".
- [x] Peloton minutes this week from `ride` sessions; fight days excused from desk goals in the nudge and the streak.
- [x] Table-driven tests for every rule in "Planning the day".
- Done when: the new tests and all existing engine tests pass.

### Task 2.8: Home screen (branch `feat/home`)

- [x] Health bars for today's desk goals, and this week's Peloton minutes and home workouts.
- [x] The nudge line from `planDay()`.
- [x] "At your desk?": the one desk exercise to do now, huge, with a DONE button that logs a `desk_sets` row; FLAWLESS when every desk goal for the day is met.
- [x] "Gym today?": yes shows the fight day screen with a button to log the class; no shows the suggestion from `planDay()`.
- Done when: Chris logs desk sets from the phone and the bars fill, and both gym answers show the right screen.

### Task 2.9: Home workout (branch `feat/workout`)

- [x] "OK, here's what we're going to do": the workout from `generate()` as one line per exercise with weight, sets, and reps.
- [x] Set logging: weight and reps prefilled from the plan, one tap to accept, steppers to adjust, reps-in-reserve buttons (0, 1, 2, 3, 4+), a knee flag on squat-slot sets, and a rest timer between pairs.
- Done when: Chris completes an A session and a B session, and the next suggestion reflects what he logged.

### Task 2.10: Fight classes, Peloton, and body metrics (branch `feat/other-logs`)

- [x] Fight class: kickboxing or MMA, minutes, effort (1 to 10), and estimated calories.
- [x] Peloton: ride or class, minutes, and for rides Peloton's output (kJ) and calorie figure. Saved as `ride` sessions, with "Peloton ride" or "Peloton class" in `notes`.
- [x] Body metrics: morning weight (daily, optional) and waist (weekly).
- Done when: each saves as an append-only row, and Peloton minutes move the home screen's bar.

### Task 2.11: Release 0.1

- [x] Merge to `main`, tag `v0.1.0`, and confirm the production deploy.
- [ ] ~~Chris installs the production app, runs onboarding, and completes calibration.~~ Not done; superseded by Stage 4.
- Done when: superseded.

## Stage 3: Live with it (superseded 2026-09-25)

v0.1 was never installed. Stage 4 replaces this stage; see `docs/SPEC.md` for why.

## Stage 4: Build version 0.2

Same working rules as Stage 2: one task per branch, plan-mode review first, then typecheck, lint, tests, and build all passing, then Chris checks the Vercel preview on his phone before merging.

### Task 4.1: Reset the docs (branch `feat/v0.2-plan`)

- [x] Replace `docs/SPEC.md` with the v0.2 spec and add Stage 4 to this file.
- [x] Mark v0.1 knee rules and the two home-screen questions as removed in Engine rules.
- Done when: both files are merged to `main`.

### Task 4.2: Nudge engine (branch `feat/nudge-engine`)

- [x] `src/engine/nudge.ts`: `pickNudge({ now, library, profile, history, lastNudgeAt, fightDay?, classPick? })` returning `null` or `{ kind, text, action, exerciseId?, reps?, url? }`, following the Reminders section of the spec and the Nudge rules below. Pure, like the rest of the engine.
- [x] Reuse `desk.ts` for the furthest-behind desk exercise (a new `deskRanking()` factored out of `deskBreak()`) and `day.ts` for fight, strength, and rest classification.
- [x] Migration `nudges_and_push`: `push_subscriptions` (`id`, `user_id`, `endpoint` unique per user, `p256dh`, `auth`, `user_agent`, `created_at`) and `nudge_log` (`id`, `user_id`, `kind`, `text`, `channel`, `sent_at`), both with row-level security. `nudge_log` is append-only and written only by the server; "acted on" is derived from `desk_sets` later rather than stored (an `acted_at` column would need an update, which log tables never allow).
- [x] Table-driven tests for every rule in Nudge rules.
- [x] Fixed `at()` in `test-helpers.ts` to build dates from components: the old string form was read in the machine's time zone, so the suite only passed on a Central-time PC.
- Done when: tests pass and the lint rule still confirms the engine imports nothing from React, Next, or Supabase.

### Task 4.3: Web push (branch `feat/push`)

- [ ] Generate a VAPID key pair once (`npx web-push generate-vapid-keys`). Chris adds `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a mailto address), and `CRON_SECRET` to Vercel for Production and Preview. Only the public key ships to the browser, as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- [ ] Service worker at `public/sw.js`: handles `push` (show the notification) and `notificationclick` (open the app at the nudge's URL).
- [ ] Settings: an "Enable notifications" button that registers the service worker, requests permission, subscribes, and saves the subscription. Explain on screen that iOS needs the app installed to the home screen first.
- [ ] Route `src/app/api/cron/nudge/route.ts`: rejects requests without the `CRON_SECRET` bearer token (Vercel sends it automatically), loads profile and history, calls `pickNudge`, sends through `web-push` to every subscription, records a `nudge_log` row, and deletes subscriptions that return 404 or 410 (expired).
- [ ] `vercel.json` cron: `0 12-22 * * 1-5` (hourly, UTC, wide enough to cover 7:00 to 16:00 Central through both daylight and standard time; the route decides in local time whether anything is due) plus `30 23 * * *` for the evening catch-up and `0 1 * * 1` for the Sunday recap (Sunday 19:00 Central is Monday 00:00 or 01:00 UTC, so the route checks local time).
- [ ] Nudge landing screen `src/app/do/page.tsx`: the exact set from the notification and one DONE button that writes a `desk_sets` row.
- Done when: Chris enables notifications on the installed app, a nudge arrives at the top of the next hour, and tapping DONE moves the home screen bar.

### Task 4.4: Peloton import (branch `feat/peloton-import`)

- [ ] Chris adds `PELOTON_EMAIL` and `PELOTON_PASSWORD` to Vercel. Never logged, never in the browser, never in a chat.
- [ ] `src/lib/peloton.ts`: sign in, list workouts since a date, fetch class detail. Server-only. Every call wrapped so a failure returns a typed error rather than throwing into a page.
- [ ] Migration `peloton`: `sessions` gains `peloton_workout_id` (text, unique per user) and `peloton_class_id`; new table `peloton_classes` (`id`, `title`, `instructor`, `discipline`, `duration_min`, `body_focus`, `equipment`, `difficulty`, `url`, `fetched_at`); new table `peloton_sync` (`user_id`, `last_success_at`, `last_error`, `updated_at`).
- [ ] Route `src/app/api/cron/peloton-sync/route.ts` on `0 8 * * *` UTC (3:00 Central), plus a sync button on the home screen. Rides become `ride` sessions with minutes, output, and calories; strength classes become `strength` sessions with `template = null`. Existing `peloton_workout_id` rows are skipped.
- [ ] Home screen shows "Synced 4 h ago" or the last error.
- Done when: Chris's last two weeks of Peloton rides and classes appear as sessions with no manual entry.

### Task 4.5: Class recommender, collection stage (branch `feat/recommender`)

- [ ] Migration `collection`: `class_picks` (`user_id`, `peloton_class_id`, `body_focus`, `duration_min`, `rating` -1 to 1, `added_at`).
- [ ] Chris supplies 15 to 20 bookmarked classes; a settings screen lists them with body focus and duration editable.
- [ ] `src/engine/recommend.ts`: `pickClass({ history, picks, minutes })` following the Recommender rules below. Tests.
- [ ] Morning and evening nudges and the home screen use the pick, with the Peloton deep link.
- [ ] Thumbs up or down on the home screen after an imported strength class updates `rating`.
- Done when: two consecutive strength days get different body focuses and the link opens the class in the Peloton app.

### Task 4.6: Home screen rewrite (branch `feat/home-v2`)

- [ ] Replace `src/app/page.tsx`, `desk/`, and `gym/` with the single screen in the spec: today's one thing, desk bars with +N buttons, the week against quota, sync status, a "Fight day" toggle.
- [ ] Remove the calibration gate. The fallback workout (`workout/[id]`) asks for a starting weight when an exercise has no logged set.
- [ ] Remove knee-swap paths from the UI; the engine keeps the code switched off.
- Done when: a fresh sign-in reaches a working home screen with no onboarding beyond profile and desk hours.

### Task 4.7: Slack nudges (branch `feat/slack`)

- [ ] Chris creates an incoming webhook in his personal Slack workspace and adds `SLACK_WEBHOOK_URL` to Vercel.
- [ ] The nudge route posts desk nudges to Slack as well as push, with the same text and a link to the DONE screen.
- Done when: an hourly nudge arrives in Slack and on the phone at the same minute.

### Task 4.8: Sunday recap email (branch `feat/recap`)

- [ ] Chris creates a Resend account, verifies a sending domain or uses the Resend test domain, and adds `RESEND_API_KEY` and `RECAP_TO_EMAIL` to Vercel.
- [ ] `src/engine/recap.ts` builds the numbers (pure); a React Email template renders them; the cron route sends it.
- Done when: Sunday's email shows the week's sessions against quota, weight trend, waist, and pull-up max.

### Task 4.9: Release 0.2

- [ ] Merge to `main`, tag `v0.2.0`, confirm the production deploy.
- [ ] Chris installs the production app, enables notifications, and runs one week on it.
- Done when: Chris has received a week of nudges and the Sunday email on production.

## Schema

Config tables are editable. Log tables are append-only: corrections are new rows that point at the old row through `supersedes`, and a correction with `voided = true` cancels the old row. The `*_current` views hide superseded and voiding rows. Every table has row-level security; users read and write only rows where `user_id = auth.uid()`.

| Table | Kind | Columns |
| --- | --- | --- |
| `profile` | Config, one row per user | `user_id` (primary key, references `auth.users`), `height_in`, `baseline_weight_lb`, `program_start_date`, `protein_target_g` (default 185), `work_start` (default 09:00), `work_end` (default 17:00), `desk_targets` (jsonb, defaults below), `peloton_minutes_week` (default 60), `home_workouts_week` (default 3), `timezone` (default America/Chicago), `created_at`, `updated_at` |
| `equipment` | Config, one row per user | `user_id` (primary key), `dumbbell_settings_lb` (numeric array, ascending), `bench` (`flat` or `adjustable`), `pullup_bar` (boolean), `bands` (jsonb array, heaviest to lightest), `updated_at` |
| `exercises` | Seeded, read-only | `id` (text primary key), `name`, `ladder`, `rung`, `grp`, `load`, `dumbbells`, `equipment` (text array), `context` (text array), `unilateral`, `rep_min`, `rep_max`, `sec_min`, `sec_max`, `knee`, `cue` |
| `sessions` | Log | `id` (uuid), `user_id`, `kind` (`strength`, `fight`, `ride`, `mobility`, `calibration`, `max_test`), `template` (`A`, `B`, or null), `started_at`, `minutes`, `time_box` (`10`, `20`, `30`, or null), `check_in` (jsonb: `soreness_legs`, `soreness_upper`, `energy`, `knee_pain`, `fight_next_24h`), `effort`, `fight_type`, `ride_output_kj`, `ride_kcal`, `override` (boolean), `notes`, `supersedes`, `voided`, `created_at` |
| `sets` | Log | `id`, `user_id`, `session_id`, `exercise_id`, `set_index`, `weight_lb` (per dumbbell), `band`, `reps`, `seconds`, `rir` (0 to 4, where 4 means 4 or more), `knee_flag`, `supersedes`, `voided`, `created_at` |
| `desk_sets` | Log | `id`, `user_id`, `exercise_id`, `reps`, `seconds` (wall sits), `logged_at`, `supersedes`, `voided`, `created_at` |
| `body_metrics` | Log | `id`, `user_id`, `kind` (`weight_lb` or `waist_in`), `value`, `measured_at`, `supersedes`, `voided`, `created_at` |
| `dev_notes` | Feedback (Task 2.5) | `id`, `user_id`, `body`, `screen`, `app_version`, `status` (`open`, `planned`, `done`), `addressed_in`, `created_at` |

Policies: config tables allow select, insert, and update on the user's own row. `exercises` allows select for signed-in users. Log tables allow select and insert only.

## Engine rules

Version 0.2 note (2026-09-25): the knee-swap rules, the recovery check, and the leg cap remain in the engine but are switched off and are not used anywhere in the UI. "At your desk?" and "Gym today?" no longer exist; a fight day is a logged or imported `fight` session that day, or the home-screen toggle.

### Nudge rules (v0.2)

- Local time is America/Chicago from `profile.timezone`. Weekday means Monday to Friday.
- 07:00 daily: morning plan. Text is the day's one thing from `planDay()` plus the class pick when it is a strength day.
- Hourly at :00 from 08:00 to 16:00 on weekdays: a desk nudge for the desk exercise furthest behind pace (the `desk.ts` rule), sized as a mini-set. Skipped when all desk targets are met, when a `fight` or `strength` session started in the last 60 minutes, or when a nudge of any kind was sent in the last 45 minutes. An exercise logged as a desk set in the last 20 minutes is not asked for again; the next in the ranking is.
- Mini-set size: half the latest logged max (a `max_test` or calibration set), or 15 push-ups, 20 squats, and 1 pull-up single before any max exists. Never more than what is left of the day's target.
- Due window: each scheduled minute counts as due for 15 minutes, so a job that runs a few minutes late still fires.
- On a fight day, desk targets are halved before pace is computed.
- 18:30 daily: evening catch-up, only when the day is a strength day by `planDay()` and no `strength` session is logged today. Text names the shortest class pick (10 minutes) with its link.
- Sunday 19:00: recap (email only; the nudge function returns `kind = "recap"` and the route builds the email).
- Anything else returns `null`.

### Recommender rules (v0.2)

- Body focus rotation: if the last strength session in the log was upper, pick lower or full; if lower, pick upper or full; if full or none, pick upper.
- Duration: `minutes` from the caller (20 by default, 10 on a squeeze day by the v0.1 rule, 30 when the week is on pace and the day is free). Choose the largest duration in the collection that is at most `minutes`.
- Among candidates, exclude any class taken in the last 30 days, then prefer `rating = 1`, then least recently taken, then the collection order.
- With no candidate after exclusions, drop the 30-day rule, then the duration rule, and pick again. Never return nothing when the collection is non-empty.

The rules below are the v0.1 rules, kept for the fallback home workout and the pull-up ladder.

### Planning the day

Version 0.1 has no check-in (decided 2026-09-24). The rules that need one stay in the engine but are switched off: the recovery check, the leg cap, and the knee swap at check-in. The knee flag on a logged set still applies. Without check-ins, recovery never counts as holding, so weeks 5 onward use 9 hard sets and 3 rounds.

- Home screen: today's desk goals on workdays (Desk sets below), Peloton minutes this week against the weekly target (default 60), and home workouts (strength sessions) this week against the weekly target (default 3).
- "At your desk?": the desk break rule in step 4 below.
- "Gym today?", yes: a fight day. Nothing else is suggested. The class logs afterward as a `fight` session. Desk sets can still be logged, but that day's desk goals are excused: the nudge ignores them and the streak skips the day.
- "Gym today?", no: compare the share done this week, home workouts ÷ target and Peloton minutes ÷ target. The lower share wins; a tie goes to the home workout. A home workout is not offered the day after one (step 2 below) unless the quota squeeze applies (step 6); then the Peloton is offered if it is short, else a rest day. With both targets met, it is a rest day with desk sets optional.
- The home workout is the 30-minute box (step 4), or the 20-minute box on a squeeze day. There is no time picker in 0.1.
- Nudge: while Peloton minutes are short, "You still need N minutes on the Peloton this week: a class or a ride." When desk sets were logged today, it starts "You've done some desk sets, but".
- Fight days are known from a `fight` session logged that day, or from "Gym today?" answered yes.

### Definitions

- Working set: a set logged in a strength session.
- Hard set: a working set with 3 or fewer reps in reserve. Desk sets never count.
- Group: taken from the exercise's ladder in `docs/exercise-library.json`. Push, pull, squat, and hinge have weekly targets; core and arms are tracked without one.
- Program week: week 1 is the Monday-to-Sunday week (America/Chicago) that contains `program_start_date`.
- Current rung and load for a ladder: derived from the most recent session that included that ladder.

### Weekly targets and rounds

| Program week | Hard sets per targeted group | Rounds per pair |
| --- | --- | --- |
| 1 and 2 | 6 | 2 |
| 3 and 4 | 9 | 3 |
| 5 onward, recovery holding | 12 | 4 |
| 5 onward, recovery not holding | 9 | 3 |

Recovery is holding when, across the previous two program weeks, average check-in soreness (the higher of legs and upper on each check-in) is 3 or lower and average energy is 3 or higher. No check-ins in those two weeks counts as not holding. Dates before `program_start_date` count as week 1.

### Pace

- `day_index`: Monday is 1 through Sunday 7, in local time.
- `pace = target × day_index ÷ 7`, and `deficit = pace − hard sets logged this week` for each targeted group.
- Groups rank by deficit, largest first. Ties break in the order squat, pull, hinge, push.

### Choosing today's suggestion, in order

1. Recovery check: upper-body soreness of 4 or more, or energy of 2 or less, suggests an easy 30-minute Zone 2 ride or 15 minutes of mobility instead of strength. Sore legs alone still train, with the leg cap in step 5.
2. Spacing: if a strength session was logged yesterday (local date), suggest a ride, mobility, or desk sets. "Train anyway" is allowed and logs `override = true`. A desk break skips steps 1 and 2, since desk sets are not hard training.
3. Template: A if no strength session exists yet; otherwise the opposite of the most recent strength session's template. Calibration sessions count as their template's first session. Alternation ignores week boundaries.
4. Time box:
   - 30 minutes: pair 1, then pair 2, at the week's rounds, then the finisher. Offer the optional arm finisher afterward. Both finishers also run at the week's rounds.
   - 20 minutes: pair 1 and pair 2 at the week's rounds, with no finisher.
   - 10 minutes: one pair as EMOM for 10 minutes (5 sets of each exercise, alternating every minute). Choose the pair whose two groups have the larger combined deficit; a tie keeps pair 1.
   - Desk break: one desk exercise, the one furthest behind its target so far today, sized as a mini-set. "Furthest behind" is the biggest shortfall against the daily target times the share of the workday gone, measured as a share of the daily target. Ties go push-ups, chair squats, pull-up singles. Before work starts and on weekends, it picks the one with the smallest share of the weekday target done.
5. Guardrail caps:
   - Fight training in the next 24 hours, or leg soreness of 4 or more: squat and hinge exercises get at most 2 sets, with a target of at least 2 reps in reserve.
   - Knee pain above 3 at check-in: swap the squat slot using `knee_swaps` (A: unilateral squat becomes the hip thrust ladder; B: box squat becomes the Romanian deadlift ladder), at that ladder's current rung and load. Those sets count toward hinge.
6. Quota squeeze: with `strength_left = 3 − strength sessions this week` and `days_left` counting today, if `2 × strength_left − 1 > days_left`, stop suggesting rides, and allow strength on consecutive days using the 20-minute time box. The recovery check (step 1) still wins. The squeeze only overrides spacing (step 2): strength is suggested without "train anyway", and a 30-minute pick becomes 20.
7. Output: for each exercise, the name, cue, target load (dumbbell setting, band, or bodyweight), rep or seconds range, rounds, target reps in reserve (1 to 2 by default, 2 or more when capped), and rest after each pair (75 seconds by default, 60 to 90 allowed), plus the plain-language reason for every adjustment.

### Progression for dumbbell exercises

Evaluated from the most recent session that included the exercise. The current state is rebuilt by replaying every session of the ladder in order, using the weight actually logged at each step.

- Topped: every working set reached the top of the rep range with at least 1 rep in reserve.
- Missed: at least one working set fell below the bottom of the range in each of the last two sessions with that exercise.
- Topped and below the highest dumbbell setting: the next session uses the next setting up.
- Topped at the highest setting: widen the range. 8 to 12 becomes 12 to 15, then 15 to 20. 10 to 15 and 8 to 15 become 15 to 20.
- Topped at 15 to 20 on the highest setting: move to the next rung, starting at 75% of the current setting rounded down to an available setting (never below the lowest), with the new exercise's base range. A bodyweight next rung has no load.
- Topped at 15 to 20 on the last rung: add one set to that exercise (maximum 4) and mark the ladder complete. Each further top adds another set on top of the week's rounds, still at most 4.
- Missed: drop one setting (never below the lowest) and keep the range.
- Anything else: hold weight and range.
- Knee flag: when any squat-slot set is flagged, the rest of that exercise's sets that session swap using `knee_swaps`, and next time that exercise drops one rung (or one setting when already on rung 1). The lower rung keeps the same dumbbell setting and uses its base range.
- A rung change takes precedence over a load change when both would apply.
- Bodyweight exercises follow the same rules without load: top of range, then widen, then next rung, then an added set on the last rung.
- Holds (seconds): when all sets reach the top of the seconds range, move to the next rung. On the last rung, raise the range by 10 seconds at the bottom and 15 at the top, up to a 90-second top, then hold (side plank: 20-45, 30-60, 40-75, 50-90).
- Calibration sets the starting load for rung 1 of each ladder. If Chris cannot reach 10 reps at the lowest setting, start at the lowest setting and let the rules take over. A ladder with no calibration starts at the lowest setting.

### Pull-up stages

- Stage 1: band-assisted pull-ups, sets of 5 to 8 at the week's rounds (2, 3, or 4) with the current band (starting with the heaviest band that allowed 5 reps in calibration), then 3 negatives lowered over 3 to 5 seconds.
- Stage 2: when all band sets reach 8, the next session moves to the next lighter band, with the same sets and negatives. Repeat until the lightest band.
- Stage 3: after all sets reach 8 on the lightest band, switch to strict sets: the week's rounds of (latest max minus 1, minimum 1), then one band-assisted back-off set to 8 on the lightest band. No negatives.
- Stage 4: once a max test reaches 5, start at 3 strict sets of (latest max minus 2, minimum 1). Each new program week adds one rep to every set until reps reach max minus 1, then one set a week up to 5, then holds. A new max test starts over.
- A 10-minute EMOM skips the negatives and the back-off set.
- Max test: offered once 14 days have passed since the last test, and required by day 21. It logs as a `max_test` session with a single all-out set.
- Milestones at 5, 8, and 10 strict reps get a celebration screen.

### Desk sets

- Daily targets: push-ups 100 a day; chair squats 25 per work hour (200 across a 9:00 to 17:00 workday); pull-up singles 5 a day. All editable in Settings.
- Mini-set size: half the latest max for that exercise, rounded down, minimum 1. Maxes come from calibration, a push-up retest every 4 weeks, and pull-up max tests. Pull-up singles are always 1 rep.
- Knee pain above 3 at the day's check-in swaps chair squats for glute bridges that day. Glute bridges are sized from the chair squat max and count toward the squat target.
- Workdays are Monday to Friday. Weekends show totals without targets.

### Derived metrics

- Estimated 1-rep max (Epley): weight × (1 + reps ÷ 30), from the best set per exercise per session. Compare only within one exercise.
- 7-day average weight: the mean of weigh-ins over the 7 local calendar days ending today, shown only when there are at least 3.
- Fight session calories: MET × body weight in kg × hours, using the 7-day average weight or the latest weigh-in. Take MET values from the 2024 Adult Compendium of Physical Activities and cite the activity codes in a code comment. Every fight session uses code 15430 (martial arts, moderate pace, including kickboxing and Muay Thai), MET 10.3, whatever the effort.
- Streak: consecutive workdays with every desk target met. Weekends are skipped, and today counts only once its targets are met, so an unfinished today does not break the streak.

### Required tests

1. Topped below the highest setting moves to the next setting.
2. Topped at the highest setting widens 8 to 12 into 12 to 15, then 15 to 20; topped at 15 to 20 moves to the next rung at 75% rounded down.
3. Topped at 15 to 20 on the last rung adds a set, capped at 4.
4. A miss in two consecutive sessions drops one setting; a single miss holds.
5. Mixed results hold weight and range.
6. Bodyweight and hold progressions, including the hold range increase on the last rung.
7. Pull-ups: band steps in Stage 2, the switch to strict sets in Stage 3, the Stage 4 threshold at a max of 5, and a max test due at 14 days and required at 21.
8. Pace ranking on a Monday and a Thursday with partial logs, including the tie-break order.
9. Weekly targets and rounds in weeks 1, 3, and 5, with recovery holding and not holding.
10. Each guardrail: the recovery check, strength yesterday with and without override, the fight-within-24-hours cap, and the knee swap for each template.
11. Time boxes of 30, 20, and 10 minutes (including pair choice by deficit), plus a desk break.
12. The quota squeeze when days run short.
13. A and B alternation across a week boundary.
14. Week boundaries at Sunday 23:59 and Monday 00:00 in America/Chicago, including a week that crosses a daylight saving change.
15. Mini-set sizing and the desk squat swap on sore-knee days.
16. Epley, and the 7-day average with fewer than 3 weigh-ins.

## Parking lot

Ideas and gaps captured during the build go here instead of into the current task.

- Week view (moved out of 0.1 on 2026-09-24): hard sets per group against the week's target with a pace marker, fight sessions, and pull-up progress against the 5, 8, and 10 milestones. The home screen covers the week's goals for now.
- Time picker (10 or 20-minute workouts on busy days) and the check-in rules: both still in the engine, switched off in 0.1.

