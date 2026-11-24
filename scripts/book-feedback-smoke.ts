// A check of the book rating against the real database (Step 241), for after migration 0031 has been run. It picks a book that has no rating yet, stores a score, adds a sentence with consent,
// stores a plain score again (the sentence must stay), lowers the score (consent must go), then deletes its row. Nothing is sent, nothing else is touched, and a book that
// already has a real rating is never used. Free; safe at any time.
//
//   npx tsx --env-file=.env.local scripts/book-feedback-smoke.ts
import { createClient } from "@supabase/supabase-js";
import { cleanBookFeedback } from "../src/lib/bookFeedback";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase credentials missing in the environment");
const supabase = createClient(url, key);

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${extra ? ` (${extra})` : ""}`);
  if (!ok) failures++;
}

// The same write the server action does (src/app/plan/bookFeedbackActions.ts), without the session check.
async function save(planId: string, input: Parameters<typeof cleanBookFeedback>[0]) {
  const clean = cleanBookFeedback(input);
  if (!clean) throw new Error("input was not a rating");
  const row: Record<string, unknown> = { plan_id: planId, rating: clean.rating, locale: "nl", updated_at: new Date().toISOString() };
  if (clean.comment !== undefined) row.comment = clean.comment;
  if (clean.quoteConsent !== undefined) row.quote_consent = clean.quoteConsent;
  const { error } = await supabase.from("book_feedback").upsert(row, { onConflict: "plan_id" });
  if (error) throw new Error(error.message);
}

async function read(planId: string) {
  const { data, error } = await supabase.from("book_feedback").select("rating, comment, quote_consent").eq("plan_id", planId).single();
  if (error) throw new Error(error.message);
  return data as { rating: number; comment: string | null; quote_consent: boolean };
}

async function main() {
  const probe = await supabase.from("book_feedback").select("plan_id").limit(1);
  if (probe.error) {
    console.log(`The table is not there yet (${probe.error.message}). Run supabase/migrations/0031_book_feedback.sql in the SQL editor first.`);
    process.exit(2);
  }
  const { data: plans } = await supabase.from("window_plans").select("id").order("created_at", { ascending: false }).limit(20);
  const { data: rated } = await supabase.from("book_feedback").select("plan_id");
  const taken = new Set((rated ?? []).map((r) => (r as { plan_id: string }).plan_id));
  const planId = (plans ?? []).map((p) => (p as { id: string }).id).find((id) => !taken.has(id));
  if (!planId) throw new Error("There is no book without a rating to test on.");

  try {
    await save(planId, { rating: 5 });
    let row = await read(planId);
    check("a plain score is stored", row.rating === 5 && row.comment === null && row.quote_consent === false);

    await save(planId, { rating: 5, comment: " Heerlijk, ik ga het doen ", quoteConsent: true });
    row = await read(planId);
    check("the sentence is stored trimmed, with consent", row.comment === "Heerlijk, ik ga het doen" && row.quote_consent === true);

    await save(planId, { rating: 4 });
    row = await read(planId);
    check("a plain score keeps the sentence and the consent", row.rating === 4 && row.comment === "Heerlijk, ik ga het doen" && row.quote_consent === true);

    await save(planId, { rating: 2 });
    row = await read(planId);
    check("a lower score withdraws the consent but keeps the sentence", row.rating === 2 && row.quote_consent === false && row.comment !== null);

    const { count } = await supabase.from("book_feedback").select("id", { count: "exact", head: true }).eq("plan_id", planId);
    check("one row per book however often it is saved", count === 1, `${count} row(s)`);

    const bad = await supabase.from("book_feedback").insert({ plan_id: planId, rating: 9 });
    check("the database refuses a score of 9", !!bad.error);
  } finally {
    await supabase.from("book_feedback").delete().eq("plan_id", planId);
    console.log("test row deleted again");
  }
  console.log(failures === 0 ? "\nAll good." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
