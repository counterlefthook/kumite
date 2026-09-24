import webpush from "web-push";
import { localDate } from "@/engine/calendar";
import { deskNudge } from "@/engine/nudge";
import { LIBRARY, loadWith, whereToday } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";

// Called every hour by the GitHub Action in .github/workflows/nudge.yml.
// Requires "Authorization: Bearer <CRON_SECRET>". With ?test=1 it sends a test
// nudge regardless of the rules, to confirm delivery to the phone.
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(request: Request): Promise<Response> {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return Response.json({ error: "Push keys are not set." }, { status: 500 });
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const test = new URL(request.url).searchParams.get("test") === "1";
  const admin = createAdminClient();
  const { data: subs, error } = await admin.from("push_subscriptions").select("*");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const now = new Date();
  const results: { user: string; sent: number; removed: number; reason?: string }[] = [];
  for (const userId of [...new Set((subs ?? []).map((s) => s.user_id))]) {
    const data = await loadWith(admin, userId);
    if (!data.profile) {
      results.push({ user: userId, sent: 0, removed: 0, reason: "no profile" });
      continue;
    }
    const today = localDate(now, data.profile.timezone);
    const nudge = test
      ? { title: "KUMITE", body: "Test nudge. If you see this, desk nudges work.", url: "/" }
      : deskNudge({ now, library: LIBRARY, profile: data.profile, history: data.history, gymToday: whereToday(data.profileRow, today) === "gym" });
    if (!nudge) {
      results.push({ user: userId, sent: 0, removed: 0, reason: "nothing to nudge" });
      continue;
    }
    let sent = 0;
    let removed = 0;
    for (const s of (subs ?? []).filter((x) => x.user_id === userId)) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(nudge), { TTL: 1800 });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
          removed++;
        }
      }
    }
    results.push({ user: userId, sent, removed });
  }
  return Response.json({ at: now.toISOString(), test, results });
}

export const GET = run;
export const POST = run;
