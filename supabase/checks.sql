-- Kumite database checks: permissions, row-level security, views, and limits.
--
-- Runs as the database owner, creates two throwaway users, then acts as each
-- of them (and as a signed-out visitor) and tries what should work and what
-- should be refused. It always ends by raising an error on purpose: that
-- rolls back every row it wrote, so nothing is left behind. The final message
-- is KUMITE_CHECKS_PASSED when everything held, or CHECK FAILED: <which one>.
--
-- Used by tests/db.test.ts (local Postgres) and scripts/check-db.mjs (hosted).

do $checks$
declare
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  s1 uuid;
  set1 uuid;
  set2 uuid;
  n bigint;
  t text;

  -- Run a statement that must be refused; fail if it goes through.
  -- expected: 42501 = permission denied or row-level security, 23514 = a check limit.
begin
  insert into auth.users (id) values (u1), (u2);

  -- ---------- signed out: every table and view is refused ----------
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '', true);
  foreach t in array array['profile', 'equipment', 'exercises', 'sessions', 'sets', 'desk_sets',
    'body_metrics', 'sessions_current', 'sets_current', 'desk_sets_current', 'body_metrics_current', 'dev_notes',
    'push_subscriptions', 'nudge_log'] loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      raise exception 'CHECK FAILED: signed-out read of % was allowed', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
  execute 'reset role';

  -- ---------- user 1 ----------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);

  select count(*) into n from public.exercises;
  if n <> 36 then raise exception 'CHECK FAILED: expected 36 exercises, found %', n; end if;

  insert into public.profile (height_in, baseline_weight_lb) values (74, 205);
  update public.profile set baseline_weight_lb = 204;
  select count(*) into n from public.profile where peloton_minutes_week = 60 and home_workouts_week = 3;
  if n <> 1 then raise exception 'CHECK FAILED: weekly targets did not default to 60 minutes and 3 workouts'; end if;

  -- Ideas: add and read your own; no edits, and no marking your own note done.
  insert into public.dev_notes (body, screen, app_version) values ('Bigger DONE button', '/', '0.1.0');
  begin
    update public.dev_notes set status = 'done';
    raise exception 'CHECK FAILED: editing an idea was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.dev_notes (body, status) values ('Sneaky', 'done');
    raise exception 'CHECK FAILED: adding an idea already marked done was allowed';
  exception when insufficient_privilege then null;
  end;
  -- Reminders: a device can be added and removed; the nudge log is read-only for the app.
  insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/abc', 'k1', 'k2');
  delete from public.push_subscriptions where endpoint = 'https://push.example/abc';
  begin
    insert into public.nudge_log (user_id, kind, text, channel) values (u1, 'desk', '15 push-ups.', 'push');
    raise exception 'CHECK FAILED: the app was allowed to write the nudge log';
  exception when insufficient_privilege then null;
  end;
  insert into public.equipment (dumbbell_settings_lb, bands)
    values ('{5,10,15,20,25,30,35,40,45,50,55}', '[{"name": "heavy"}, {"name": "light"}]');

  insert into public.sessions (kind, template, check_in)
    values ('strength', 'A', '{"soreness_legs": 2, "soreness_upper": 2, "energy": 4, "knee_pain": 1, "fight_next_24h": false}')
    returning id into s1;
  insert into public.sets (session_id, exercise_id, set_index, weight_lb, reps, rir)
    values (s1, 'db_bench_press', 1, 30, 10, 2) returning id into set1;

  -- Edits and deletes on logs are refused outright.
  begin
    update public.sets set reps = 12 where id = set1;
    raise exception 'CHECK FAILED: editing a set was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.sets where id = set1;
    raise exception 'CHECK FAILED: deleting a set was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.profile;
    raise exception 'CHECK FAILED: deleting the profile was allowed';
  exception when insufficient_privilege then null;
  end;

  -- A row claiming to belong to someone else is refused.
  begin
    insert into public.body_metrics (user_id, kind, value) values (u2, 'weight_lb', 200);
    raise exception 'CHECK FAILED: writing a row for another user was allowed';
  exception when insufficient_privilege then null;
  end;

  -- Limits.
  begin
    insert into public.sets (session_id, exercise_id, set_index, reps, rir) values (s1, 'db_bench_press', 2, 10, 5);
    raise exception 'CHECK FAILED: reps in reserve of 5 was allowed';
  exception when check_violation then null;
  end;
  begin
    insert into public.sessions (kind, check_in) values ('strength', '{"soreness_legs": 9}');
    raise exception 'CHECK FAILED: an incomplete check-in was allowed';
  exception when check_violation then null;
  end;
  begin
    update public.equipment set dumbbell_settings_lb = '{10,5}';
    raise exception 'CHECK FAILED: dumbbell settings out of order were allowed';
  exception when check_violation then null;
  end;

  -- Corrections: a new row replaces the old one in the current view...
  insert into public.sets (session_id, exercise_id, set_index, weight_lb, reps, rir, supersedes)
    values (s1, 'db_bench_press', 1, 30, 11, 2, set1) returning id into set2;
  select count(*) into n from public.sets_current where id = set1;
  if n <> 0 then raise exception 'CHECK FAILED: a superseded set still shows as current'; end if;
  select count(*) into n from public.sets_current where id = set2 and reps = 11;
  if n <> 1 then raise exception 'CHECK FAILED: the corrected set is missing from sets_current'; end if;

  -- ...and a voiding row removes it, while the full log keeps all three rows.
  insert into public.sets (session_id, exercise_id, set_index, supersedes, voided)
    values (s1, 'db_bench_press', 1, set2, true);
  select count(*) into n from public.sets_current;
  if n <> 0 then raise exception 'CHECK FAILED: a voided set still shows as current'; end if;
  select count(*) into n from public.sets;
  if n <> 3 then raise exception 'CHECK FAILED: expected 3 rows in the set log, found %', n; end if;
  execute 'reset role';

  -- ---------- user 2 sees none of user 1's rows ----------
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);

  foreach t in array array['profile', 'equipment', 'sessions', 'sets', 'sessions_current', 'sets_current', 'dev_notes'] loop
    execute format('select count(*) from public.%I', t) into n;
    if n <> 0 then raise exception 'CHECK FAILED: user 2 can see % row(s) of user 1 in %', n, t; end if;
  end loop;

  begin
    insert into public.sets (session_id, exercise_id, set_index, reps) values (s1, 'db_bench_press', 1, 10);
    raise exception 'CHECK FAILED: adding a set to another user''s session was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.sessions (kind, supersedes, voided) values ('strength', s1, true);
    raise exception 'CHECK FAILED: voiding another user''s session was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profile set baseline_weight_lb = 1;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'CHECK FAILED: user 2 edited user 1''s profile'; end if;
  end;
  execute 'reset role';

  raise exception 'KUMITE_CHECKS_PASSED';
end
$checks$;
