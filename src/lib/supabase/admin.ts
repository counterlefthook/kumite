import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Server-only Supabase client with the secret key. It skips row-level
// security, so it is used only by the hourly nudge job, which filters every
// query by user. Never import this from a client component: SUPABASE_SECRET_KEY
// has no NEXT_PUBLIC_ prefix, so it never reaches the browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_SECRET_KEY is not set.");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
