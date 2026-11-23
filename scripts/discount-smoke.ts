// A check of the one-time discount codes against the real database (Step 230), for after migration 0027 has been run. It uses the newest order as the order
// that "earned" a code, issues a code, holds it from five sides at once (exactly one may get it), lets it go, uses it up, and then deletes its own row.
// Nothing else is touched: no payment row is changed, nothing is sent, nothing is paid. Free.
//
//   npx tsx --env-file=.env.local scripts/discount-smoke.ts
import { createClient } from "@supabase/supabase-js";
import { checkCode, issueCode, releaseCode, reserveCode, supabaseStore } from "../src/lib/discountCode";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase credentials missing in the environment");
const supabase = createClient(url, key);
const store = supabaseStore(supabase);

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${extra ? ` (${extra})` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const probe = await supabase.from("discount_codes").select("id").limit(1);
  if (probe.error) {
    console.log(`The table is not there yet (${probe.error.message}). Run supabase/migrations/0027_discount_codes.sql in the SQL editor first.`);
    process.exit(2);
  }
  const { data: payments } = await supabase.from("payments").select("id").order("created_at", { ascending: false }).limit(1);
  const paymentId = (payments?.[0] as { id?: string } | undefined)?.id;
  if (!paymentId) throw new Error("There is no order to attach a test code to.");

  let id: string | null = null;
  try {
    const issued = await issueCode(store, paymentId);
    check("a code is issued for an order", !!issued, issued?.code);
    if (!issued) return;
    check("asking again gives the same code", (await issueCode(store, paymentId))?.code === issued.code);
    const row = await store.findByCode(issued.code);
    id = row?.id ?? null;
    check("it is worth EUR 2.50 and valid for about 90 days", issued.amountCents === 250 && Math.abs((issued.expiresAt.getTime() - Date.now()) / 86_400_000 - 90) < 1);

    const typed = issued.code.toLowerCase().replace(/-/g, " ");
    check("a good code, typed loosely, is accepted by the check", (await checkCode(store, typed)).ok);
    check("a code that does not exist is refused as invalid", JSON.stringify(await checkCode(store, "WI-ZZZZ-ZZZZ")) === JSON.stringify({ ok: false, reason: "invalid" }));

    const tries = await Promise.all(Array.from({ length: 5 }, () => reserveCode(store, issued.code)));
    check("five orders try to hold it at once: exactly one gets it", tries.filter((t) => t.ok).length === 1, `${tries.filter((t) => t.ok).length} got it`);
    const busy = await checkCode(store, issued.code);
    check("while it is held, the check says busy", !busy.ok && busy.reason === "busy");

    if (id) {
      await releaseCode(store, id);
      check("after release it can be held again", (await reserveCode(store, issued.code)).ok);
      await supabase.from("discount_codes").update({ redeemed_at: new Date().toISOString(), reserved_until: null }).eq("id", id);
      const used = await reserveCode(store, issued.code);
      check("once used up, it is refused as used", !used.ok && used.reason === "used");
      await supabase.from("discount_codes").update({ redeemed_at: null, expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", id);
      const expired = await checkCode(store, issued.code);
      check("past its date, it is refused as expired", !expired.ok && expired.reason === "expired");
    }
  } finally {
    if (id) await supabase.from("discount_codes").delete().eq("id", id);
    else await supabase.from("discount_codes").delete().eq("issued_for_payment_id", paymentId);
    console.log("the test code was deleted again");
  }
  console.log(failures === 0 ? "\nAll good." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
