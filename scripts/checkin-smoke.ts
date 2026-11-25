// A check of the check-in mail's storage against the real database (Step 243), for after migration 0032 has been run. It looks (read only) at which books the daily job would
// mail right now, stores an answer for a book without one, adds a sentence with consent, changes the answer (the consent must go), notes an opt-out for a made-up address and
// finds it again, and deletes every row it made. NOTHING IS SENT and no book is marked as mailed. Free; safe at any time.
//
//   npx tsx --env-file=.env.local scripts/checkin-smoke.ts
import { createClient } from "@supabase/supabase-js";
import { cleanCheckin } from "../src/lib/checkin";
import { emailHash, isOptedOut, recordOptOut } from "../src/lib/checkin/optout";
import { supabaseCheckinStore } from "../src/lib/checkin/run";
import { CHECKIN_MAX_AGE_MS, CHECKIN_MIN_AGE_MS } from "../src/lib/checkin";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase credentials missing in the environment");
const supabase = createClient(url, key);

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${extra ? ` (${extra})` : ""}`);
  if (!ok) failures++;
}

// The same write the server action does (src/app/terugkoppeling/actions.ts), without the token.
async function save(planId: string, input: Parameters<typeof cleanCheckin>[0]) {
  const clean = cleanCheckin(input);
  if (!clean) throw new Error("input was not an answer");
  const row: Record<string, unknown> = { plan_id: planId, answer: clean.answer, locale: "nl", updated_at: new Date().toISOString() };
  if (clean.comment !== undefined) row.comment = clean.comment;
  if (clean.quoteConsent !== undefined) row.quote_consent = clean.quoteConsent;
  const { error } = await supabase.from("book_checkins").upsert(row, { onConflict: "plan_id" });
  if (error) throw new Error(error.message);
}

async function read(planId: string) {
  const { data, error } = await supabase.from("book_checkins").select("answer, comment, quote_consent").eq("plan_id", planId).single();
  if (error) throw new Error(error.message);
  return data as { answer: string; comment: string | null; quote_consent: boolean };
}

async function main() {
  const probe = await supabase.from("window_plans").select("checkin_sent_at").limit(1);
  const tables = await supabase.from("book_checkins").select("plan_id").limit(1);
  const optouts = await supabase.from("mail_optouts").select("email_hash").limit(1);
  const missing = [probe.error && "window_plans.checkin_sent_at", tables.error && "book_checkins", optouts.error && "mail_optouts"].filter(Boolean);
  if (missing.length) {
    console.log(`Not there yet: ${missing.join(", ")}. Run supabase/migrations/0032_book_checkins.sql in the SQL editor first.`);
    process.exit(2);
  }

  // 1. what the daily job would do right now (read only)
  const now = new Date();
  const due = await supabaseCheckinStore(supabase).listCandidates(new Date(now.getTime() - CHECKIN_MAX_AGE_MS), new Date(now.getTime() - CHECKIN_MIN_AGE_MS));
  console.log(`info  ${due.length} book(s) are 8 to 22 days old with an address and no check-in yet (the job would look at these; it also skips free test orders, opt-outs and books too close to the reminder)`);

  // 2. storage
  const { data: plans } = await supabase.from("window_plans").select("id").order("created_at", { ascending: false }).limit(20);
  const { data: answered } = await supabase.from("book_checkins").select("plan_id");
  const taken = new Set((answered ?? []).map((r) => (r as { plan_id: string }).plan_id));
  const planId = (plans ?? []).map((p) => (p as { id: string }).id).find((id) => !taken.has(id));
  if (!planId) throw new Error("There is no book without a check-in answer to test on.");

  const fake = "smoke-test-nobody@example.invalid";
  try {
    await save(planId, { answer: "planned" });
    let row = await read(planId);
    check("a plain answer is stored", row.answer === "planned" && row.comment === null && row.quote_consent === false);

    await save(planId, { answer: "done", comment: " eerste les gehad ", quoteConsent: true });
    row = await read(planId);
    check("the sentence is stored trimmed, with consent, for 'done'", row.answer === "done" && row.comment === "eerste les gehad" && row.quote_consent === true);

    await save(planId, { answer: "not" });
    row = await read(planId);
    check("changing the answer to 'not' withdraws the consent and keeps the sentence", row.answer === "not" && row.quote_consent === false && row.comment !== null);

    const { count } = await supabase.from("book_checkins").select("id", { count: "exact", head: true }).eq("plan_id", planId);
    check("one row per book however often it is saved", count === 1, `${count} row(s)`);

    const bad = await supabase.from("book_checkins").insert({ plan_id: planId, answer: "maybe" });
    check("the database refuses an answer it does not know", !!bad.error);

    // 3. the opt-out
    check("an address that did not opt out is not found", (await isOptedOut(supabase, fake)) === false);
    check("an opt-out is stored", (await recordOptOut(supabase, fake)) === true);
    check("and found again in any capitalisation", (await isOptedOut(supabase, ` ${fake.toUpperCase()} `)) === true);
    const { data: stored } = await supabase.from("mail_optouts").select("email_hash").eq("email_hash", emailHash(fake));
    check("what is stored is a hash, not the address", (stored ?? []).length === 1 && !JSON.stringify(stored).includes("nobody"));
  } finally {
    await supabase.from("book_checkins").delete().eq("plan_id", planId);
    await supabase.from("mail_optouts").delete().eq("email_hash", emailHash(fake));
    console.log("test rows deleted again");
  }
  console.log(failures === 0 ? "\nAll good." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
