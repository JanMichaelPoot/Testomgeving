import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const planRow = vi.fn();
const session = vi.fn();
vi.mock("@/lib/session", () => ({ getSessionId: () => session() }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) =>
      table === "window_plans"
        ? { select: () => ({ eq: () => ({ maybeSingle: () => planRow() }) }) }
        : { upsert: (row: unknown, opts: unknown) => upsert(table, row, opts) },
  }),
}));

import { saveBookFeedback } from "./bookFeedbackActions";

const PLAN = "11111111-2222-3333-4444-555555555555";

beforeEach(() => {
  upsert.mockReset();
  upsert.mockResolvedValue({ error: null });
  planRow.mockReset();
  planRow.mockResolvedValue({ data: { session_id: "sess-1" } });
  session.mockReset();
  session.mockResolvedValue("sess-1");
});

describe("saveBookFeedback (Step 241)", () => {
  it("stores a plain score without touching the sentence or the consent", async () => {
    expect(await saveBookFeedback(PLAN, "nl", { rating: 5 })).toEqual({ ok: true });
    const [table, row, opts] = upsert.mock.calls[0];
    expect(table).toBe("book_feedback");
    expect(opts).toEqual({ onConflict: "plan_id" });
    expect(row).toMatchObject({ plan_id: PLAN, rating: 5, locale: "nl" });
    expect(row).not.toHaveProperty("comment");
    expect(row).not.toHaveProperty("quote_consent");
  });

  it("stores the sentence and the consent together", async () => {
    await saveBookFeedback(PLAN, "en", { rating: 4, comment: " lovely ", quoteConsent: true });
    expect(upsert.mock.calls[0][1]).toMatchObject({ rating: 4, comment: "lovely", quote_consent: true, locale: "en" });
  });

  it("withdraws consent when the score drops below 4", async () => {
    await saveBookFeedback(PLAN, "nl", { rating: 2 });
    expect(upsert.mock.calls[0][1]).toMatchObject({ rating: 2, quote_consent: false });
  });

  it("refuses anyone who does not own the book", async () => {
    session.mockResolvedValue("someone-else");
    expect(await saveBookFeedback(PLAN, "nl", { rating: 5 })).toEqual({ ok: false });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses without a session, for an unknown book, a bad id or a bad score", async () => {
    session.mockResolvedValue(null);
    expect(await saveBookFeedback(PLAN, "nl", { rating: 5 })).toEqual({ ok: false });
    session.mockResolvedValue("sess-1");
    planRow.mockResolvedValue({ data: null });
    expect(await saveBookFeedback(PLAN, "nl", { rating: 5 })).toEqual({ ok: false });
    planRow.mockResolvedValue({ data: { session_id: "sess-1" } });
    expect(await saveBookFeedback("not-an-id", "nl", { rating: 5 })).toEqual({ ok: false });
    expect(await saveBookFeedback(PLAN, "nl", { rating: 7 })).toEqual({ ok: false });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("answers { ok: false } instead of throwing when the table is missing (migration 0031 not run)", async () => {
    upsert.mockResolvedValue({ error: { message: 'relation "book_feedback" does not exist' } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await saveBookFeedback(PLAN, "nl", { rating: 5 })).toEqual({ ok: false });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
