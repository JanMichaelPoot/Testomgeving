import { NextResponse } from "next/server";
import { siteUrl as getSiteUrl } from "@/lib/siteUrl";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { readFollowUpToken } from "@/lib/followup/token";
import { followUpCookies } from "@/lib/followup/avoid";
import { parseSeason } from "@/lib/seasonEdition";
import { trackServerEvent } from "@/lib/posthog/server";

// The button in the follow-up e-mail. A signed link: it remembers which book was already received (so the next intake leaves those ideas out,
// see followup/avoid.ts) and starts a fresh intake. Opens nothing of the old book and shows nothing personal. A link that does not verify
// simply starts a normal intake.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = getSiteUrl();
  const planId = readFollowUpToken("open", url.searchParams.get("t"));
  const response = NextResponse.redirect(`${base}/intake`);
  if (!planId) return response;

  const { data: plan } = await createServiceRoleClient().from("window_plans").select("id, session_id").eq("id", planId).maybeSingle();
  if (!plan) return response;

  // Set on the redirect itself, so they are certainly part of the response the browser gets.
  for (const cookie of followUpCookies(plan.id, parseSeason(url.searchParams.get("season")))) response.cookies.set(cookie.name, cookie.value, cookie.options);
  void trackServerEvent("followup_link_opened", {}, plan.session_id);
  return response;
}
