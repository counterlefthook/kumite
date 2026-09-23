# Starting the Kumite build in Claude Code

## Setup

1. Unzip this folder somewhere you keep projects, for example `~/Projects/kumite`.
2. Open Claude Code in that folder: in the Claude desktop app, open the Code tab and choose the folder; or in Terminal, run `cd ~/Projects/kumite` and then `claude`.
3. Claude Code reads `CLAUDE.md` automatically at the start of every session, so there is no need to run `/init`.
4. Switch to plan mode before pasting the first prompt: press Shift+Tab until the mode indicator shows plan mode, or type `/plan`. In plan mode, Claude Code reads and proposes but does not edit files or run commands.

## Prompt 1: Stage 1 setup

```
Read CLAUDE.md, docs/SPEC.md, docs/PLAN.md, and docs/exercise-library.json. We are starting Stage 1 of docs/PLAN.md.

Before running anything:
1. Summarize Stage 1 in plain language.
2. Split the work into what you will do and what I need to do myself in GitHub, Supabase, and Vercel, in the order I should do it.
3. Flag anything in the docs that looks ambiguous or contradictory.

Then wait for my go-ahead. Work one task at a time, explain each command before you run it, and stop at the end of each task so I can confirm before you move on.
```

## Prompt for each later task

Swap in the task number, for example 2.1.

```
Start Task <number> from docs/PLAN.md. Stay in plan mode first: restate the task, the files you will create or change, and the acceptance checks, then wait for my go-ahead. Work on the branch named in the plan. When you finish, run typecheck, lint, tests, and build, tick the task's boxes in docs/PLAN.md, push the branch, and tell me exactly what to check on the Vercel preview URL.
```

## When something goes sideways

```
Stop. Explain what failed and why in plain language, list two or three options, and recommend one. Do not retry the same fix more than twice.
```

## When a decision changes mid-build

```
Update docs/SPEC.md with a dated row in the Decisions table, update docs/PLAN.md to match, and commit both together before continuing.
```
