# Kumite: v0.2 spec

Started 2026-09-22. Reset 2026-09-25 for v0.2. Last updated 2026-09-25. Owner: Chris.

This file is the source of truth for product rules. `docs/PLAN.md` turns these rules into build tasks and precise engine rules. The v0.1 spec is preserved in git history (tag `v0.1.0`); this file replaces it.

## Why v0.2 resets the product

v0.1 shipped a self-directed dumbbell program behind a calibration gate, with no way to reach Chris. Chris never installed it. The finding: the app has to come to him, and the strength work has to be coached. v0.2 keeps the v0.1 foundation (Supabase schema, append-only logs, auth, Vercel, the tested engine) and replaces the product on top of it.

## Purpose and priorities

Kumite reminds Chris to train, tells him exactly what to do, and logs it with as little typing as possible. Goals: about 10 lb more muscle and 10 lb less fat, and 10 strict pull-ups (currently 2).

1. Priority 1, reminders: hourly desk nudges during work hours, a morning plan, an evening catch-up nudge. Delivered by iPhone push and Slack.
2. Priority 2, coached strength: the app picks a Peloton strength class for each strength day. The v0.1 dumbbell A/B workout stays as a fallback for days with no screen or under 20 minutes.
3. Priority 3, desk maintenance: daily push-up, squat, and pull-up-single targets, logged with one tap, sized down on fight days.
4. Priority 4, food: manual entry with calorie and protein lookup (v0.3), protein-first.

Ideal week: 2 to 3 fight sessions (kickboxing or MMA at the gym) and 2 to 3 strength sessions. If that fails, the desk targets and eating habits carry the week.

Baseline (September 2026): age 45, 6'2", about 205 lb, works from home, desk hours 8:00 to 16:00 America/Chicago, iPhone, personal Slack workspace.

Look and feel: unchanged from v0.1 (original fighting-game style: dark stone, blood red, fire, carved gold). No design work in v0.2 beyond what the new screens need.

## Inputs

| Input | Value | Used for |
| --- | --- | --- |
| Peloton account | Email and password stored as Vercel environment variables only | Nightly workout import; class library for the recommender |
| Peloton class collection | 15 to 20 strength classes Chris bookmarks, 10 to 30 minutes | First version of the recommender |
| Fight training | 2 to 3 sessions a week, days change weekly | Logged as they happen; excuses that day's desk targets and strength suggestion |
| Desk hours | 8:00 to 16:00 America/Chicago, weekdays | Push and Slack nudge window |
| Dumbbells to 55 lb, adjustable bench, doorway pull-up bar, bands | From v0.1 | Fallback home workout; pull-up ladder |
| Knee | Prior surgeries; Chris does not want the app to plan around it | Knee rules switched off and removed from class filtering |

## Weekly structure

The week runs on quotas, Monday 00:00 to Sunday 23:59 America/Chicago. Fight days move, so the engine fills the remaining days.

| Per week | Target | Rule |
| --- | --- | --- |
| Fight sessions | 2 to 3 | Logged as they happen; a fight day is that day's training |
| Strength sessions | 2 (stretch 3) | A Peloton strength class chosen by the app, or the fallback home workout. Not on back-to-back days unless the week is short |
| Peloton ride minutes | 60 | Soft target; suggested only when strength is on pace |
| Desk targets | Every weekday | 100 push-ups, 100 bodyweight squats, 6 to 8 pull-up singles. Halved on fight days |
| Rest | At least 1 full day | No strength or fight training |

A strength session is any Peloton strength class of 10 minutes or more, or a logged home workout. Rides never count as strength.

## Reminders

Nudges are computed by a pure engine function from the current time, the profile, and the log, then delivered by a scheduled server job. Every nudge is one sentence and one action.

| Nudge | When | Says | Channels |
| --- | --- | --- | --- |
| Morning plan | 7:00 local, daily | Today's one thing: "Strength day: 20 min Upper Body with Andy" or "Fight day. Desk sets are halved." or "Rest day. Desk sets only." | Push |
| Desk | Hourly, 8:00 to 16:00 local, weekdays | The desk exercise furthest behind pace, sized as a mini-set: "15 push-ups" | Push and Slack |
| Evening catch-up | 18:30 local, when the day's strength session is not logged and it is not a fight or rest day | "Still time for a 10 minute class" with the class link | Push |
| Weekly recap | Sunday 19:00 local | Weight trend, waist, pull-up max, sessions against quota, protein once food ships | Email |

Rules:
- A desk nudge is skipped when every desk target is met, and when a fight session or strength session was logged in the last 60 minutes.
- A nudge that lands after a desk set was logged in the last 20 minutes asks for a different exercise.
- Tapping a push notification opens the app on a screen with one DONE button for that exact set.
- Slack nudges go to a personal workspace through an incoming webhook (upgrade path: a bot with buttons that log the set from Slack).
- Quiet hours are anything outside the table. No nudges on weekends except the morning plan and the Sunday recap.

How push works: the installed PWA registers a service worker; Chris enables notifications once; the browser returns a push subscription (endpoint plus keys) that is stored in `push_subscriptions`. Vercel Cron calls a server route on schedule; the route runs the nudge engine and sends through the web-push library signed with VAPID keys held in environment variables. iOS requires the app to be installed to the home screen before notifications can be enabled.

## Peloton

Two features on the unofficial Peloton API (the same endpoints the Peloton app uses; no official public API exists).

Import:
- Nightly at 3:00 local, and on app open when the last import is older than 6 hours, fetch Chris's recent workouts.
- Each Peloton workout becomes a `sessions` row: rides as `ride` with minutes, output, and calories; strength classes as `strength` with `template = null` and the Peloton class recorded. `peloton_workout_id` is unique, so re-imports never duplicate.
- Imported sessions count toward quotas exactly like logged ones. Chris never logs a Peloton workout by hand.
- If the API fails, the app shows the last successful import time and keeps working on manual logging. Nothing else breaks.

Recommender:
- Stage 1: rotate through Chris's bookmarked collection. Pick by body focus (alternate upper, lower, full body against the last strength session), then by time available (default 20 minutes; 10 on a squeeze day), then least recently taken. Never repeat a class within 30 days.
- Stage 2: the full strength library, pulled nightly, filtered to 10 to 30 minutes, dumbbells or bodyweight, and rated up instructors.
- A recommendation is delivered with a Peloton deep link that opens the class.
- After an imported strength class, the app asks for a thumbs up or down; ratings feed Stage 2.

## Desk sets and the pull-up path

Unchanged from v0.1 in substance: grease-the-groove. Mini-sets sized at about half the current max, never to failure, spread across the workday. Pull-up singles are the whole pull-up program until a max test reaches 5; then Stage 3 and 4 of the v0.1 ladder apply during the fallback home workout. Max tests every 3 weeks, prompted by the morning nudge.

## Home screen

One screen, no questions on open:
- Today's one thing, huge, with its action (open the class, log the fight session, or "rest").
- Desk targets as health bars with +N buttons.
- The week: fight, strength, and ride against quota.
- Last import time and a sync button.

The "At your desk?" and "Gym today?" questions are removed. A fight day is known from a logged or imported fight session, or from a single "Fight day" toggle on the home screen. Calibration is no longer a gate; the fallback workout asks for a starting weight the first time an exercise is used.

## Logging

- Peloton: imported, never typed.
- Desk sets: one tap from a nudge, or +N buttons on the home screen.
- Fight session: one button, optional minutes and effort.
- Fallback home workout: v0.1 set logging, prefilled from last time.
- Body metrics: morning weight (optional), waist weekly, prompted Sunday morning.

## Progress

Unchanged from v0.1: 7-day average weight, waist, estimated 1RM on fallback lifts, max strict pull-ups, sessions against quota, desk streak. Delivered on the dashboard (v0.3) and in the Sunday email (v0.2).

## Food (v0.3)

Unchanged from the v0.1 design: a small model parses typed text, USDA and other databases supply the numbers, code does the math, each row snapshots calories and protein. Protein target 185 g, calories at estimated maintenance minus 300 to 400. Meal suggestions come from a list of 10 to 15 meals Chris actually eats. Photo estimation stays last.

## Decisions

The 37 v0.1 decisions stand unless superseded below.

| Date | Decision | Why |
| --- | --- | --- |
| 2026-09-25 | v0.2 resets the product on top of the v0.1 foundation | Chris never installed v0.1; the app was passive, self-directed, and gated behind calibration |
| 2026-09-25 | Reminders are priority 1; push and Slack, hourly 8:00 to 16:00 weekdays | Chris's stated need: something that reminds him to train |
| 2026-09-25 | Strength sessions are Peloton classes picked by the app; the dumbbell A/B workout becomes the fallback | Chris cannot motivate through self-directed workouts and likes Peloton strength classes |
| 2026-09-25 | Peloton workouts import through the unofficial API; credentials live only in Vercel environment variables | Removes all Peloton logging; Chris accepted the unofficial-API risk |
| 2026-09-25 | Recommender starts from a bookmarked collection, then the full library | Ships without API risk on day one |
| 2026-09-25 | Weekly quota: 2 to 3 fight, 2 (stretch 3) strength, 60 ride minutes soft | Chris's ideal week |
| 2026-09-25 | Calibration is no longer a gate; the fallback workout asks for a weight on first use | Front-loaded effort kept v0.1 from being used |
| 2026-09-25 | Knee rules switched off and not used in class filtering | Chris does not want the app planning around it |
| 2026-09-25 | Home screen shows today's one thing with no questions; "At your desk?" and "Gym today?" removed | Fewer taps to the action |
| 2026-09-25 | Weekly recap by email (Resend); nudges never by email | Email is read, not acted on |
| 2026-09-25 | Look unchanged from v0.1 | No design time in v0.2 |

## Plan

| Version | Scope |
| --- | --- |
| 0.2 | Push and Slack nudges, nudge engine, Peloton import, collection recommender, new home screen, Sunday email |
| 0.3 | Food: manual entry with parse and lookup, protein and calorie targets, meal list; dashboard charts |
| 0.4 | Full-library recommender with ratings; Slack bot with buttons; barcode and FatSecret |
| 0.5 | Calendar-aware suggestions from Google Calendar; model-written weekly summary |
| Later | Photo-based calorie estimation |
