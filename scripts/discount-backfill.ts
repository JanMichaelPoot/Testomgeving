// Issues a discount code for the paid orders that were placed before migration 0027 had been run (their mail went out without the code the buyer was promised). Run it
// once after the migration. It only ISSUES codes (one per order, the same code when an order already has one); it sends nothing: the codes are printed, so they can be
// passed on by hand (a short mail, a message) to the buyers who should have had them. Dry run by default.
//
//   npx tsx --env-file=.env.local scripts/discount-backfill.ts            what it would do
//   npx tsx --env-file=.env.local scripts/discount-backfill.ts --issue    issue the codes and print them
//   add  --since 2026-11-20  to look only at orders from that date on (default: the last 30 days)
import { createClient } from "@supabase/supabase-js";
import { issueCode, supabaseStore } from "../src/lib/discountCode";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase credentials missing in the environment");
const supabase = createClient(url, key);
const store = supabaseStore(supabase);

const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const issue = process.argv.includes("--issue");
const since = arg("--since") ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

async function main() {
  const probe = await supabase.from("discount_codes").select("id").limit(1);
  if (probe.error) {
    console.log(`The table is not there yet (${probe.error.message}). Run supabase/migrations/0027_discount_codes.sql in the SQL editor first.`);
    process.exit(2);
  }
  // Paid orders only: a free test order (amount 0) earns no code.
  const { data: payments, error } = await supabase
    .from("payments")
    .select("id, order_number, amount, created_at, status")
    .eq("status", "succeeded")
    .gt("amount", 0)
    .gte("created_at", since)
    .order("created_at");
  if (error) throw new Error(error.message);
  console.log(`${payments?.length ?? 0} paid order(s) since ${since}${issue ? "" : " (dry run: add --issue to issue the codes)"}`);
  for (const p of payments ?? []) {
    const have = await store.findByPayment(p.id);
    if (have) {
      console.log(`  ${p.order_number}  already has ${have.code}`);
      continue;
    }
    if (!issue) {
      console.log(`  ${p.order_number}  has no code yet (EUR ${(p.amount / 100).toFixed(2)})`);
      continue;
    }
    const made = await issueCode(store, p.id);
    console.log(`  ${p.order_number}  ${made ? `issued ${made.code} (valid until ${made.expiresAt.toISOString().slice(0, 10)})` : "COULD NOT ISSUE"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
