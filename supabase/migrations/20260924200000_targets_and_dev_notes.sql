-- Weekly targets for the simpler day flow, and the idea button's notes.
-- See docs/PLAN.md, Tasks 2.5 and 2.6, and the Schema section.

alter table public.profile
  add column peloton_minutes_week smallint not null default 60 check (peloton_minutes_week between 0 and 1000),
  add column home_workouts_week   smallint not null default 3  check (home_workouts_week between 0 and 7);

-- Ideas and problems Chris notes from any screen. Chris adds and reads his own;
-- status changes are made by the project owner (Claude, from the cloud session
-- with the Supabase access token), so the app gets no update or delete rights.
create table public.dev_notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body         text not null check (length(trim(body)) between 1 and 4000),
  screen       text,
  app_version  text,
  status       text not null default 'open' check (status in ('open', 'planned', 'done')),
  addressed_in text,
  created_at   timestamptz not null default now()
);

create index dev_notes_user_created_idx on public.dev_notes (user_id, created_at desc);

alter table public.dev_notes enable row level security;

create policy dev_notes_select on public.dev_notes for select to authenticated
  using (user_id = (select auth.uid()));
create policy dev_notes_insert on public.dev_notes for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and addressed_in is null);

revoke all on public.dev_notes from anon, authenticated;
grant select, insert on public.dev_notes to authenticated;
