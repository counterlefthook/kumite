-- Reminders (v0.2, docs/PLAN.md Task 4.2).
--
-- push_subscriptions: one row per device that enabled notifications. The
-- browser hands the app an endpoint URL plus two keys; the server sends
-- pushes to that endpoint. Chris adds rows from the app and removes them
-- when he turns notifications off; the server (service role, which bypasses
-- row-level security) removes rows the push service reports as expired.
--
-- nudge_log: every nudge sent, on any channel. Append-only: the app reads it
-- to show "last nudge" and the engine reads the latest sent_at for the
-- cooldown rule. Written by the server's scheduled job with the service role,
-- so the app itself only needs select. Whether a nudge was acted on is
-- derived later from desk_sets, never stored here.

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text not null check (length(endpoint) between 1 and 2048),
  p256dh      text not null check (length(p256dh) between 1 and 512),
  auth        text not null check (length(auth) between 1 and 512),
  user_agent  text check (length(user_agent) <= 512),
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table public.nudge_log (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users (id) on delete cascade,
  kind     text not null check (kind in ('morning', 'desk', 'evening', 'recap')),
  text     text not null check (length(text) between 1 and 500),
  channel  text not null check (channel in ('push', 'slack', 'email')),
  sent_at  timestamptz not null default now()
);

create index nudge_log_user_sent_idx on public.nudge_log (user_id, sent_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.nudge_log          enable row level security;

create policy push_subscriptions_select on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy nudge_log_select on public.nudge_log for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions, public.nudge_log from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
grant select on public.nudge_log to authenticated;
