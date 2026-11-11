import { afterEach, describe, expect, it, vi } from "vitest";

const { generate } = vi.hoisted(() => ({ generate: vi.fn(async () => ({ book: null, report: {} })) }));
vi.mock("@/lib/claude/generateFromSeeds", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/claude/generateFromSeeds")>();
  return { ...real, generateIdeaBookFromSeeds: generate };
});
vi.mock("@/lib/discovery/historyStore", () => ({ loadShownBefore: vi.fn(async () => ["knitting"]) }));

import { prewarmBookResearch, prewarmEnabled } from "@/lib/claude/prewarmResearch";

// Warming the research while the buyer pays: the same session, the same history, research only; skipped for the classic pipeline, when switched
// off and when anything goes wrong.

function fakeSupabase(rawJson: unknown) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) chain[m] = () => chain;
  chain.maybeSingle = async () => ({ data: rawJson === undefined ? null : { raw_json: rawJson } });
  return { from: () => chain } as never;
}

const engineProfile = { interests: ["yoga"], location: "Utrecht", locale: "nl", avoidActivityIds: ["pottery"], searchDistance: "city", intakeVariant: "associations", intakeFlow: "images2" };

afterEach(() => {
  vi.unstubAllEnvs();
  generate.mockClear();
});

describe("prewarmBookResearch", () => {
  it("is on unless it is switched off", () => {
    expect(prewarmEnabled({})).toBe(true);
    expect(prewarmEnabled({ PREWARM_RESEARCH: "1" })).toBe(true);
    for (const off of ["0", "false", "off", "No"]) expect(prewarmEnabled({ PREWARM_RESEARCH: off })).toBe(false);
  });

  it("runs the research of the same session with the same history, and nothing else", async () => {
    vi.stubEnv("PREWARM_RESEARCH", "1");
    const result = await prewarmBookResearch(fakeSupabase(engineProfile), "session-1");
    expect(result.started).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
    const [profile, locale, , opts] = generate.mock.calls[0] as unknown as [typeof engineProfile, string, unknown, { sessionId: string; history: string[]; researchOnly: boolean }];
    expect(profile.location).toBe("Utrecht");
    expect(locale).toBe("nl");
    expect(opts.sessionId).toBe("session-1");
    expect(opts.researchOnly).toBe(true);
    expect(opts.history.sort()).toEqual(["knitting", "pottery"]);
  });

  it("does nothing when it is switched off, when there is no intake, or for the classic pipeline", async () => {
    vi.stubEnv("PREWARM_RESEARCH", "0");
    expect((await prewarmBookResearch(fakeSupabase(engineProfile), "s")).started).toBe(false);
    vi.stubEnv("PREWARM_RESEARCH", "1");
    expect((await prewarmBookResearch(fakeSupabase(undefined), "s")).started).toBe(false);
    expect((await prewarmBookResearch(fakeSupabase({ interests: [], interestDomains: [], surpriseMe: false, locale: "nl" }), "s")).started).toBe(false);
    expect(generate).not.toHaveBeenCalled();
  });

  it("never throws: a failing search only means the real generation searches itself", async () => {
    vi.stubEnv("PREWARM_RESEARCH", "1");
    generate.mockRejectedValueOnce(new Error("search down"));
    await expect(prewarmBookResearch(fakeSupabase(engineProfile), "s")).resolves.toEqual({ started: false });
  });
});
