// Applies every migration to a local, in-memory Postgres (PGlite) and runs
// supabase/checks.sql against it, so a schema or permissions mistake fails
// `npm test` before it ever reaches the hosted database.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");

// Minimal stand-ins for what Supabase provides before any migration runs:
// the auth.users table, auth.uid(), and the anon and authenticated roles.
const supabaseStandIns = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(supabaseStandIns);
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
}, 60_000);

describe("database schema", () => {
  it("seeds all 36 exercises from the library", async () => {
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.exercises");
    expect(rows[0].n).toBe(36);
  });

  it("passes every permission, row-level security, view, and limit check", async () => {
    const checks = readFileSync(join(root, "supabase", "checks.sql"), "utf8");
    await expect(db.exec(checks)).rejects.toThrow("KUMITE_CHECKS_PASSED");
  });
});
