import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeAnswers } from "@/app/intake/actions";
import { computeCharacterProfile } from "@/lib/characterProfile";

// Search Engine 2.0 (Stap 200): the pool search against the old one, with the model and the research replaced (nothing here costs anything).
// Left over from the file this was made from, for the setup only: No idea without a real place (Jan, 14 Nov 2026): "all options in the book must have real, fitting, concrete places; if not, the option may not be shown, find
// another one that does, even in a somewhat wider area". The model and the research are replaced; nothing here costs anything.
const create = vi.fn();
vi.mock("@/lib/anthropic", () => ({ anthropic: { messages: { create: (...a: unknown[]) => create(...a) } }, CLAUDE_MODEL: "test-model" }));

const researchSeeds = vi.fn();
vi.mock("@/lib/claude/localResearch", async (orig) => ({
  ...(await orig<typeof import("@/lib/claude/localResearch")>()),
  researchSeeds: (...a: unknown[]) => researchSeeds(...a),
}));

import { generateIdeaBookFromSeeds } from "@/lib/claude/generateFromSeeds";
import { getActivity } from "@/lib/discovery/library";
import { engineInputFromIntake, runEngine } from "@/lib/discovery/engine";
import { fillFromReserve, reserveExclusions, reserveFrom } from "@/lib/claude/searchPlan";

const PICKS = ["pottenbakken", "kralen-rijgen", "high-tea", "modemuseum"];
const base: IntakeAnswers = {
  situation: "",
  purpose: "self",
  purposeFollowUp: "",
  ageCategory: "35-44",
  location: "Laren",
  searchDistance: "hour",
  freeTimePattern: "",
  practicalToWild: "either",
  timeAvailable: "halfday",
  budget: "100",
  effort: "some",
  solutionTypes: ["activity"],
  mustHaves: "",
  preferences: "",
  company: ["partner"],
  personalReflection: "",
  intakeVariant: "associations",
  intakeFlow: "images2",
  associations: ["place-still-water", "moment-stillness"],
  interests: PICKS,
  interestDomains: ["creative"],
};

const entry = (n: number) => ({
  title: `Idee ${n}`,
  intro: "Een zin.",
  why_it_fits: "Omdat.",
  details: ["Stap één.", "Stap twee."],
  first_action: "Doe dit.",
  practical: { estimated_cost: "€10", duration: "1 uur", difficulty: "easy", preparation: "" },
  location: null,
  requirements: [],
});
const toolUse = (name: string, input: unknown) => ({ content: [{ type: "tool_use", name, input }], usage: {} });
// The name says what the place offers, so it passes the check that an option is about its activity (optionRelevance.ts).
const option = (id: string, city = "Laren") => ({ name: `${id.replace(/-/g, " ")} atelier`, city, url: null, note: id.replace(/-/g, " "), until: null, rating: { score: 4.6, scale: 5, reviews: 120, source: "Google" } });
const ids = (opts: unknown) => (opts as { activityIds: string[] }).activityIds;
const modeOf = (opts: unknown) => (opts as { mode?: string }).mode;
const stats = (opts: unknown) => ({ cached: 0, searched: ids(opts).length, failed: 0, dropped: 0, ms: 1 });
/** How many ideas the writer is asked for: the book is made for as many seeds as are left, so the model's answer follows the prompt. */
const seedCountIn = (args: { messages?: { content?: unknown }[] }) => Number(/Idea (\d+) is the wildcard/.exec(String(args.messages?.[0]?.content ?? ""))?.[1] ?? 5);
const layerFor = (n: number) => ({ feels_like: `Koel ${n}. Stil.`, sizes: [], next_step: `Doe het ${n}.` });

const run = (extra: Record<string, unknown> = {}) => generateIdeaBookFromSeeds(base, "nl", computeCharacterProfile(base), { sessionId: "options-test", ...extra });
const researchCalls = () => researchSeeds.mock.calls.map((c) => c[0]);

beforeEach(() => {
  create.mockReset();
  researchSeeds.mockReset();
  vi.stubEnv("REQUIRE_CONCRETE_OPTIONS", "1");
  vi.stubEnv("WINDOW_COVERAGE", "1");
  create.mockImplementation(async (args: { tools: { name: string }[]; messages: { content: unknown }[] }) => {
    const n = seedCountIn(args);
    return args.tools[0].name === "create_layers"
      ? toolUse("create_layers", { ideas: Array.from({ length: n }, (_, i) => layerFor(i + 1)) })
      : toolUse("create_idea_book", { profile_summary: "S.", must_haves: [], preferences: [], ideas: Array.from({ length: n - 1 }, (_, i) => entry(i + 1)), wildcard: entry(n) });
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-25T10:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});


/** Every activity has a real place, except those named; every call of the research is recorded and "pays" like a round of the real one. */
const researchWithout = (without: (ids: string[], call: number) => string[] = () => []) => {
  let call = 0;
  researchSeeds.mockImplementation(async (o: unknown) => {
    call += 1;
    const lacking = new Set(without(ids(o), call));
    (o as { ledger?: { add: (kind: string, usage: unknown) => void } }).ledger?.add(modeOf(o) === "online" ? "online" : (o as { pass?: string }).pass === "broad" ? "broad" : "standard", { server_tool_use: { web_search_requests: 5 } });
    return {
      byActivity: new Map(ids(o).map((id) => [id, { activityId: id, source: "search", options: modeOf(o) === "online" || lacking.has(id) ? [] : [option(id)] }])),
      stats: { ...stats(o), checked: ids(o).length },
    };
  });
};

/** The activity of the book (as the pipeline selects it for this intake) that the reserve can replace: the one whose swap the fill accepts. */
const swappableVictim = () => {
  const input = engineInputFromIntake(base, { seed: "options-test", month: 10, exclude: [], quietSupply: [] });
  const primary = runEngine(input).seeds;
  const reserve = reserveFrom(primary, runEngine(engineInputFromIntake(base, { seed: "options-test", month: 10, exclude: reserveExclusions(primary), quietSupply: [] })).seeds);
  const ownPicks = new Set<string>();
  for (const victim of primary) {
    const r = fillFromReserve({
      seeds: primary,
      reserve,
      ownPicks,
      domainOf: (id) => getActivity(id)?.domain,
      hasOption: (x, book) => (x === victim ? false : book.includes(x) ? true : reserve.includes(x)),
    });
    if (r.swaps.length === 1) return { victim: victim.activityId, replacement: r.swaps[0].in };
  }
  throw new Error("no idea of this book can be swapped for a reserve idea: the test intake needs another seed");
};
const roundsOf = () => researchCalls().filter((c) => modeOf(c) === undefined || modeOf(c) === "online").length;

describe("the pool search (WINDOW_SEARCH_V2)", () => {
  it("is off unless it is switched on, and the book is then researched as before", async () => {
    researchWithout();
    const { report } = await run();
    expect(report.cost!.search!.engine).toBe("v1");
    expect(report.cost!.search!.reserve).toEqual({ researched: 0, used: 0 });
    expect(researchCalls()[0].activityIds.length).toBeLessThanOrEqual(6);
  });

  it("researches the five ideas and a reserve in one go, and presents the five", async () => {
    vi.stubEnv("WINDOW_SEARCH_V2", "1");
    researchWithout();
    const { book, report } = await run();
    const first = researchCalls()[0].activityIds as string[];
    expect(first.length).toBeGreaterThan(report.seeds.length + 2);
    expect(report.seeds).toHaveLength(5);
    expect(book.ideas.length + 1).toBe(5);
    expect(report.cost!.search).toMatchObject({ engine: "v2", fallbackRounds: 0, reserve: { used: 0 } });
    expect(report.cost!.search!.reserve.researched).toBeGreaterThanOrEqual(3);
    // every idea has its place, and the places counted are those of the five (not of the reserve)
    expect(report.cost!.search!.optionsPerIdea).toHaveLength(5);
    expect(report.cost!.search!.presentedOptions).toBeGreaterThanOrEqual(5);
  });

  it("swaps an idea without a place for a reserve idea instead of searching again: fewer rounds than the old search for the same answers", async () => {
    const { victim, replacement } = swappableVictim();
    const lackingSecond = (_all: string[], call: number) => (call === 1 ? [victim] : []);
    researchWithout(lackingSecond);
    const old = await run();
    const oldRounds = roundsOf();
    const oldLacking = old.report.notes.filter((n) => n.startsWith("coverage_replaced") || n.startsWith("replaced_") || n.startsWith("broadened_search")).length;

    researchCalls().length = 0;
    researchSeeds.mockReset();
    vi.stubEnv("WINDOW_SEARCH_V2", "1");
    researchWithout(lackingSecond);
    const fresh = await run();
    expect(fresh.report.notes).toContain(`reserve_swapped:${victim}>${replacement}`);
    expect(fresh.report.cost!.search).toMatchObject({ engine: "v2", reserve: { used: 1 } });
    // no round after the first one was needed
    expect(fresh.report.cost!.search!.fallbackRounds).toBe(0);
    expect(roundsOf()).toBeLessThan(oldRounds);
    expect(oldLacking).toBeGreaterThan(0);
    // and every idea of the book has its place
    expect([...fresh.book.ideas, fresh.book.wildcard].every((i) => (i.places?.length ?? 0) > 0)).toBe(true);
  });

  it("falls back to the rounds that exist when the reserve has nothing either, and still gives every idea a place", async () => {
    vi.stubEnv("WINDOW_SEARCH_V2", "1");
    // The first call finds nothing for the second idea and for the whole reserve; only the later, narrower calls find something for the new ideas.
    researchWithout((all, call) => (call === 1 ? [all[1], ...all.slice(5)] : []));
    const { report } = await run();
    expect(report.cost!.search!.fallbackRounds).toBeGreaterThan(0);
    expect(report.notes.some((n) => n.startsWith("reserve_swapped:"))).toBe(false);
    expect(report.options!.withOption).toBe(report.options!.ideas);
  });

  it("registers what every call did: model, tokens, searches, and what a presented option cost", async () => {
    vi.stubEnv("WINDOW_SEARCH_V2", "1");
    researchWithout();
    const { report } = await run();
    const cost = report.cost!;
    expect(cost.calls!.some((c) => c.kind === "standard" && c.searches === 5)).toBe(true);
    expect(cost.searches).toBeGreaterThanOrEqual(5);
    expect(cost.searchUsd).toBeCloseTo(cost.searches! * 0.01, 4);
    expect(cost.search!.sitesChecked).toBeGreaterThan(0);
    expect(cost.search!.usdPerOption).toBeCloseTo(cost.usd / cost.search!.presentedOptions, 3);
  });

  it("is not used when no idea needs a concrete option (REQUIRE_CONCRETE_OPTIONS=0)", async () => {
    vi.stubEnv("WINDOW_SEARCH_V2", "1");
    vi.stubEnv("REQUIRE_CONCRETE_OPTIONS", "0");
    researchWithout();
    const { report } = await run();
    expect(report.cost!.search!.engine).toBe("v1");
  });
});

/**
 * A free simulation of the two searches on the same supply: each activity has a real place near the person with the measured chance (40%: 60% of the standard answers in the
 * research cache were empty), a broad round finds one for 1 activity in 10 that the first found nothing for (the cache's 1 in 10), and every round is priced like the
 * measured ones (35 k tokens of results read back, 1.4 k output, a search is USD 0.01). It says how many paid rounds and how many dollars of research each search
 * needs for the same world, not what the web will do: the real comparison is scripts/compare-search.ts.
 */
describe("the two searches on the same simulated supply (free)", () => {
  const hash = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 100003, 7);
  const SESSIONS = 40;
  // Every search reads about 7 k tokens of results back (5 searches = the measured 35 k), a broad search about 10 k (the measured 35-55 k over four).
  const price = (searches: number, perSearch = 7_000) => ({ input_tokens: perSearch * searches, output_tokens: 1_400, server_tool_use: { web_search_requests: searches } });

  const simulate = async (v2: boolean, depth = 2) => {
    const out = { rounds: 0, usd: 0, complete: 0, books: 0, sessions: 0 };
    for (let n = 0; n < SESSIONS; n++) {
      researchSeeds.mockReset();
      let calls = 0;
      researchSeeds.mockImplementation(async (o: unknown) => {
        const opts = o as { activityIds: string[]; priorityIds?: string[]; pass?: string; mode?: string; ledger?: { add: (k: string, u: unknown, m?: string) => void } };
        calls += 1;
        const broad = opts.pass === "broad";
        const online = opts.mode === "online";
        const own = (opts.priorityIds ?? []).filter((id) => opts.activityIds.includes(id));
        const rest = opts.activityIds.length - own.length;
        const search = (kind: string, count: number, cap: number, per: number, tokens = 7_000) => {
          if (count > 0) opts.ledger?.add(kind, price(Math.min(cap, Math.max(2, Math.ceil(count * per))), tokens), "claude-haiku-4-5-20251001");
        };
        if (online) search("online", opts.activityIds.length, 4, 1);
        else if (broad) search("broad", opts.activityIds.length, 4, 2, 10_000);
        else {
          search("own", own.length, 4, 1.5);
          search("standard", rest, 7, 0.7);
        }
        // A call that has fewer searches than 0.7 per activity (the seven-search cap on a big pool) finds proportionally less: the chance of a real place falls with the searches each activity gets.
        const share = broad || online ? 1 : Math.min(1, Math.min(7, Math.max(2, Math.ceil(rest * 0.7))) / Math.max(1, Math.ceil(rest * 0.7)));
        const found = (id: string) => (online ? false : broad ? hash(`b:${id}:${n}`) % 100 < 10 : hash(`s:${id}:${n}`) % 1000 < 400 * (own.includes(id) ? 1 : share));
        return { byActivity: new Map(opts.activityIds.map((id) => [id, { activityId: id, source: "search", options: found(id) ? [option(id)] : [] }])), stats: { cached: 0, searched: opts.activityIds.length, failed: 0, dropped: 0, ms: 1, checked: opts.activityIds.length } };
      });
      vi.unstubAllEnvs();
      vi.stubEnv("REQUIRE_CONCRETE_OPTIONS", "1");
      vi.stubEnv("WINDOW_COVERAGE", "1");
      if (v2) {
        vi.stubEnv("WINDOW_SEARCH_V2", "1");
        vi.stubEnv("WINDOW_SEARCH_RESERVE", String(depth));
      }
      const { report } = await generateIdeaBookFromSeeds(base, "nl", computeCharacterProfile(base), { sessionId: `sim-${n}`, researchOnly: true });
      out.rounds += report.cost!.calls!.filter((c) => ["standard", "own", "broad", "online"].includes(c.kind)).length;
      out.usd += report.cost!.usd;
      out.books += 1;
      if (report.cost!.search!.optionsPerIdea.every((k) => k > 0)) out.complete += 1;
      out.sessions += calls;
    }
    return out;
  };

  it("needs fewer paid rounds and costs less research for the same world, with at least as many complete books", async () => {
    const old = await simulate(false);
    const depths = { 1: await simulate(true, 1), 2: await simulate(true, 2), 3: await simulate(true, 3) };
    (process as unknown as { getBuiltinModule: (m: string) => typeof import("node:fs") }).getBuiltinModule("node:fs").writeFileSync("scratch/sim-search.json", JSON.stringify({ old, depths }));
    const fresh = depths[2];
    expect(fresh.rounds).toBeLessThan(old.rounds);
    expect(fresh.complete).toBeGreaterThanOrEqual(old.complete);
    expect(fresh.usd).toBeLessThan(old.usd);
  }, 400_000);
});
