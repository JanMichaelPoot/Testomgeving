import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { stripeModeInfo } from "@/lib/stripeMode";
import { freeTestOrdersEnabled } from "@/lib/freeTest";

// For an uptime monitor (a free pinger that calls this address every few minutes and mails when it does not answer 200). It says whether the app is up and
// whether the database answers, and which payment mode this deployment is in ("live", "test" or "misconfigured", and whether free test books are on): a visitor sees that on the
// order page anyway, and it settles at once whether the live keys are really in use. Nothing else, and nothing about people. Not cached, and no secrets or counts in the answer.
export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 4000;

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  let db = false;
  try {
    const query = createServiceRoleClient().from("window_plans").select("id").limit(1);
    const result = await Promise.race([
      query.then((r) => !r.error),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), DB_TIMEOUT_MS)),
    ]);
    db = result;
  } catch {
    db = false;
  }
  const version = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || null;
  const stripe = stripeModeInfo();
  return NextResponse.json({ ok: db, db, version, payments: stripe.problem ? "misconfigured" : stripe.mode, freeOrders: freeTestOrdersEnabled(), at: new Date().toISOString() }, { status: db ? 200 : 503, headers });
}
