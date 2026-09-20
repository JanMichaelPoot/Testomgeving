import { describe, expect, it } from "vitest";
import { nextOrderNumber } from "./orderNumber";

function fakeSupabase(rpcResult: { data: string | null; error: { message: string } | null }) {
  return {
    rpc: () => Promise.resolve(rpcResult),
  } as never;
}

describe("nextOrderNumber", () => {
  it("returns the order number produced by the next_order_number() function", async () => {
    const supabase = fakeSupabase({ data: "WI-2026-000042", error: null });
    await expect(nextOrderNumber(supabase)).resolves.toBe("WI-2026-000042");
  });

  it("throws instead of silently returning an empty order number", async () => {
    const supabase = fakeSupabase({ data: null, error: null });
    await expect(nextOrderNumber(supabase)).rejects.toThrow();
  });

  it("surfaces the database error message when the RPC call fails", async () => {
    const supabase = fakeSupabase({ data: null, error: { message: "sequence exhausted" } });
    await expect(nextOrderNumber(supabase)).rejects.toThrow(/sequence exhausted/);
  });
});
