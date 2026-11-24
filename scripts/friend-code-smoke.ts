// A check of the friend codes against the real database (Step 238), for after migration 0029 has been run. It issues the friend codes of the newest order, asks again (the
// same ones must come back, none added), checks that the order's own code and the compensation codes are not touched, and then deletes only the rows it made itself.
// If that order already has friend codes (a real book was sent after migration 0029), it stops and touches nothing. Nothing is sent, nothing is paid. Free.
//
//   npx tsx --env-file=.env.local scripts/friend-code-smoke.ts
import { createClient } from "@supabase/supabase-js";
import { FRIEND_CODES_PER_ORDER, checkCode, issueFriendCodes, supabaseStore } from "../src/lib/discountCode";

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
  const { data: payments } = await supabase.from("payments").select("id").order("created_at", { ascending: false }).limit(1);
  const paymentId = (payments?.[0] as { id?: string } | undefined)?.id;
  if (!paymentId) throw new Error("There is no order to attach test codes to.");

  const before = await supabase.from("discount_codes").select("id, kind").eq("issued_for_payment_id", paymentId);
  if (before.error) {
    console.log(`The table cannot be read (${before.error.message}). Has migration 0027 been run?`);
    process.exit(2);
  }
  if ((before.data ?? []).some((r) => (r as { kind?: string }).kind === "friend")) {
    console.log("The newest order already has friend codes: nothing was touched. (They are real codes: leave them.)");
    process.exit(0);
  }
  const knownIds = new Set((before.data ?? []).map((r) => (r as { id: string }).id));

  try {
    const first = await issueFriendCodes(store, paymentId);
    check(`${FRIEND_CODES_PER_ORDER} friend codes are issued (needs migration 0029)`, first.length === FRIEND_CODES_PER_ORDER, `${first.length} made`);
    if (first.length === 0) {
      console.log("None could be issued: run supabase/migrations/0029_discount_friend_codes.sql in the SQL editor first.");
      return;
    }
    const again = await issueFriendCodes(store, paymentId);
    check("asking again gives the same codes, none added", again.length === first.length && again.every((c, i) => c.code === first[i].code));
    check("each is worth EUR 2.50, valid for about 90 days, and all different", first.every((c) => c.amountCents === 250 && Math.abs((c.expiresAt.getTime() - Date.now()) / 86_400_000 - 90) < 1) && new Set(first.map((c) => c.code)).size === first.length);
    check("a friend can use one: the order check accepts it", (await checkCode(store, first[0].code)).ok);
    const own = await store.findByPayment(paymentId);
    check("the order's own code is still the first one, not a friend code", !first.some((c) => c.code === own?.code));
  } finally {
    const after = await supabase.from("discount_codes").select("id").eq("issued_for_payment_id", paymentId).eq("kind", "friend");
    const mine = (after.data ?? []).map((r) => (r as { id: string }).id).filter((id) => !knownIds.has(id));
    if (mine.length) await supabase.from("discount_codes").delete().in("id", mine);
    console.log(`${mine.length} test code(s) deleted again`);
  }
  console.log(failures === 0 ? "\nAll good." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
