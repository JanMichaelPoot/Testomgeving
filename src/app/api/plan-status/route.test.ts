import { beforeEach, describe, expect, it, vi } from "vitest";

// The waiting screen asks this endpoint how far the book has come. A generation the platform has stopped must not read as "pending" for ever.

let row: { status: string; progress_stage: string | null; progress_meta: unknown; created_at: string } | null = null;

vi.mock("@/lib/session", () => ({ getSessionId: vi.fn(async () => "session-1") }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn(() => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: () => Promise.resolve({ data: row, error: null }),
    };
    return { from: () => chain };
  }),
}));

import { GET } from "./route";
import { PENDING_STALE_MS } from "@/lib/progressStage";

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

beforeEach(() => {
  row = null;
});

describe("GET /api/plan-status", () => {
  it("reports a book that is being made, with its stage and how long it has been going", async () => {
    row = { status: "pending", progress_stage: "researched", progress_meta: { ideas: 7, places: 17 }, created_at: ago(60_000) };
    const body = await (await GET()).json();
    expect(body.status).toBe("pending");
    expect(body.stage).toBe("researched");
    expect(body.meta).toEqual({ ideas: 7, places: 17 });
    expect(body.elapsedMs).toBeGreaterThanOrEqual(59_000);
  });

  it("never sends the cost of the book or a mail error to the browser", async () => {
    row = { status: "pending", progress_stage: "written", progress_meta: { ideas: 7, places: 17, email_error: "x", cost: { usd: 0.4, capUsd: 0.4, skipped: [], breakdown: {} } }, created_at: ago(60_000) };
    const body = await (await GET()).json();
    expect(body.meta).toEqual({ ideas: 7, places: 17 });
  });

  it("keeps a slow generation 'pending' right up to the point where the platform must have stopped it", async () => {
    row = { status: "pending", progress_stage: "researched", progress_meta: null, created_at: ago(PENDING_STALE_MS - 20_000) };
    expect((await (await GET()).json()).status).toBe("pending");
  });

  it("calls a pending generation older than the function ceiling 'failed', so the screen loads the page again instead of counting on for ever", async () => {
    // The order of 12 Nov 2026: stuck at "researched" after 364 s.
    row = { status: "pending", progress_stage: "researched", progress_meta: { ideas: 7, places: 17 }, created_at: ago(364_000) };
    const body = await (await GET()).json();
    expect(body.status).toBe("failed");
    // What was reached is still reported (it says where it died).
    expect(body.stage).toBe("researched");
  });

  it("passes a ready and an already failed book through, and says 'unknown' without a row", async () => {
    row = { status: "ready", progress_stage: "rendered", progress_meta: null, created_at: ago(500_000) };
    expect((await (await GET()).json()).status).toBe("ready");
    row = { status: "failed", progress_stage: null, progress_meta: null, created_at: ago(10_000) };
    expect((await (await GET()).json()).status).toBe("failed");
    row = null;
    expect((await (await GET()).json()).status).toBe("unknown");
  });
});
