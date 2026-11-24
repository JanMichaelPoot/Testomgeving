import { describe, expect, it, vi } from "vitest";
import { DISCOUNT_CENTS, VALID_DAYS, issueCode, issueFriendCodes, normalizeCode, type DiscountStore } from "@/lib/discountCode";
import { memoryStore } from "@/lib/discountCode.fake";
import { rewardReferrer, type Referrer, type RewardMail } from "@/lib/referralReward";

// The reward for the buyer (Step 239): a friend pays with a friend code, the buyer who passed it on gets a code of their own. Tested against the in-memory store.

const NOW = new Date("2026-11-25T10:00:00Z");
const REFERRER: Referrer = { email: "buyer@example.com", language: "nl", orderNumber: "WI-2026-000069" };

/** A buyer (order "pay-buyer") with three friend codes, and a friend who ordered "cs_friend" with the first of them (paid: the code is used up). */
async function setup(over: { redeemed?: boolean; referrer?: Referrer | null } = {}) {
  const { store, rows, orderCode } = memoryStore();
  await issueCode(store, "pay-buyer", NOW);
  const friendCodes = await issueFriendCodes(store, "pay-buyer", NOW);
  const friendRow = rows.find((r) => r.code === friendCodes[0].code)!;
  orderCode.set("cs_friend", friendRow.id);
  if (over.redeemed !== false) friendRow.redeemedAt = NOW;
  const mails: RewardMail[] = [];
  const referrer = over.referrer === undefined ? REFERRER : over.referrer;
  const deps = {
    store,
    findReferrer: vi.fn(async () => referrer),
    sendMail: vi.fn(async (m: RewardMail) => {
      mails.push(m);
    }),
    now: NOW,
  };
  return { store, rows, friendRow, friendCodes, mails, deps, orderCode };
}

describe("rewardReferrer", () => {
  it("gives the buyer a code of EUR 2.50, 90 days, by mail to the address of their order, in their language", async () => {
    const { deps, mails, rows } = await setup();
    const out = await rewardReferrer(deps, "cs_friend", ["friend@example.org"]);
    expect(out.status).toBe("granted");
    const reward = rows.find((r) => r.kind === "reward")!;
    expect(reward).toMatchObject({ paymentId: "pay-buyer", amountCents: DISCOUNT_CENTS });
    expect(reward.expiresAt.getTime()).toBe(NOW.getTime() + VALID_DAYS * 86_400_000);
    expect(normalizeCode(reward.code)).toBe(reward.code);
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: "buyer@example.com", locale: "nl", code: reward.code, amountCents: DISCOUNT_CENTS, orderNumber: "WI-2026-000069" });
    expect(reward.mailedAt).toEqual(NOW);
  });

  it("notes which friend code it was for, for the owner, and never in the mail", async () => {
    const { deps, mails, rows, friendCodes } = await setup();
    await rewardReferrer(deps, "cs_friend", ["friend@example.org"]);
    expect(rows.find((r) => r.kind === "reward")!.reason).toContain(friendCodes[0].code);
    expect(JSON.stringify(mails[0])).not.toContain(friendCodes[0].code);
    expect(JSON.stringify(mails[0])).not.toContain("friend@example.org");
  });

  it("rewards once, however many times the payment is confirmed", async () => {
    const { deps, mails, rows } = await setup();
    const results = await Promise.all([1, 2, 3, 4].map(() => rewardReferrer(deps, "cs_friend", ["friend@example.org"])));
    expect(results.filter((r) => r.status === "granted")).toHaveLength(1);
    expect(results.filter((r) => r.status === "none")).toHaveLength(3);
    expect(rows.filter((r) => r.kind === "reward")).toHaveLength(1);
    expect(mails).toHaveLength(1);
    // and once more later
    expect(await rewardReferrer(deps, "cs_friend", ["friend@example.org"])).toEqual({ status: "none", reason: "not_rewardable" });
  });

  it("gives nothing for an order that used no code, or the buyer's own kind of code", async () => {
    const { deps, mails, rows, orderCode } = await setup();
    expect(await rewardReferrer(deps, "cs_nothing", ["x@example.org"])).toEqual({ status: "none", reason: "no_code" });
    // an order that used the code the buyer earned by ordering, or a compensation code (not a friend code), is no reward either
    const own = rows.find((r) => r.kind === undefined)!;
    own.redeemedAt = NOW;
    orderCode.set("cs_own", own.id);
    expect(await rewardReferrer(deps, "cs_own", ["x@example.org"])).toEqual({ status: "none", reason: "not_rewardable" });
    expect(mails).toHaveLength(0);
    expect(rows.filter((r) => r.kind === "reward")).toHaveLength(0);
  });

  it("gives nothing for a code that is not used up yet", async () => {
    const { deps, mails } = await setup({ redeemed: false });
    expect(await rewardReferrer(deps, "cs_friend", ["friend@example.org"])).toEqual({ status: "none", reason: "not_rewardable" });
    expect(mails).toHaveLength(0);
  });

  it("gives nothing to a buyer who used their own friend code, whichever address shows it, and says so", async () => {
    for (const mine of ["buyer@example.com", "  BUYER@Example.com ", null]) {
      const { deps, mails, rows } = await setup();
      const out = await rewardReferrer(deps, "cs_friend", [mine === null ? "buyer@example.com" : mine, "other@example.org"]);
      expect(out).toEqual({ status: "none", reason: "self" });
      expect(rows.filter((r) => r.kind === "reward")).toHaveLength(0);
      expect(mails).toHaveLength(0);
    }
  });

  it("makes the code but says it was not mailed when the buyer has no address, or the mail fails", async () => {
    const noAddress = await setup({ referrer: { ...REFERRER, email: null } });
    const a = await rewardReferrer(noAddress.deps, "cs_friend", ["friend@example.org"]);
    expect(a.status).toBe("unmailed");
    expect(noAddress.rows.filter((r) => r.kind === "reward")).toHaveLength(1);
    expect(noAddress.rows.find((r) => r.kind === "reward")!.mailedAt).toBeUndefined();

    const failing = await setup();
    failing.deps.sendMail.mockRejectedValueOnce(new Error("resend down"));
    const b = await rewardReferrer(failing.deps, "cs_friend", ["friend@example.org"]);
    expect(b).toMatchObject({ status: "unmailed", reason: "resend down" });
    expect(failing.rows.find((r) => r.kind === "reward")!.mailedAt).toBeUndefined();
    // the friend code stays claimed: the reward exists, it is only the mail that did not go out
    expect(failing.friendRow.rewardedAt).toEqual(NOW);
  });

  it("takes the claim back when the code cannot be made, so a later attempt can still give it", async () => {
    const { deps, store, friendRow, rows } = await setup();
    const broken = { ...deps, store: { ...store, insert: vi.fn(async () => { throw new Error("connection reset"); }) } as DiscountStore };
    const out = await rewardReferrer(broken, "cs_friend", ["friend@example.org"]);
    expect(out).toEqual({ status: "failed", reason: "connection reset" });
    expect(friendRow.rewardedAt).toBeNull();
    // later, with the storage back: it gives the reward after all
    expect((await rewardReferrer(deps, "cs_friend", ["friend@example.org"])).status).toBe("granted");
    expect(rows.filter((r) => r.kind === "reward")).toHaveLength(1);
  });

  it("never throws, whatever the storage does", async () => {
    const { deps, store } = await setup();
    const dead = { ...deps, store: { ...store, codeIdForOrder: vi.fn(async () => { throw new Error("no table"); }) } as DiscountStore };
    await expect(rewardReferrer(dead, "cs_friend", ["a@b.nl"])).resolves.toEqual({ status: "failed", reason: "no table" });
  });

  it("rewards each of the three friends, each once, with three different codes", async () => {
    const { deps, store, rows, friendCodes, orderCode } = await setup();
    for (const [i, f] of friendCodes.entries()) {
      const row = rows.find((r) => r.code === f.code)!;
      row.redeemedAt = NOW;
      orderCode.set(`cs_f${i}`, row.id);
    }
    const outs = await Promise.all(friendCodes.map((_, i) => rewardReferrer({ ...deps, store }, `cs_f${i}`, [`f${i}@example.org`])));
    expect(outs.every((o) => o.status === "granted")).toBe(true);
    const rewards = rows.filter((r) => r.kind === "reward");
    expect(rewards).toHaveLength(3);
    expect(new Set(rewards.map((r) => r.code)).size).toBe(3);
  });
});
