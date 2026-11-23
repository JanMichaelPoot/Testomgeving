import { describe, expect, it, vi } from "vitest";
import {
  DISCOUNT_CENTS,
  HOLD_MINUTES,
  MIN_PRICE_CENTS,
  VALID_DAYS,
  checkCode,
  createAttemptLimiter,
  MAX_COMPENSATIONS_PER_ORDER,
  generateCode,
  issueCode,
  issueCompensation,
  normalizeCode,
  priceAfterDiscount,
  reserveCode,
  type DiscountStore,
} from "@/lib/discountCode";

// The rules are tested against an in-memory store with the same semantics as the table (a code per order, one atomic hold, redeem and release by order).
interface Row {
  id: string;
  code: string;
  paymentId: string;
  amountCents: number;
  expiresAt: Date;
  reservedUntil: Date | null;
  redeemedAt: Date | null;
  kind?: string;
}
function memoryStore(seedPayments: Record<string, string> = {}) {
  const rows: Row[] = [];
  const orderCode = new Map<string, string>(); // stripe session id of an order -> the code row it uses
  const store: DiscountStore = {
    async findByPayment(paymentId) {
      const r = rows.find((x) => x.paymentId === paymentId && x.kind !== "compensation");
      return r ? { id: r.id, code: r.code, amountCents: r.amountCents, expiresAt: r.expiresAt } : null;
    },
    async insert({ code, paymentId, amountCents, expiresAt, kind }) {
      // a code is unique; an order has one "order" code, and any number of compensation codes (migration 0028)
      if (rows.some((x) => x.code === code || (kind !== "compensation" && x.paymentId === paymentId && x.kind !== "compensation"))) return "taken";
      const r: Row = { id: `id-${rows.length + 1}`, code, paymentId, amountCents, expiresAt, reservedUntil: null, redeemedAt: null, kind };
      rows.push(r);
      return { id: r.id, code, amountCents, expiresAt };
    },
    async findByCode(code) {
      const r = rows.find((x) => x.code === code);
      return r ? { id: r.id, code: r.code, amountCents: r.amountCents, expiresAt: r.expiresAt, redeemedAt: r.redeemedAt, reservedUntil: r.reservedUntil } : null;
    },
    async hold(code, now, until) {
      const r = rows.find((x) => x.code === code);
      if (!r || r.redeemedAt || r.expiresAt <= now || (r.reservedUntil && r.reservedUntil > now)) return null;
      r.reservedUntil = until;
      return { id: r.id, amountCents: r.amountCents };
    },
    async releaseForOrder(session) {
      const r = rows.find((x) => x.id === orderCode.get(session));
      if (r && !r.redeemedAt) r.reservedUntil = null;
    },
    async releaseById(id) {
      const r = rows.find((x) => x.id === id);
      if (r && !r.redeemedAt) r.reservedUntil = null;
    },
    async redeemForOrder(session, now) {
      const r = rows.find((x) => x.id === orderCode.get(session));
      if (!r) return false;
      if (!r.redeemedAt) {
        r.redeemedAt = now;
        r.reservedUntil = null;
      }
      return true;
    },
  };
  void seedPayments;
  return { store, rows, orderCode };
}

const NOW = new Date("2026-11-23T10:00:00Z");

describe("the code itself", () => {
  it("is eight signs in two groups after WI, from an alphabet without look-alikes", () => {
    const code = generateCode();
    expect(code).toMatch(/^WI-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(new Set(Array.from({ length: 200 }, () => generateCode())).size).toBe(200);
    // the picker decides the signs: always the first sign of the alphabet gives AAAA-AAAA
    expect(generateCode(() => 0)).toBe("WI-AAAA-AAAA");
  });

  it("reads what a person types: any case, with or without dashes and spaces", () => {
    expect(normalizeCode("wi-abcd-efgh")).toBe("WI-ABCD-EFGH");
    expect(normalizeCode(" WI ABCD EFGH ")).toBe("WI-ABCD-EFGH");
    expect(normalizeCode("WIABCDEFGH")).toBe("WI-ABCD-EFGH");
    expect(normalizeCode("WI-ABCD-EFG")).toBeNull();
    expect(normalizeCode("XX-ABCD-EFGH")).toBeNull();
    expect(normalizeCode("WI-ABCD-EF0H")).toBeNull(); // 0 is not in the alphabet
    expect(normalizeCode("")).toBeNull();
    expect(normalizeCode(undefined)).toBeNull();
  });

  it("takes EUR 2.50 off, and never leaves a book under EUR 1", () => {
    expect(DISCOUNT_CENTS).toBe(250);
    expect(priceAfterDiscount(750, 250)).toBe(500);
    expect(priceAfterDiscount(595, 250)).toBe(345);
    expect(priceAfterDiscount(300, 250)).toBe(MIN_PRICE_CENTS);
    expect(priceAfterDiscount(80, 250)).toBe(80);
  });
});

describe("issuing", () => {
  it("gives a paid order one code that is valid for 90 days, and the same one when asked again", async () => {
    const { store } = memoryStore();
    const first = await issueCode(store, "pay-1", NOW);
    expect(first).toMatchObject({ amountCents: 250 });
    expect(first!.expiresAt.getTime() - NOW.getTime()).toBe(VALID_DAYS * 86_400_000);
    const again = await issueCode(store, "pay-1", new Date(NOW.getTime() + 5 * 86_400_000));
    expect(again!.code).toBe(first!.code);
    expect(again!.expiresAt.getTime()).toBe(first!.expiresAt.getTime());
    const other = await issueCode(store, "pay-2", NOW);
    expect(other!.code).not.toBe(first!.code);
  });

  it("tries another code when one is already taken, and gives up quietly when the storage fails", async () => {
    const { store } = memoryStore();
    let n = 0;
    const picks = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]; // AAAA-AAAA first, then BBBB-BBBB
    const pick = () => picks[n++] ?? 2;
    expect((await issueCode(store, "pay-1", NOW, pick))!.code).toBe("WI-AAAA-AAAA");
    n = 0;
    expect((await issueCode(store, "pay-2", NOW, pick))!.code).toBe("WI-BBBB-BBBB");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken: DiscountStore = { ...store, findByPayment: async () => { throw new Error("relation does not exist"); } };
    expect(await issueCode(broken, "pay-3", NOW)).toBeNull();
    err.mockRestore();
  });
});

describe("checking and holding a code", () => {
  async function ready() {
    const m = memoryStore();
    const issued = (await issueCode(m.store, "pay-1", NOW))!;
    return { ...m, code: issued.code };
  }

  it("accepts a good code, typed in any form, and changes nothing by checking", async () => {
    const { store, code, rows } = await ready();
    const typed = code.toLowerCase().replace(/-/g, " ");
    expect(await checkCode(store, typed, NOW)).toMatchObject({ ok: true, amountCents: 250, code });
    expect(rows[0].reservedUntil).toBeNull();
  });

  it("says why a code cannot be used: not a code, unknown, used up, expired, held by another order", async () => {
    const { store, rows, code } = await ready();
    expect(await checkCode(store, "hello", NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(await checkCode(store, "WI-ZZZZ-ZZZZ", NOW)).toEqual({ ok: false, reason: "invalid" });
    rows[0].reservedUntil = new Date(NOW.getTime() + 60_000);
    expect(await checkCode(store, code, NOW)).toEqual({ ok: false, reason: "busy" });
    rows[0].reservedUntil = null;
    rows[0].redeemedAt = NOW;
    expect(await checkCode(store, code, NOW)).toEqual({ ok: false, reason: "used" });
    rows[0].redeemedAt = null;
    expect(await checkCode(store, code, new Date(NOW.getTime() + (VALID_DAYS + 1) * 86_400_000))).toEqual({ ok: false, reason: "expired" });
  });

  it("holds a code for one order only: the second order that tries at the same moment is told it is busy", async () => {
    const { store, code } = await ready();
    const [a, b] = await Promise.all([reserveCode(store, code, NOW), reserveCode(store, code, NOW)]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    const loser = a.ok ? b : a;
    expect(loser).toEqual({ ok: false, reason: "busy" });
  });

  it("lets the code go after the hold has run out, or when the payment fails, but never after it was used", async () => {
    const { store, rows, orderCode, code } = await ready();
    const held = await reserveCode(store, code, NOW);
    expect(held.ok).toBe(true);
    // the hold is longer than a Checkout Session lasts; after it has passed another order can have the code
    const later = new Date(NOW.getTime() + (HOLD_MINUTES + 1) * 60_000);
    expect((await reserveCode(store, code, later)).ok).toBe(true);
    // a failed payment releases it at once
    orderCode.set("cs_1", rows[0].id);
    await store.releaseForOrder("cs_1");
    expect(rows[0].reservedUntil).toBeNull();
    // a confirmed payment uses it up for good, and a late release or a second redeem changes nothing
    await reserveCode(store, code, later);
    expect(await store.redeemForOrder("cs_1", later)).toBe(true);
    await store.releaseForOrder("cs_1");
    expect(rows[0].redeemedAt).toEqual(later);
    expect(await reserveCode(store, code, new Date(later.getTime() + 86_400_000))).toEqual({ ok: false, reason: "used" });
  });

  it("answers 'unavailable' when the storage cannot be reached, instead of throwing", async () => {
    const { store, code } = await ready();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken: DiscountStore = { ...store, findByCode: async () => { throw new Error("down"); }, hold: async () => { throw new Error("down"); } };
    expect(await checkCode(broken, code, NOW)).toEqual({ ok: false, reason: "unavailable" });
    expect(await reserveCode(broken, code, NOW)).toEqual({ ok: false, reason: "unavailable" });
    err.mockRestore();
  });
});

describe("the brake on guessing", () => {
  it("allows a few tries per session in a window, then stops, and starts again after the window", () => {
    let t = 0;
    const allow = createAttemptLimiter(3, 1000, () => t);
    expect([allow("s"), allow("s"), allow("s"), allow("s")]).toEqual([true, true, true, false]);
    expect(allow("other")).toBe(true);
    t = 1500;
    expect(allow("s")).toBe(true);
  });
});

describe("compensation codes (Step 235)", () => {
  it("gives an order any number of extra codes next to the one it earned, each worth EUR 2.50 and valid for 90 days", async () => {
    const { store, rows } = memoryStore();
    const earned = (await issueCode(store, "pay-1", NOW))!;
    const first = await issueCompensation(store, "pay-1", "Plek X was gesloten", NOW);
    const second = await issueCompensation(store, "pay-1", "", NOW);
    expect(first).toMatchObject({ ok: true, code: { amountCents: 250 } });
    expect(second.ok && first.ok && second.code.code !== first.code.code && first.code.code !== earned.code).toBe(true);
    expect(rows.filter((r) => r.paymentId === "pay-1")).toHaveLength(3);
    expect(first.ok && first.code.expiresAt.getTime() - NOW.getTime()).toBe(VALID_DAYS * 86_400_000);
    // the code the order earned by ordering is still the one asked for, and still one per order
    expect((await issueCode(store, "pay-1", NOW))!.code).toBe(earned.code);
    expect(rows.filter((r) => r.paymentId === "pay-1" && r.kind !== "compensation")).toHaveLength(1);
    expect(MAX_COMPENSATIONS_PER_ORDER).toBe(3);
  });

  it("is a code like any other: it can be checked, held and used up", async () => {
    const { store } = memoryStore();
    const made = await issueCompensation(store, "pay-1", "x", NOW);
    expect(made.ok).toBe(true);
    const code = made.ok ? made.code.code : "";
    expect((await reserveCode(store, code, NOW)).ok).toBe(true);
    expect(await reserveCode(store, code, NOW)).toEqual({ ok: false, reason: "busy" });
  });

  it("says 'migration' when the columns of migration 0028 are not there, and 'storage' for any other failure", async () => {
    const { store } = memoryStore();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const noColumns: DiscountStore = { ...store, insert: async () => { throw new Error("Could not find the 'kind' column of 'discount_codes' in the schema cache"); } };
    expect(await issueCompensation(noColumns, "pay-1", "x", NOW)).toEqual({ ok: false, error: "migration" });
    const down: DiscountStore = { ...store, insert: async () => { throw new Error("connection refused"); } };
    expect(await issueCompensation(down, "pay-1", "x", NOW)).toEqual({ ok: false, error: "storage" });
    err.mockRestore();
  });

  it("keeps the note short and for the owner only", async () => {
    const { store, rows } = memoryStore();
    const seen: string[] = [];
    const spy: DiscountStore = { ...store, insert: async (i) => { seen.push(i.reason ?? ""); return store.insert(i); } };
    await issueCompensation(spy, "pay-1", `  ${"x".repeat(500)}  `, NOW);
    expect(seen[0]).toHaveLength(300);
    expect(rows).toHaveLength(1);
  });
});
