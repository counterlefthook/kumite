-- Kumite v0.1 schema. See docs/PLAN.md, Schema.
--
-- Config tables (profile, equipment) hold one editable row per user.
-- exercises is the seeded, read-only library.
-- Log tables (sessions, sets, desk_sets, body_metrics) are append-only: a
-- correction is a new row whose supersedes column points at the row it
-- replaces, and voided = true on that new row cancels the old one instead.
-- The *_current views show only the rows still in force.
--
-- New tables are not exposed to the Data API automatically in this project,
-- so every table and view below is granted to the authenticated role on
-- purpose, and the anon role (no signed-in user) gets nothing.

-- ---------- helpers ----------

-- True when a numeric array is strictly ascending (each value larger than the last).
create or replace function public.is_strictly_ascending(vals numeric[])
returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(bool_and(v > prev), true)
  from (
    select v, lag(v) over (order by ord) as prev
    from unnest(vals) with ordinality as t(v, ord)
  ) s
  where prev is not null;
$$;

-- True when a check-in has every field, each in range.
create or replace function public.is_valid_check_in(c jsonb)
returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(c) = 'object'
    and jsonb_typeof(c -> 'soreness_legs') = 'number'
    and jsonb_typeof(c -> 'soreness_upper') = 'number'
    and jsonb_typeof(c -> 'energy') = 'number'
    and jsonb_typeof(c -> 'knee_pain') = 'number'
    and jsonb_typeof(c -> 'fight_next_24h') = 'boolean'
    and (c ->> 'soreness_legs')::numeric between 1 and 5
    and (c ->> 'soreness_upper')::numeric between 1 and 5
    and (c ->> 'energy')::numeric between 1 and 5
    and (c ->> 'knee_pain')::numeric between 0 and 10;
$$;

-- Keeps updated_at current on config tables.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- config tables ----------

create table public.profile (
  user_id            uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  height_in          numeric not null check (height_in > 0),
  baseline_weight_lb numeric not null check (baseline_weight_lb > 0),
  program_start_date date not null default (now() at time zone 'America/Chicago')::date,
  protein_target_g   integer not null default 185 check (protein_target_g > 0),
  work_start         time not null default '09:00',
  work_end           time not null default '17:00',
  desk_targets       jsonb not null default '{"pushups_per_day": 100, "chair_squats_per_work_hour": 25, "pullup_singles_per_day": 5}'::jsonb
                     check (jsonb_typeof(desk_targets) = 'object'),
  timezone           text not null default 'America/Chicago',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (work_end > work_start)
);

create table public.equipment (
  user_id              uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  dumbbell_settings_lb numeric[] not null default '{}'
                       check (public.is_strictly_ascending(dumbbell_settings_lb)),
  bench                text not null default 'adjustable' check (bench in ('flat', 'adjustable')),
  pullup_bar           boolean not null default true,
  -- Heaviest to lightest, for example [{"name": "Black", "assist_lb": 50}, ...]
  bands                jsonb not null default '[]'::jsonb check (jsonb_typeof(bands) = 'array'),
  updated_at           timestamptz not null default now()
);

create trigger profile_touch before update on public.profile
  for each row execute function public.touch_updated_at();
create trigger equipment_touch before update on public.equipment
  for each row execute function public.touch_updated_at();

-- ---------- exercise library ----------

create table public.exercises (
  id         text primary key,
  name       text not null,
  ladder     text not null,
  rung       smallint not null check (rung >= 1),
  grp        text not null check (grp in ('push', 'pull', 'squat', 'hinge', 'core', 'arms')),
  load       text not null check (load in ('dumbbell', 'bodyweight', 'band_assist', 'hold')),
  dumbbells  smallint not null check (dumbbells between 0 and 2),
  equipment  text[] not null default '{}',
  context    text[] not null default '{}',
  unilateral boolean not null default false,
  rep_min    smallint check (rep_min >= 1),
  rep_max    smallint check (rep_max >= rep_min),
  sec_min    smallint check (sec_min >= 1),
  sec_max    smallint check (sec_max >= sec_min),
  knee       text not null check (knee in ('low', 'moderate', 'high')),
  cue        text not null,
  unique (ladder, rung),
  check ((rep_min is null) = (rep_max is null)),
  check ((sec_min is null) = (sec_max is null))
);

-- ---------- log tables ----------

create table public.sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind           text not null check (kind in ('strength', 'fight', 'ride', 'mobility', 'calibration', 'max_test')),
  template       text check (template in ('A', 'B')),
  started_at     timestamptz not null default now(),
  minutes        smallint check (minutes >= 0),
  time_box       text check (time_box in ('10', '20', '30')),
  check_in       jsonb check (check_in is null or public.is_valid_check_in(check_in)),
  effort         smallint check (effort between 1 and 10),
  fight_type     text check (fight_type in ('kickboxing', 'mma')),
  ride_output_kj numeric check (ride_output_kj >= 0),
  ride_kcal      numeric check (ride_kcal >= 0),
  override       boolean not null default false,
  notes          text,
  supersedes     uuid references public.sessions (id),
  voided         boolean not null default false,
  created_at     timestamptz not null default now(),
  check (not voided or supersedes is not null)
);

create table public.sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id  uuid not null references public.sessions (id),
  exercise_id text not null references public.exercises (id),
  set_index   smallint not null check (set_index >= 1),
  weight_lb   numeric check (weight_lb >= 0),          -- per dumbbell
  band        text,
  reps        smallint check (reps >= 0),
  seconds     smallint check (seconds >= 0),
  rir         smallint check (rir between 0 and 4),   -- 4 means 4 or more
  knee_flag   boolean not null default false,
  supersedes  uuid references public.sets (id),
  voided      boolean not null default false,
  created_at  timestamptz not null default now(),
  check (not voided or supersedes is not null),
  check (voided or reps is not null or seconds is not null)
);

create table public.desk_sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  reps        smallint check (reps >= 1),
  seconds     smallint check (seconds >= 1),         -- wall sits are timed
  logged_at   timestamptz not null default now(),
  supersedes  uuid references public.desk_sets (id),
  voided      boolean not null default false,
  created_at  timestamptz not null default now(),
  check (not voided or supersedes is not null),
  check (voided or reps is not null or seconds is not null)
);

create table public.body_metrics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('weight_lb', 'waist_in')),
  value       numeric not null check (value > 0),
  measured_at timestamptz not null default now(),
  supersedes  uuid references public.body_metrics (id),
  voided      boolean not null default false,
  created_at  timestamptz not null default now(),
  check (not voided or supersedes is not null)
);

create index sessions_user_started_idx     on public.sessions (user_id, started_at desc);
create index sessions_supersedes_idx       on public.sessions (supersedes) where supersedes is not null;
create index sets_user_session_idx         on public.sets (user_id, session_id);
create index sets_user_exercise_idx        on public.sets (user_id, exercise_id, created_at desc);
create index sets_supersedes_idx           on public.sets (supersedes) where supersedes is not null;
create index desk_sets_user_logged_idx     on public.desk_sets (user_id, logged_at desc);
create index desk_sets_supersedes_idx      on public.desk_sets (supersedes) where supersedes is not null;
create index body_metrics_user_kind_idx    on public.body_metrics (user_id, kind, measured_at desc);
create index body_metrics_supersedes_idx   on public.body_metrics (supersedes) where supersedes is not null;

-- ---------- ownership checks for corrections ----------
-- A correction row must point at a row the same user owns. A policy on a table
-- cannot read that same table (Postgres reports infinite recursion), so these
-- helpers do the lookup as the table owner, which row-level security does not
-- apply to. Each returns only true or false about one row.

create or replace function public.owns_session(row_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sessions where id = row_id and user_id = (select auth.uid()));
$$;

create or replace function public.owns_set(row_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sets where id = row_id and user_id = (select auth.uid()));
$$;

create or replace function public.owns_desk_set(row_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.desk_sets where id = row_id and user_id = (select auth.uid()));
$$;

create or replace function public.owns_body_metric(row_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.body_metrics where id = row_id and user_id = (select auth.uid()));
$$;

-- ---------- row-level security ----------

alter table public.profile      enable row level security;
alter table public.equipment    enable row level security;
alter table public.exercises    enable row level security;
alter table public.sessions     enable row level security;
alter table public.sets         enable row level security;
alter table public.desk_sets    enable row level security;
alter table public.body_metrics enable row level security;

-- Config: read, create, and edit your own row. No delete.
create policy profile_select on public.profile for select to authenticated
  using (user_id = (select auth.uid()));
create policy profile_insert on public.profile for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy profile_update on public.profile for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy equipment_select on public.equipment for select to authenticated
  using (user_id = (select auth.uid()));
create policy equipment_insert on public.equipment for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy equipment_update on public.equipment for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Library: any signed-in user can read it.
create policy exercises_select on public.exercises for select to authenticated
  using (true);

-- Logs: read and add your own rows only. A correction may only point at your
-- own row, and a set may only belong to your own session. No update or delete.
create policy sessions_select on public.sessions for select to authenticated
  using (user_id = (select auth.uid()));
create policy sessions_insert on public.sessions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (supersedes is null or public.owns_session(supersedes))
  );

create policy sets_select on public.sets for select to authenticated
  using (user_id = (select auth.uid()));
create policy sets_insert on public.sets for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.sessions s where s.id = session_id and s.user_id = (select auth.uid()))
    and (supersedes is null or public.owns_set(supersedes))
  );

create policy desk_sets_select on public.desk_sets for select to authenticated
  using (user_id = (select auth.uid()));
create policy desk_sets_insert on public.desk_sets for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (supersedes is null or public.owns_desk_set(supersedes))
  );

create policy body_metrics_select on public.body_metrics for select to authenticated
  using (user_id = (select auth.uid()));
create policy body_metrics_insert on public.body_metrics for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (supersedes is null or public.owns_body_metric(supersedes))
  );

-- ---------- current views ----------
-- A row is current when it is not a voiding row and no later row supersedes it.
-- security_invoker = true makes each view obey the row-level security of the
-- table underneath; without it a view runs as its owner and skips those rules.

create view public.sessions_current with (security_invoker = true) as
  select t.* from public.sessions t
  where not t.voided
    and not exists (select 1 from public.sessions n where n.supersedes = t.id);

create view public.sets_current with (security_invoker = true) as
  select t.* from public.sets t
  where not t.voided
    and not exists (select 1 from public.sets n where n.supersedes = t.id);

create view public.desk_sets_current with (security_invoker = true) as
  select t.* from public.desk_sets t
  where not t.voided
    and not exists (select 1 from public.desk_sets n where n.supersedes = t.id);

create view public.body_metrics_current with (security_invoker = true) as
  select t.* from public.body_metrics t
  where not t.voided
    and not exists (select 1 from public.body_metrics n where n.supersedes = t.id);

-- ---------- grants ----------
-- Grants decide which actions a role may attempt at all; the policies above
-- then decide which rows. Log tables get select and insert only, so an edit or
-- delete is refused before row-level security is even consulted.

revoke all on public.profile, public.equipment, public.exercises,
  public.sessions, public.sets, public.desk_sets, public.body_metrics,
  public.sessions_current, public.sets_current, public.desk_sets_current, public.body_metrics_current
  from anon, authenticated;

grant select, insert, update on public.profile, public.equipment to authenticated;
grant select on public.exercises to authenticated;
grant select, insert on public.sessions, public.sets, public.desk_sets, public.body_metrics to authenticated;
grant select on public.sessions_current, public.sets_current, public.desk_sets_current, public.body_metrics_current
  to authenticated;

revoke all on function public.is_strictly_ascending(numeric[]) from public, anon;
revoke all on function public.is_valid_check_in(jsonb) from public, anon;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
grant execute on function public.is_strictly_ascending(numeric[]) to authenticated;
grant execute on function public.is_valid_check_in(jsonb) to authenticated;

revoke all on function public.owns_session(uuid), public.owns_set(uuid),
  public.owns_desk_set(uuid), public.owns_body_metric(uuid) from public, anon;
grant execute on function public.owns_session(uuid), public.owns_set(uuid),
  public.owns_desk_set(uuid), public.owns_body_metric(uuid) to authenticated;
