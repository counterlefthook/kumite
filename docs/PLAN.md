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

- [ ] Migration `init`: the tables in the Schema section below, with row-level security. New tables are not exposed automatically, so the migration also grants each table's allowed actions to the `authenticated` role, matching the policies (log tables get select and insert only). The `anon` role gets no grants on user tables.
- [ ] Migration `seed_exercises`: insert every exercise from `docs/exercise-library.json`. Generate the SQL from the JSON with a small script checked into `scripts/`, so the seed can be regenerated if the library changes.
- [ ] A `*_current` view for each log table that hides superseded and voiding rows. Create each view with `security_invoker = true`; without it, a Postgres view runs with its owner's permissions and skips row-level security.
- [ ] Checks in `supabase/checks.sql`: signed-out access refused, own rows only, no edits or deletes on logs, corrections and voids, value limits. `npm test` runs them against a local Postgres (PGlite) with every migration applied; `node scripts/check-db.mjs` runs them against the hosted project.
- [ ] Push the migrations and generate TypeScript types into `src/lib/database.types.ts`.
- Done when: the migrations apply cleanly, a request with the publishable key and no signed-in user is refused by every table and view, a signed-in user reads back all 36 exercises, and `node scripts/check-db.mjs` passes.

### Task 2.2: Workout engine (branch `feat/engine`)

Build the engine as pure functions with tests written alongside each rule. This comes before any screen because a rule bug here would mis-progress Chris for weeks without anything looking broken.

- [ ] Module layout in `src/engine/`: `types.ts`, `library.ts` (reads and validates the exercise library shape), `calendar.ts`, `targets.ts`, `pacing.ts`, `progression.ts`, `pullups.ts`, `guardrails.ts`, `timebox.ts`, `desk.ts`, `metrics.ts`, and `generate.ts` as the single entry point that returns a workout plan.
- [ ] Time-zone math uses a well-maintained library (for example `date-fns` with `@date-fns/tz`), never hand-written offsets.
- [ ] Implement every rule in the Engine rules section below.
- [ ] Write every test in the Required tests section below, as table-driven Vitest cases with plain-language names.
- Done when: all required tests pass, and the lint rule confirms nothing in `src/engine/` imports React, Next, or Supabase.

### Task 2.3: Sign-in (branch `feat/auth`)

- [ ] A sign-in screen with email and password through Supabase Auth, and no sign-up or forgot-password flow. Chris signs in once inside the installed app (it keeps its storage separate from Safari), and the session then refreshes itself on every visit. No emailed links or codes anywhere; a forgotten password is reset in the Supabase dashboard.
- [ ] Use `@supabase/ssr` following Supabase's current Next.js guide for the server client, browser client, and session refresh.
- [ ] Every route requires sign-in except the sign-in page, the manifest, and icons.
- [ ] A sign-out button in Settings.
- Done when: Chris signs in on the installed app and is still signed in after closing and reopening it.

### Task 2.4: Onboarding and calibration (branch `feat/onboarding`)

- [ ] Profile: height, weight, and a program start date that defaults to today.
- [ ] Equipment: dumbbell settings (enter the lowest weight, highest weight, and step, or type the list), bench type, pull-up bar, and bands listed heaviest to lightest.
- [ ] Work hours (default 9:00 to 17:00) and desk targets, prefilled with the defaults in Engine rules.
- [ ] Calibration, which can run across two sessions (the A exercises, then the B exercises), each counting as that template's first session. For rung 1 of each ladder, find the dumbbell setting done for 10 to 12 reps with 2 in reserve. Also record max push-ups, max chair squats (capped at 50), max strict pull-ups, and the heaviest band that allows 5 assisted pull-ups.
- Done when: onboarding saves the profile and equipment rows, and the calibration sets feed the engine's starting loads.

### Task 2.5: Today screen (branch `feat/today`)

- [ ] Check-in: leg soreness and upper-body soreness (1 to 5), energy (1 to 5), knee pain (0 to 10), and "fight training in the next 24 hours?" (yes or no).
- [ ] Time picker: 10, 20, or 30 minutes, or a desk break.
- [ ] The generated workout, with a plain-language reason for every adjustment (for example "Legs capped at 2 sets: fight training tomorrow").
- [ ] Set logging: weight and reps prefilled from last time, one tap to accept, steppers to adjust, reps-in-reserve buttons (0, 1, 2, 3, 4+), a knee flag on squat-slot sets, and a rest timer between pairs.
- [ ] "Train anyway" when a guardrail suggests rest, logged as an override.
- Done when: Chris completes an A session and a B session on the preview URL, and the next suggestion reflects what he logged.

### Task 2.6: Desk sets (branch `feat/desk-sets`)

- [ ] Counters for push-ups, chair squats (glute bridges on sore-knee days), and pull-up singles, each with a one-tap button that logs one mini-set.
- [ ] Today's totals against targets, and the workday streak.
- Done when: tapping logs a `desk_sets` row, totals update, and a knee check-in above 3 swaps squats for bridges for that day.

### Task 2.7: Fight sessions, rides, and body metrics (branch `feat/other-logs`)

- [ ] Fight session: kickboxing or MMA, minutes, effort (1 to 10), and estimated calories.
- [ ] Ride: minutes, Peloton output (kJ), Peloton's calorie figure, and effort.
- [ ] Body metrics: morning weight (daily, optional) and waist (weekly).
- Done when: each saves as an append-only row and appears in the week view.

### Task 2.8: Week view (branch `feat/week`)

- [ ] Hard sets per group against the week's target, with a pace marker.
- [ ] Strength sessions done out of 3, fight sessions, rides, and desk totals.
- [ ] Pull-up progress: current stage and the latest max against the 5, 8, and 10 milestones.
- Done when: the numbers match a hand count of the week's logs.

### Task 2.9: Kumite look and install (branch `feat/look`)

- [ ] Design tokens (colors, fonts, spacing) defined in one place: red, white, and blue on a dark navy base with strong contrast.
- [ ] A pixel font for the title screen and big headings (for example Press Start 2P or Pixelify Sans, loaded through `next/font`), and a highly readable font for body text and logging.
- [ ] An original 16-bit Kumite emblem as the app icon (192 px, 512 px, and a 180 px Apple touch icon).
- [ ] Web app manifest: name, short name, theme color, and standalone display.
- Done when: Chris adds Kumite from Safari's Share menu to his home screen, and it launches full screen with the Kumite icon.

### Task 2.10: Release 0.1

- [ ] Merge to `main`, tag `v0.1.0`, and confirm the production deploy.
- [ ] Chris installs the production app, runs onboarding, and completes calibration.
- Done when: Chris logs his first real session on production.

## Stage 3: Live with it

Use Kumite for one to two weeks before starting food tracking (0.2). Real use will expose what the spec missed, and fixes are cheaper before the food layer sits on top. Capture every bug and gap in the Parking lot, then plan 0.2 with the same spec, decisions, and tasks process.

## Schema

Config tables are editable. Log tables are append-only: corrections are new rows that point at the old row through `supersedes`, and a correction with `voided = true` cancels the old row. The `*_current` views hide superseded and voiding rows. Every table has row-level security; users read and write only rows where `user_id = auth.uid()`.

| Table | Kind | Columns |
| --- | --- | --- |
| `profile` | Config, one row per user | `user_id` (primary key, references `auth.users`), `height_in`, `baseline_weight_lb`, `program_start_date`, `protein_target_g` (default 185), `work_start` (default 09:00), `work_end` (default 17:00), `desk_targets` (jsonb, defaults below), `timezone` (default America/Chicago), `created_at`, `updated_at` |
| `equipment` | Config, one row per user | `user_id` (primary key), `dumbbell_settings_lb` (numeric array, ascending), `bench` (`flat` or `adjustable`), `pullup_bar` (boolean), `bands` (jsonb array, heaviest to lightest), `updated_at` |
| `exercises` | Seeded, read-only | `id` (text primary key), `name`, `ladder`, `rung`, `grp`, `load`, `dumbbells`, `equipment` (text array), `context` (text array), `unilateral`, `rep_min`, `rep_max`, `sec_min`, `sec_max`, `knee`, `cue` |
| `sessions` | Log | `id` (uuid), `user_id`, `kind` (`strength`, `fight`, `ride`, `mobility`, `calibration`, `max_test`), `template` (`A`, `B`, or null), `started_at`, `minutes`, `time_box` (`10`, `20`, `30`, or null), `check_in` (jsonb: `soreness_legs`, `soreness_upper`, `energy`, `knee_pain`, `fight_next_24h`), `effort`, `fight_type`, `ride_output_kj`, `ride_kcal`, `override` (boolean), `notes`, `supersedes`, `voided`, `created_at` |
| `sets` | Log | `id`, `user_id`, `session_id`, `exercise_id`, `set_index`, `weight_lb` (per dumbbell), `band`, `reps`, `seconds`, `rir` (0 to 4, where 4 means 4 or more), `knee_flag`, `supersedes`, `voided`, `created_at` |
| `desk_sets` | Log | `id`, `user_id`, `exercise_id`, `reps`, `seconds` (wall sits), `logged_at`, `supersedes`, `voided`, `created_at` |
| `body_metrics` | Log | `id`, `user_id`, `kind` (`weight_lb` or `waist_in`), `value`, `measured_at`, `supersedes`, `voided`, `created_at` |

Policies: config tables allow select, insert, and update on the user's own row. `exercises` allows select for signed-in users. Log tables allow select and insert only.

## Engine rules

These are the precise, testable versions of the rules in `docs/SPEC.md`.

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

Recovery is holding when, across the previous two program weeks, average check-in soreness (the higher of legs and upper on each check-in) is 3 or lower and average energy is 3 or higher.

### Pace

- `day_index`: Monday is 1 through Sunday 7, in local time.
- `pace = target × day_index ÷ 7`, and `deficit = pace − hard sets logged this week` for each targeted group.
- Groups rank by deficit, largest first. Ties break in the order squat, pull, hinge, push.

### Choosing today's suggestion, in order

1. Recovery check: overall soreness of 4 or more, or energy of 2 or less, suggests an easy 30-minute Zone 2 ride or 15 minutes of mobility instead of strength.
2. Spacing: if a strength session was logged yesterday (local date), suggest a ride, mobility, or desk sets. "Train anyway" is allowed and logs `override = true`.
3. Template: A if no strength session exists yet; otherwise the opposite of the most recent strength session's template. Alternation ignores week boundaries.
4. Time box:
   - 30 minutes: pair 1, then pair 2, at the week's rounds, then the finisher. Offer the optional arm finisher afterward.
   - 20 minutes: pair 1 and pair 2 at the week's rounds, with no finisher.
   - 10 minutes: one pair as EMOM for 10 minutes (5 sets of each exercise, alternating every minute). Choose the pair whose two groups have the larger combined deficit.
   - Desk break: one desk exercise, the one furthest behind its target so far today, sized as a mini-set.
5. Guardrail caps:
   - Fight training in the next 24 hours, or leg soreness of 4 or more: squat and hinge exercises get at most 2 sets, with a target of at least 2 reps in reserve.
   - Knee pain above 3 at check-in: swap the squat slot using `knee_swaps` (A: unilateral squat becomes the hip thrust ladder; B: box squat becomes the Romanian deadlift ladder), at that ladder's current rung and load. Those sets count toward hinge.
6. Quota squeeze: with `strength_left = 3 − strength sessions this week` and `days_left` counting today, if `2 × strength_left − 1 > days_left`, stop suggesting rides, and allow strength on consecutive days using the 20-minute time box.
7. Output: for each exercise, the name, cue, target load (dumbbell setting, band, or bodyweight), rep or seconds range, rounds, target reps in reserve (1 to 2 by default, 2 or more when capped), and rest after each pair (75 seconds by default, 60 to 90 allowed), plus the plain-language reason for every adjustment.

### Progression for dumbbell exercises

Evaluated from the most recent session that included the exercise.

- Topped: every working set reached the top of the rep range with at least 1 rep in reserve.
- Missed: at least one working set fell below the bottom of the range in each of the last two sessions with that exercise.
- Topped and below the highest dumbbell setting: the next session uses the next setting up.
- Topped at the highest setting: widen the range. 8 to 12 becomes 12 to 15, then 15 to 20. 10 to 15 becomes 15 to 20.
- Topped at 15 to 20 on the highest setting: move to the next rung, starting at 75% of the current setting rounded down to an available setting, with the new exercise's base range.
- Topped at 15 to 20 on the last rung: add one set to that exercise (maximum 4) and mark the ladder complete.
- Missed: drop one setting (never below the lowest) and keep the range.
- Anything else: hold weight and range.
- Knee flag: when any squat-slot set is flagged, the rest of that exercise's sets that session swap using `knee_swaps`, and next time that exercise drops one rung (or one setting when already on rung 1).
- A rung change takes precedence over a load change when both would apply.
- Bodyweight exercises follow the same rules without load: top of range, then widen, then next rung, then an added set on the last rung.
- Holds (seconds): when all sets reach the top of the seconds range, move to the next rung. On the last rung, raise the range by 10 seconds at the bottom and 15 at the top, up to a 90-second top.
- Calibration sets the starting load for rung 1 of each ladder. If Chris cannot reach 10 reps at the lowest setting, start at the lowest setting and let the rules take over.

### Pull-up stages

- Stage 1: band-assisted pull-ups, 3 sets of 5 to 8 with the current band (starting with the heaviest band that allowed 5 reps in calibration), then 3 negatives lowered over 3 to 5 seconds.
- Stage 2: when all band sets reach 8, the next session moves to the next lighter band. Repeat until the lightest band.
- Stage 3: after 3 sets of 8 on the lightest band, switch to strict sets: 3 sets of (latest max minus 1, minimum 1), then one band-assisted back-off set to 8 on the lightest band.
- Stage 4: once a max test reaches 5, do 3 to 5 strict sets at 1 to 2 reps below the latest max, adding one rep to each set or one set (maximum 5) each week.
- Max test: offered once 14 days have passed since the last test, and required by day 21. It logs as a `max_test` session with a single all-out set.
- Milestones at 5, 8, and 10 strict reps get a celebration screen.

### Desk sets

- Daily targets: push-ups 100 a day; chair squats 25 per work hour (200 across a 9:00 to 17:00 workday); pull-up singles 5 a day. All editable in Settings.
- Mini-set size: half the latest max for that exercise, rounded down, minimum 1. Maxes come from calibration, a push-up retest every 4 weeks, and pull-up max tests.
- Knee pain above 3 at the day's check-in swaps chair squats for glute bridges that day.
- Workdays are Monday to Friday. Weekends show totals without targets.

### Derived metrics

- Estimated 1-rep max (Epley): weight × (1 + reps ÷ 30), from the best set per exercise per session. Compare only within one exercise.
- 7-day average weight: the mean of weigh-ins over the last 7 days, shown only when there are at least 3.
- Fight session calories: MET × body weight in kg × hours, using the 7-day average weight or the latest weigh-in. Take MET values from the 2024 Adult Compendium of Physical Activities and cite the activity codes in a code comment.
- Streak: consecutive workdays with every desk target met.

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

- (empty)
