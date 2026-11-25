import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const planRow = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) =>
      table === "window_plans"
        ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => planRow() }) }) }) }
        : { upsert: (row: unknown, opts: unknown) => upsert(table, row, opts) },
  }),
}));

import { saveCheckin } from "./actions";
import { makeFollowUpToken } from "@/lib/followup/token";

const PLAN = "11111111-2222-3333-4444-555555555555";
const token = makeFollowUpToken("checkin", PLAN);

beforeEach(() => {
  upsert.mockReset();
  upsert.mockResolvedValue({ error: null });
  planRow.mockReset();
  planRow.mockResolvedValue({ data: { language: "nl" } });
});

describe("saveCheckin (Step 243)", () => {
  it("stores a plain answer without touching the sentence or the consent", async () => {
    expect(await saveCheckin(token, { answer: "planned" })).toEqual({ ok: true });
    const [table, row, opts] = upsert.mock.calls[0];
    expect(table).toBe("book_checkins");
    expect(opts).toEqual({ onConflict: "plan_id" });
    expect(row).toMatchObject({ plan_id: PLAN, answer: "planned", locale: "nl" });
    expect(row).not.toHaveProperty("comment");
    expect(row).toHaveProperty("quote_consent", false);
  });

  it("stores the sentence with consent for 'done'", async () => {
    await saveCheckin(token, { answer: "done", comment: " eerste les gehad ", quoteConsent: true });
    expect(upsert.mock.calls[0][1]).toMatchObject({ answer: "done", comment: "eerste les gehad", quote_consent: true });
  });

  it("never keeps consent for another answer", async () => {
    await saveCheckin(token, { answer: "not", comment: "geen tijd", quoteConsent: true });
    expect(upsert.mock.calls[0][1]).toMatchObject({ answer: "not", comment: "geen tijd", quote_consent: false });
  });

  it("refuses a token of another purpose, a forged one, or none", async () => {
    expect(await saveCheckin(makeFollowUpToken("unsub", PLAN), { answer: "done" })).toEqual({ ok: false });
    expect(await saveCheckin(`${PLAN}.forged`, { answer: "done" })).toEqual({ ok: false });
    expect(await saveCheckin("", { answer: "done" })).toEqual({ ok: false });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses an answer it does not know, and a book that is not ready", async () => {
    expect(await saveCheckin(token, { answer: "maybe" as never })).toEqual({ ok: false });
    planRow.mockResolvedValue({ data: null });
    expect(await saveCheckin(token, { answer: "done" })).toEqual({ ok: false });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("answers { ok: false } instead of throwing when the table is missing (migration 0032 not run)", async () => {
    upsert.mockResolvedValue({ error: { message: 'relation "book_checkins" does not exist' } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await saveCheckin(token, { answer: "done" })).toEqual({ ok: false });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
