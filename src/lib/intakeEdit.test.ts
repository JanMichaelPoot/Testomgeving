import { describe, expect, it } from "vitest";
import { isSessionLocked, loadEditableIntake, replaceIntake } from "@/lib/intakeEdit";
import type { StoredIntake } from "@/app/intake/actions";

// A tiny stand-in for the Supabase query builder: every chain ends in a configured result.
type Result = { data: unknown; error?: { message: string } | null };
function fakeSupabase(tables: Record<string, Result>, updates: { table: string; values: unknown }[] = []) {
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "order", "limit"]) chain[m] = () => chain;
    chain.maybeSingle = async () => ({ data: tables[table]?.data ?? null, error: null });
    chain.update = (values: unknown) => {
      updates.push({ table, values });
      return { eq: async () => ({ error: tables[`${table}:update`]?.error ?? null }) };
    };
    return chain;
  };
  return { from: builder } as never;
}

const stored = { situation: "x", locale: "nl" } as unknown as StoredIntake;

describe("isSessionLocked", () => {
  it("is open while there is neither a book nor a paid order", async () => {
    expect(await isSessionLocked(fakeSupabase({}), "s")).toBe(false);
  });
  it("is locked once a book is being made or ready", async () => {
    expect(await isSessionLocked(fakeSupabase({ window_plans: { data: { id: "p" } } }), "s")).toBe(true);
  });
  it("is locked once the order is paid", async () => {
    expect(await isSessionLocked(fakeSupabase({ payments: { data: { id: "o" } } }), "s")).toBe(true);
  });
});

describe("loadEditableIntake", () => {
  it("returns the stored answers while they can be changed", async () => {
    const supabase = fakeSupabase({ intake_answers: { data: { raw_json: stored } } });
    expect(await loadEditableIntake(supabase, "s")).toEqual(stored);
  });
  it("returns nothing for a locked session or when nothing is stored", async () => {
    expect(await loadEditableIntake(fakeSupabase({ intake_answers: { data: { raw_json: stored } }, window_plans: { data: { id: "p" } } }), "s")).toBeNull();
    expect(await loadEditableIntake(fakeSupabase({}), "s")).toBeNull();
  });
});

describe("replaceIntake", () => {
  it("updates the existing row in place", async () => {
    const updates: { table: string; values: unknown }[] = [];
    const ok = await replaceIntake(fakeSupabase({ intake_answers: { data: { id: "row-1" } } }, updates), "s", stored);
    expect(ok).toBe(true);
    expect(updates).toEqual([{ table: "intake_answers", values: { raw_json: { ...stored } } }]);
  });
  it("refuses and writes nothing once the session is locked", async () => {
    const updates: { table: string; values: unknown }[] = [];
    const ok = await replaceIntake(
      fakeSupabase({ intake_answers: { data: { id: "row-1" } }, payments: { data: { id: "o" } } }, updates),
      "s",
      stored,
    );
    expect(ok).toBe(false);
    expect(updates).toEqual([]);
  });
  it("refuses when there is nothing to replace", async () => {
    expect(await replaceIntake(fakeSupabase({}), "s", stored)).toBe(false);
  });
  it("throws when the database refuses the update", async () => {
    await expect(
      replaceIntake(fakeSupabase({ intake_answers: { data: { id: "row-1" } }, "intake_answers:update": { data: null, error: { message: "boom" } } }), "s", stored),
    ).rejects.toThrow("boom");
  });
});
