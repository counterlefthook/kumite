-- The Desk / Gym / Out switch, and push notifications for desk nudges.
-- See docs/PLAN.md, Tasks 3.2 and 3.3.

-- Where Chris is today. location_date makes it reset each morning: an answer
-- from an earlier day counts as unset.
alter table public.profile
  add column location      text check (location in ('desk', 'gym', 'out')),
  add column location_date date;

-- One row per phone that turned on nudges. Chris adds, reads, and removes his
-- own; the hourly nudge job reads them with the server-only secret key.
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique check (endpoint like 'https://%'),
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
