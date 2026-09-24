// Runs the Task 2.1 "Done when" checks against the hosted Supabase project.
//
// Usage: node scripts/check-db.mjs
//
// Needs:
//   SUPABASE_ACCESS_TOKEN   personal access token (environment variable)
//   the project ref         from SUPABASE_PROJECT_REF, NEXT_PUBLIC_SUPABASE_URL,
//                           or supabase/.temp/project-ref (written by supabase link)
// Reads NEXT_PUBLIC_* values from .env.local when present. When the publishable
// key is not set, it is looked up through the Supabase Management API.
//
// 1. Signed out, with only the publishable key, every table and view is refused.
// 2. supabase/checks.sql passes (it rolls back everything it writes).

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function loadEnvLocal() {
  const path = `${root}.env.local`;
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function projectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) return new URL(url).hostname.split(".")[0];
  const linked = `${root}supabase/.temp/project-ref`;
  if (existsSync(linked)) return readFileSync(linked, "utf8").trim();
  throw new Error("No project ref: set SUPABASE_PROJECT_REF or run npx supabase link first.");
}

async function management(path, init = {}) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is not set.");
  return fetch(`https://api.supabase.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
}

async function publishableKey(ref) {
  if (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const res = await management(`/projects/${ref}/api-keys`);
  if (!res.ok) throw new Error(`Could not look up API keys (HTTP ${res.status}).`);
  const key = (await res.json()).find((k) => k.type === "publishable");
  if (!key?.api_key) throw new Error("The project has no publishable key.");
  return key.api_key;
}

const TABLES = [
  "profile", "equipment", "exercises", "sessions", "sets", "desk_sets", "body_metrics",
  "sessions_current", "sets_current", "desk_sets_current", "body_metrics_current", "dev_notes",
];

async function main() {
  loadEnvLocal();
  const ref = projectRef();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? `https://${ref}.supabase.co`;
  const key = await publishableKey(ref);
  let failures = 0;

  console.log(`Project ${ref}\n\n1. Signed out, publishable key only:`);
  for (const table of TABLES) {
    const res = await fetch(`${base}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: key },
    });
    const body = await res.text();
    const refused = !res.ok && body.includes("42501");
    if (!refused) failures++;
    console.log(`   ${refused ? "refused  " : "NOT REFUSED"}  ${table}  (HTTP ${res.status})`);
  }

  console.log("\n2. supabase/checks.sql (two throwaway users, rolled back):");
  const res = await management(`/projects/${ref}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query: readFileSync(`${root}supabase/checks.sql`, "utf8") }),
  });
  const body = await res.text();
  if (body.includes("KUMITE_CHECKS_PASSED")) {
    console.log("   passed");
  } else {
    failures++;
    const reason = body.match(/CHECK FAILED: [^"\\]*/)?.[0] ?? `HTTP ${res.status}: ${body.slice(0, 400)}`;
    console.log(`   FAILED  ${reason}`);
  }

  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
