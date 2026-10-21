import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({ from: () => ({ insert: (row: unknown) => insert(row) }) }),
}));

import { submitTestFeedback } from "./feedbackActions";

const PLAN = "11111111-2222-3333-4444-555555555555";

beforeEach(() => {
  insert.mockReset();
  insert.mockResolvedValue({ error: null });
  process.env.NEXT_PUBLIC_TEST_FEEDBACK = "1";
});

describe("submitTestFeedback", () => {
  it("refuses when the questionnaire is switched off (as on Production)", async () => {
    process.env.NEXT_PUBLIC_TEST_FEEDBACK = "0";
    expect(await submitTestFeedback(PLAN, "nl", { flowScore: 3 })).toEqual({ ok: false });
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses an empty submission", async () => {
    expect(await submitTestFeedback(PLAN, "nl", {})).toEqual({ ok: false });
    expect(insert).not.toHaveBeenCalled();
  });

  it("stores the scores, the door and the free text", async () => {
    const res = await submitTestFeedback(PLAN, "nl", {
      flowScore: 4,
      profileScore: 5,
      doorsScore: 3,
      doorPick: 2,
      doorKind: "natural",
      wouldPay: "maybe",
      doubt: " de prijs ",
    });
    expect(res).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toEqual({
      plan_id: PLAN,
      flow_score: 4,
      profile_score: 5,
      doors_score: 3,
      door_pick: 2,
      door_kind: "natural",
      would_pay: "maybe",
      doubt: "de prijs",
      locale: "nl",
    });
  });

  it("keeps the older answers when migration 0020 has not been run (column missing), instead of losing them", async () => {
    insert.mockResolvedValueOnce({ error: { code: "42703", message: 'column "profile_score" does not exist' } }).mockResolvedValueOnce({ error: null });
    const res = await submitTestFeedback(PLAN, "en", { flowScore: 4, profileScore: 5, doubt: "slow" });
    expect(res).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[1][0]).toEqual({ plan_id: PLAN, flow_score: 4, would_pay: null, doubt: "slow", locale: "en" });
  });

  it("recognises the PostgREST shape of a missing column too (PGRST204), which is what a real insert returns", async () => {
    insert
      .mockResolvedValueOnce({ error: { code: "PGRST204", message: "Could not find the 'door_kind' column of 'test_feedback' in the schema cache" } })
      .mockResolvedValueOnce({ error: null });
    expect(await submitTestFeedback(PLAN, "nl", { doorPick: 2, doorKind: "natural", flowScore: 3 })).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[1][0]).not.toHaveProperty("door_kind");
  });

  it("reports a real failure", async () => {
    insert.mockResolvedValue({ error: { code: "XX000", message: "boom" } });
    expect(await submitTestFeedback(PLAN, "nl", { flowScore: 1 })).toEqual({ ok: false });
  });

  it("ignores a plan id that is not a uuid", async () => {
    await submitTestFeedback("not-an-id", "nl", { flowScore: 2 });
    expect((insert.mock.calls[0][0] as { plan_id: unknown }).plan_id).toBeNull();
  });
});
