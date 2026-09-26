import { beforeEach, describe, expect, it, vi } from "vitest";

// The cookie jar of the fake request; a Map stands in for next/headers.
const jar = new Map<string, string>();
const setCalls: { name: string; value: string; options: Record<string, unknown> }[] = [];
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      jar.set(name, value);
      setCalls.push({ name, value, options });
    },
    delete: (name: string) => jar.delete(name),
  }),
}));

import { DEVICE_COOKIE_NAME, hashDeviceId } from "@/lib/discovery/history";
import { disableDeviceMemory, enableDeviceMemory, loadShownBefore, recordShown } from "@/lib/discovery/historyStore";

interface Op {
  table: string;
  op: string;
  args: unknown[];
}

// Records every call on the query builder and answers reads from `reads`.
function fakeSupabase(reads: { own?: unknown; others?: unknown[] } = {}, failWith?: string) {
  const ops: Op[] = [];
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    const record = (op: string) => (...args: unknown[]) => {
      ops.push({ table, op, args });
      return chain;
    };
    for (const m of ["select", "eq", "neq", "gt", "lt", "order", "limit", "in"]) chain[m] = record(m);
    chain.maybeSingle = async () => ({ data: reads.own ?? null, error: failWith ? { message: failWith } : null });
    chain.upsert = (...args: unknown[]) => {
      ops.push({ table, op: "upsert", args });
      return Promise.resolve({ error: failWith ? { message: failWith } : null });
    };
    chain.update = (...args: unknown[]) => {
      ops.push({ table, op: "update", args });
      return { eq: async () => ({ error: failWith ? { message: failWith } : null }) };
    };
    chain.delete = (...args: unknown[]) => {
      ops.push({ table, op: "delete", args });
      return {
        eq: async (...a: unknown[]) => {
          ops.push({ table, op: "delete.eq", args: a });
          return { error: null };
        },
        lt: async (...a: unknown[]) => {
          ops.push({ table, op: "delete.lt", args: a });
          return { error: null };
        },
      };
    };
    // The list query awaits the chain itself.
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: reads.others ?? [], error: failWith ? { message: failWith } : null });
    return chain;
  };
  return { supabase: { from } as never, ops };
}

beforeEach(() => {
  jar.clear();
  setCalls.length = 0;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("enableDeviceMemory", () => {
  it("sets a first-party cookie for a year and ties the session to the hashed id", async () => {
    const { supabase, ops } = fakeSupabase();
    await enableDeviceMemory(supabase, "session-1");
    const id = jar.get(DEVICE_COOKIE_NAME)!;
    expect(id).toBeTruthy();
    expect(setCalls[0].options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 360 });
    const upsert = ops.find((o) => o.op === "upsert")!;
    expect(upsert.args[0]).toEqual({ session_id: "session-1", device_hash: hashDeviceId(id) });
    // Never the id itself in the database.
    expect(JSON.stringify(upsert.args)).not.toContain(id);
  });

  it("reuses the id of a device that opted in before", async () => {
    const { supabase } = fakeSupabase();
    await enableDeviceMemory(supabase, "s1");
    const first = jar.get(DEVICE_COOKIE_NAME);
    await enableDeviceMemory(supabase, "s2");
    expect(jar.get(DEVICE_COOKIE_NAME)).toBe(first);
    expect(setCalls).toHaveLength(1);
  });

  it("never throws when the table is missing", async () => {
    const { supabase } = fakeSupabase({}, 'relation "discovery_history" does not exist');
    await expect(enableDeviceMemory(supabase, "s")).resolves.toBeUndefined();
  });
});

describe("disableDeviceMemory", () => {
  it("deletes everything stored for the device and the cookie", async () => {
    const { supabase, ops } = fakeSupabase();
    await enableDeviceMemory(supabase, "s1");
    const id = jar.get(DEVICE_COOKIE_NAME)!;
    await disableDeviceMemory(supabase);
    expect(ops.find((o) => o.op === "delete.eq")?.args).toEqual(["device_hash", hashDeviceId(id)]);
    expect(jar.has(DEVICE_COOKIE_NAME)).toBe(false);
  });

  it("does nothing for a visitor who never opted in", async () => {
    const { supabase, ops } = fakeSupabase();
    await disableDeviceMemory(supabase);
    expect(ops).toEqual([]);
  });
});

describe("loadShownBefore", () => {
  it("is empty for a session whose device did not opt in", async () => {
    const { supabase } = fakeSupabase({ own: null });
    expect(await loadShownBefore(supabase, "s")).toEqual([]);
  });

  it("returns what the last two other books of the device showed, excluding this session", async () => {
    const { supabase, ops } = fakeSupabase({
      own: { device_hash: "abc" },
      others: [
        { activity_ids: ["a"], created_at: "2026-03-01T00:00:00Z" },
        { activity_ids: ["b"], created_at: "2026-02-01T00:00:00Z" },
        { activity_ids: ["c"], created_at: "2026-01-01T00:00:00Z" },
      ],
    });
    expect((await loadShownBefore(supabase, "this-one")).sort()).toEqual(["a", "b"]);
    expect(ops.find((o) => o.op === "neq")?.args).toEqual(["session_id", "this-one"]);
    expect(ops.some((o) => o.op === "gt" && o.args[0] === "created_at")).toBe(true);
  });

  it("falls back to no history when the read fails", async () => {
    const { supabase } = fakeSupabase({ own: { device_hash: "abc" } }, "boom");
    expect(await loadShownBefore(supabase, "s")).toEqual([]);
  });
});

describe("recordShown", () => {
  it("stores the distinct activities and purges expired rows", async () => {
    const { supabase, ops } = fakeSupabase();
    await recordShown(supabase, "s", ["a", "b", "a"]);
    expect(ops.find((o) => o.op === "update")?.args[0]).toEqual({ activity_ids: ["a", "b"] });
    expect(ops.filter((o) => o.op === "delete.lt")).toHaveLength(1);
  });

  it("writes nothing for a book without library activities", async () => {
    const { supabase, ops } = fakeSupabase();
    await recordShown(supabase, "s", []);
    expect(ops).toEqual([]);
  });
});
