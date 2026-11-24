// A check of the reward claim against the real database (Step 239), for after migration 0030 has been run. It adds a friend code of its own to the newest order, marks it as used
// up, and then claims the reward from five sides at once (exactly one may get it), takes the claim back, claims again, makes the reward code and notes its mail as sent. It deletes
// every row it made. Nothing is sent, no payment row is read or changed, nothing real is touched (it never uses a friend code of a real buyer). Free; safe at any time.
//
//   npx tsx --env-file=.env.local scripts/reward-smoke.ts
import { createClient } from "@supabase/supabase-js";
import { DISCOUNT_CENTS, generateCode, supabaseStore } from "../src/lib/discountCode";

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
  const probe = await supabase.from("discount_codes").select("rewarded_at, mailed_at").limit(1);
  if (probe.error) {
    console.log(`The columns are not there yet (${probe.error.message}). Run supabase/migrations/0030_discount_reward_codes.sql in the SQL editor first.`);
    process.exit(2);
  }
  const { data: payments } = await supabase.from("payments").select("id").order("created_at", { ascending: false }).limit(1);
  const paymentId = (payments?.[0] as { id?: string } | undefined)?.id;
  if (!paymentId) throw new Error("There is no order to attach test codes to.");

  const madeIds: string[] = [];
  try {
    const friend = await store.insert({ code: generateCode(), paymentId, amountCents: DISCOUNT_CENTS, expiresAt: new Date(Date.now() + 90 * 86_400_000), kind: "friend" });
    if (friend === "taken") throw new Error("the generated code was taken: run again");
    madeIds.push(friend.id);
    const now = new Date();

    check("a friend code that is not used up cannot be claimed", (await store.claimReward(friend.id, now)) === null);
    await supabase.from("discount_codes").update({ redeemed_at: now.toISOString() }).eq("id", friend.id);

    const claims = await Promise.all(Array.from({ length: 5 }, () => store.claimReward(friend.id, now)));
    check("five claims at once: exactly one gets the reward", claims.filter((c) => c !== null).length === 1, `${claims.filter((c) => c !== null).length} got it`);
    check("the claim names the order the friend code was issued for", claims.find((c) => c)?.paymentId === paymentId && claims.find((c) => c)?.code === friend.code);
    check("claiming again gives nothing", (await store.claimReward(friend.id, now)) === null);

    await store.unclaimReward(friend.id);
    check("after taking the claim back it can be claimed again", (await store.claimReward(friend.id, now)) !== null);

    const reward = await store.insert({ code: generateCode(), paymentId, amountCents: DISCOUNT_CENTS, expiresAt: new Date(Date.now() + 90 * 86_400_000), kind: "reward", reason: `vriend gebruikte ${friend.code}` });
    if (reward === "taken") throw new Error("the generated code was taken: run again");
    madeIds.push(reward.id);
    check("a reward code can be stored (kind reward, needs migration 0030)", true, reward.code);
    await store.markMailed(reward.id, now);
    const { data: row } = await supabase.from("discount_codes").select("kind, mailed_at").eq("id", reward.id).single();
    check("its mail is noted as sent", (row as { kind?: string; mailed_at?: string | null } | null)?.kind === "reward" && !!(row as { mailed_at?: string | null } | null)?.mailed_at);

    // a code of kind order is never claimable, so a friend who used the buyer's own order code earns nobody anything
    const own = await store.findByPayment(paymentId);
    if (own) check("a code of another kind is never claimable", (await store.claimReward(own.id, now)) === null);
  } finally {
    if (madeIds.length) await supabase.from("discount_codes").delete().in("id", madeIds);
    console.log(`${madeIds.length} test code(s) deleted again`);
  }
  console.log(failures === 0 ? "\nAll good." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
