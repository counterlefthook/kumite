# Kumite

Kumite is a single-user workout and food tracker for Chris, installed on his phone as a web app. It suggests a workout that fits the time and equipment he has, logs every set, and progresses each exercise automatically. The goals: a body recomposition (about 10 lb more muscle and 10 lb less fat) and 10 strict pull-ups. Workouts are the core of the app; food tracking arrives in version 0.2.

## Read these first

- `docs/SPEC.md`: what the app does and why. Product rules and the dated decisions log.
- `docs/PLAN.md`: build order, tasks with acceptance checks, the database schema, and the precise engine rules.
- `docs/exercise-library.json`: seed data for the exercise library, templates, and knee swaps.
- @AGENTS.md: a note from the Next.js team. This project runs Next.js 16, which is newer than most AI training data, so check the docs bundled in `node_modules/next/dist/docs/` before writing Next.js code.

These repo files are the source of truth. If SPEC and PLAN disagree, or a rule is ambiguous, stop and ask Chris instead of guessing. When a decision changes, add a dated row to the Decisions table in `docs/SPEC.md` and update `docs/PLAN.md` in the same commit.

## How to work with Chris

- Chris is a senior marketing technologist, not a professional engineer. Explain every technical step in plain language as you go: what you are about to do, why, and what the command or code does. Repeat explanations even for things covered before.
- Explain git steps (branches, commits, pushes, merges) as you do them.
- Work one `docs/PLAN.md` task at a time. Begin each task in plan mode: restate the task, the files you will create or change, and the acceptance checks, then wait for Chris's go-ahead.
- Finish each task by running typecheck, lint, tests, and build. Then summarize what changed, tick the task's boxes in `docs/PLAN.md`, and tell Chris exactly what to check on the Vercel preview URL.
- Writing style for anything Chris reads (explanations, commit messages, UI copy): no em-dashes; avoid "it's not X, it's Y" phrasing; never use the word "quietly"; keep headings plain and matter-of-fact.

## Stack

- Next.js with the App Router, TypeScript, and a `src/` directory; Tailwind CSS for styling
- Supabase: Postgres, Auth with emailed 6-digit codes, row-level security; the schema lives as migrations in `supabase/migrations/`
- Vercel for hosting: every branch gets a preview URL, and `main` is production
- Vitest for unit tests
- Installable web app (PWA) through a web app manifest

## Architecture rules

1. The workout engine lives in `src/engine/` and is pure TypeScript. No React, Next, Supabase, network calls, or `Date.now()` inside it. The current time, settings, and log history are passed in as arguments, so the same inputs always produce the same output.
2. No AI model is involved in workout logic. The only model use in the app is parsing typed food entries in version 0.2, on the server.
3. Log tables (`sessions`, `sets`, `desk_sets`, `body_metrics`) are append-only. A correction is a new row whose `supersedes` column points at the row it replaces. Current loads, ladder rungs, weekly set counts, streaks, and calorie estimates are computed when read and never stored.
4. Row-level security is on for every table, and users only see and write their own rows. Log tables get no update or delete policies.
5. Secrets live only in environment variables. Server-only values never get the `NEXT_PUBLIC_` prefix. Never commit `.env` files.
6. Units are pounds and inches in the database and the UI. Convert to kilograms only inside formulas that need it (calorie estimates, protein targets).
7. The time zone is America/Chicago. A training week runs Monday 00:00 to Sunday 23:59 local time.

## Commands

- `npm run dev`: local development server
- `npm run build`: production build
- `npm test`: Vitest unit tests
- `npm run lint`: ESLint
- `npm run typecheck`: TypeScript check with no output files
- `npx supabase migration new <name>`: create a new migration file
- `npx supabase db push`: apply migrations to the hosted Supabase project
- `npx supabase gen types typescript --linked > src/lib/database.types.ts`: regenerate database types after a migration

## Design direction

80s arcade in red, white, and blue with 16/32-bit pixel art. Use a pixel font for the title screen and big headings, and a highly readable font for body text and anything logged mid-set. Tap targets are at least 48 px, since logging happens between sets with sweaty hands. All art is original: no film imagery, characters, or logos.

## Guardrails

- Stay inside the current task. Add new ideas to the Parking lot at the end of `docs/PLAN.md` instead of building them.
- Never force-push, rewrite git history, or run destructive commands against the hosted database without asking first.
- If a command fails twice the same way, stop and explain the error in plain language, with options, instead of retrying.
