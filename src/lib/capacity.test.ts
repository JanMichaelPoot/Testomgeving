import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BREAKER_FAILURES,
  DEFAULT_DAILY_BOOK_LIMIT,
  checkoutPaused,
  dailyBookLimit,
  decideCapacity,
  isBreakerOpen,
  loadCapacity,
  resetCapacityCache,
  startOfDutchDay,
} from "@/lib/capacity";

const plan = (status: string, session: string) => ({ status, session_id: session });

describe("settings", () => {
  it("defaults to a daily maximum, and can be switched off or set", () => {
    expect(dailyBookLimit({})).toBe(DEFAULT_DAILY_BOOK_LIMIT);
    expect(dailyBookLimit({ WINDOW_DAILY_BOOK_LIMIT: "12" })).toBe(12);
    expect(dailyBookLimit({ WINDOW_DAILY_BOOK_LIMIT: '"12"' })).toBe(12);
    expect(dailyBookLimit({ WINDOW_DAILY_BOOK_LIMIT: "0" })).toBeNull();
    expect(dailyBookLimit({ WINDOW_DAILY_BOOK_LIMIT: "OFF" })).toBeNull();
    // Something unreadable never means "no maximum": it falls back to the safe default.
    expect(dailyBookLimit({ WINDOW_DAILY_BOOK_LIMIT: "veel" })).toBe(DEFAULT_DAILY_BOOK_LIMIT);
    expect(dailyBookLimit({ WINDOW_DAILY_BOOK_LIMIT: "-3" })).toBe(DEFAULT_DAILY_BOOK_LIMIT);
  });

  it("pauses only on an explicit yes", () => {
    expect(checkoutPaused({})).toBe(false);
    expect(checkoutPaused({ WINDOW_CHECKOUT_PAUSED: "1" })).toBe(true);
    expect(checkoutPaused({ WINDOW_CHECKOUT_PAUSED: "true" })).toBe(true);
    expect(checkoutPaused({ WINDOW_CHECKOUT_PAUSED: "0" })).toBe(false);
    expect(checkoutPaused({ WINDOW_CHECKOUT_PAUSED: "" })).toBe(false);
  });
});

describe("startOfDutchDay", () => {
  it("is midnight in the Netherlands: 23:00 UTC the evening before in winter", () => {
    expect(startOfDutchDay(new Date("2026-11-23T12:00:00Z")).toISOString()).toBe("2026-11-22T23:00:00.000Z");
    // 00:30 Dutch time on the 23rd is still 23:30 UTC on the 22nd: that is already the new day.
    expect(startOfDutchDay(new Date("2026-11-22T23:30:00Z")).toISOString()).toBe("2026-11-22T23:00:00.000Z");
    // 22:59 UTC is 23:59 Dutch time on the 22nd: still the old day.
    expect(startOfDutchDay(new Date("2026-11-22T22:59:00Z")).toISOString()).toBe("2026-11-21T23:00:00.000Z");
  });

  it("is 22:00 UTC the evening before in summer", () => {
    expect(startOfDutchDay(new Date("2026-07-15T10:00:00Z")).toISOString()).toBe("2026-07-14T22:00:00.000Z");
  });
});

describe("the circuit breaker", () => {
  it("opens when the newest three books failed for at least two different visitors", () => {
    expect(isBreakerOpen([plan("failed", "a"), plan("failed", "b"), plan("failed", "a")])).toBe(true);
  });

  it("stays shut for one visitor who fails again and again", () => {
    expect(isBreakerOpen([plan("failed", "a"), plan("failed", "a"), plan("failed", "a")])).toBe(false);
  });

  it("stays shut when a book in between worked or is still being made", () => {
    expect(isBreakerOpen([plan("failed", "a"), plan("ready", "b"), plan("failed", "c")])).toBe(false);
    expect(isBreakerOpen([plan("pending", "a"), plan("failed", "b"), plan("failed", "c")])).toBe(false);
  });

  it("needs a full run of failures", () => {
    expect(BREAKER_FAILURES).toBe(3);
    expect(isBreakerOpen([plan("failed", "a"), plan("failed", "b")])).toBe(false);
    expect(isBreakerOpen([])).toBe(false);
  });
});

describe("decideCapacity", () => {
  const open = { startedToday: 5, limit: 40, paused: false, recentPlans: [] as { status: string; session_id: string }[] };

  it("is open below the maximum", () => {
    expect(decideCapacity(open)).toEqual({ open: true, reason: null, startedToday: 5, limit: 40 });
  });

  it("closes at the maximum, not one book later", () => {
    expect(decideCapacity({ ...open, startedToday: 39 }).open).toBe(true);
    expect(decideCapacity({ ...open, startedToday: 40 })).toMatchObject({ open: false, reason: "daily" });
    expect(decideCapacity({ ...open, startedToday: 41 })).toMatchObject({ open: false, reason: "daily" });
  });

  it("has no maximum when the limit is off", () => {
    expect(decideCapacity({ ...open, limit: null, startedToday: 5000 }).open).toBe(true);
  });

  it("is closed by hand, whatever else is true", () => {
    expect(decideCapacity({ ...open, paused: true })).toMatchObject({ open: false, reason: "paused" });
    expect(decideCapacity({ ...open, paused: true, limit: null })).toMatchObject({ open: false, reason: "paused" });
  });

  it("is closed by the breaker, which says more than the daily maximum", () => {
    const failing = [plan("failed", "a"), plan("failed", "b"), plan("failed", "c")];
    expect(decideCapacity({ ...open, recentPlans: failing })).toMatchObject({ open: false, reason: "failing" });
    expect(decideCapacity({ ...open, startedToday: 99, recentPlans: failing })).toMatchObject({ reason: "failing" });
  });
});

// A stand-in for the database: counts per table and status, and the newest books of the failure window.
function fakeDb(opts: { paid?: number; pending?: number; plans?: { status: string; session_id: string }[]; fail?: boolean }) {
  const filters: Record<string, unknown>[] = [];
  const db = {
    from(table: string) {
      const f: Record<string, unknown> = { table };
      filters.push(f);
      const chain = {
        select: (_cols: string, o?: { count?: string }) => {
          f.head = !!o;
          return chain;
        },
        eq: (col: string, v: unknown) => {
          f[col] = v;
          return chain;
        },
        gte: (col: string, v: unknown) => {
          f[`gte:${col}`] = v;
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        then: (resolve: (v: unknown) => void) => {
          if (opts.fail) return resolve({ data: null, count: null, error: { message: "boom" } });
          if (table === "payments") return resolve({ data: null, count: f.status === "succeeded" ? (opts.paid ?? 0) : (opts.pending ?? 0), error: null });
          return resolve({ data: opts.plans ?? [], error: null });
        },
      };
      return chain;
    },
  };
  return { db: db as never, filters };
}

describe("loadCapacity", () => {
  beforeEach(() => resetCapacityCache());
  const now = new Date("2026-11-23T12:00:00Z");

  it("adds paid books and the ones being paid for right now", async () => {
    const { db } = fakeDb({ paid: 30, pending: 10 });
    expect(await loadCapacity(db, { now, env: {} })).toMatchObject({ open: false, reason: "daily", startedToday: 40, limit: 40 });
  });

  it("counts since Dutch midnight, and holds pending orders for half an hour only", async () => {
    const { db, filters } = fakeDb({ paid: 1, pending: 1 });
    await loadCapacity(db, { now, env: {} });
    const paid = filters.find((f) => f.table === "payments" && f.status === "succeeded")!;
    const pending = filters.find((f) => f.table === "payments" && f.status === "pending")!;
    expect(paid["gte:created_at"]).toBe("2026-11-22T23:00:00.000Z");
    expect(pending["gte:created_at"]).toBe("2026-11-23T11:30:00.000Z");
  });

  it("does not let a pending order from before midnight hold a place today", async () => {
    const { db, filters } = fakeDb({});
    await loadCapacity(db, { now: new Date("2026-11-22T23:10:00Z"), env: {} });
    const pending = filters.find((f) => f.table === "payments" && f.status === "pending")!;
    expect(pending["gte:created_at"]).toBe("2026-11-22T23:00:00.000Z");
  });

  it("closes on the breaker", async () => {
    const { db } = fakeDb({ plans: [plan("failed", "a"), plan("failed", "b"), plan("failed", "c")] });
    expect(await loadCapacity(db, { now, env: {} })).toMatchObject({ open: false, reason: "failing" });
  });

  it("answers a manual pause without reading anything", async () => {
    const { db, filters } = fakeDb({});
    expect(await loadCapacity(db, { now, env: { WINDOW_CHECKOUT_PAUSED: "1" } })).toMatchObject({ open: false, reason: "paused" });
    expect(filters).toHaveLength(0);
  });

  it("fails open when the database cannot be read, and logs it", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = fakeDb({ fail: true });
    expect(await loadCapacity(db, { now, env: {} })).toMatchObject({ open: true, reason: null });
    expect(err.mock.calls[0][0]).toContain("capacity_check_failed");
    err.mockRestore();
  });

  it("reuses a recent answer when allowed, and reads fresh otherwise", async () => {
    const first = fakeDb({ paid: 1 });
    await loadCapacity(first.db, { now, env: {}, maxAgeMs: 15_000 });
    const second = fakeDb({ paid: 99 });
    expect((await loadCapacity(second.db, { now: new Date(now.getTime() + 5_000), env: {}, maxAgeMs: 15_000 })).startedToday).toBe(1);
    expect(second.filters).toHaveLength(0);
    expect((await loadCapacity(second.db, { now: new Date(now.getTime() + 5_000), env: {} })).open).toBe(false);
  });
});
