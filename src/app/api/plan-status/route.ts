import { NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { elapsedSince, isStalePending } from "@/lib/progressStage";
import { isMissingColumnError } from "@/lib/supabase/errors";

// How far the book of this browser's session has come: the waiting screen asks this every few seconds instead of rendering the whole /plan page
// (which asks Stripe and several tables each time). Counts and a stage name only; nothing about the person. Without a session cookie (the book
// opened from the e-mail on another device) it says "unknown" and the screen falls back to refreshing the page.
export const dynamic = "force-dynamic";

export async function GET() {
  const sessionId = await getSessionId();
  if (!sessionId) return NextResponse.json({ status: "unknown" }, { headers: { "Cache-Control": "no-store" } });

  const supabase = createServiceRoleClient();
  let { data, error } = await supabase
    .from("window_plans")
    .select("status, progress_stage, progress_meta, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && isMissingColumnError(error)) {
    // The progress columns are not there yet (migrations 0016/0018): the status alone still tells when the book is ready.
    ({ data, error } = (await supabase.from("window_plans").select("status, created_at").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(1).maybeSingle()) as never);
  }
  if (error || !data) return NextResponse.json({ status: "unknown" }, { headers: { "Cache-Control": "no-store" } });

  const row = data as { status: string; progress_stage?: string | null; progress_meta?: unknown; created_at?: string };
  const elapsedMs = elapsedSince(row.created_at, Date.now());
  // A "pending" row older than the function ceiling belongs to a generation the platform has already stopped: nothing will ever finish it. Saying
  // "failed" makes the waiting screen load the page again, which retries once (and then shows the failure and the retry button) instead of counting on.
  const dead = row.status === "pending" && isStalePending(elapsedMs);
  return NextResponse.json(
    {
      status: dead ? "failed" : row.status === "ready" || row.status === "failed" || row.status === "pending" ? row.status : "unknown",
      stage: row.progress_stage ?? null,
      meta: row.progress_meta ?? null,
      elapsedMs,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
