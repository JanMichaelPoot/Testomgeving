import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeAnswers } from "@/app/intake/actions";
import { computeCharacterProfile } from "@/lib/characterProfile";
import { bookHardCap, createCostLedger } from "@/lib/claude/costLedger";
import { coverageEnabled } from "@/lib/knowledgeFlags";

// No idea without a real place (Jan, 14 Nov 2026): "all options in the book must have real, fitting, concrete places; if not, the option may not be shown, find
// another one that does, even in a somewhat wider area". The model and the research are replaced; nothing here costs anything.
const create = vi.fn();
vi.mock("@/lib/anthropic", () => ({ anthropic: { messages: { create: (...a: unknown[]) => create(...a) } }, CLAUDE_MODEL: "test-model" }));

const researchSeeds = vi.fn();
vi.mock("@/lib/claude/localResearch", async (orig) => ({
  ...(await orig<typeof import("@/lib/claude/localResearch")>()),
  researchSeeds: (...a: unknown[]) => researchSeeds(...a),
}));

import { MIN_SEEDS, generateIdeaBookFromSeeds } from "@/lib/claude/generateFromSeeds";

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
const seedCountIn = (args: { messages?: { content?: unknown }[] }) => Number(/Idea (\d+) is the wildcard/.exec(String(args.messages?.[0]?.content ?? ""))?.[1] ?? 7);
const layerFor = (n: number) => ({ feels_like: `Koel ${n}. Stil.`, sizes: [], next_step: `Doe het ${n}.` });

/**
 * Places exist for the activities of the first selection except `without`, and for nothing that is tried later; online providers exist for nothing.
 * The first call of the research is the selection of the book, so its activities are the ones that "have places".
 */
const placesOnlyForTheFirstSelection = (without: string[] = ["kralen-rijgen"], opts: { cost?: number } = {}) => {
  const first = new Set<string>();
  researchSeeds.mockImplementation(async (o: unknown) => {
    if (first.size === 0) for (const id of ids(o)) first.add(id);
    (o as { ledger?: { add: (kind: string, usage: unknown) => void } }).ledger?.add("standard", { server_tool_use: { web_search_requests: Math.round((opts.cost ?? 0.01) * 100) } });
    return {
      byActivity: new Map(ids(o).map((id) => [id, { activityId: id, source: "search", options: modeOf(o) === "online" || without.includes(id) || !first.has(id) ? [] : [option(id)] }])),
      stats: stats(o),
    };
  });
};
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

describe("the switch and the ceiling", () => {
  it("is on unless it is switched off on purpose", () => {
    expect(coverageEnabled("")).toBe(true);
    expect(coverageEnabled("1")).toBe(true);
    for (const off of ["0", "false", "off", "No"]) expect(coverageEnabled(off)).toBe(false);
  });

  it("has a hard ceiling of USD 0.80 by default, set by WINDOW_BOOK_HARD_CAP, off with 0 or off", () => {
    expect(bookHardCap({})).toBe(0.8);
    expect(bookHardCap({ WINDOW_BOOK_HARD_CAP: "1.2" })).toBe(1.2);
    expect(bookHardCap({ WINDOW_BOOK_HARD_CAP: "off" })).toBeNull();
    expect(bookHardCap({ WINDOW_BOOK_HARD_CAP: "nonsense" })).toBe(0.8);
  });

  it("lets the rounds that make sure every idea has a place pass the soft cap, up to the ceiling, and never lets the soft cap be stricter than it", () => {
    const l = createCostLedger({ capUsd: 0.4, hardCapUsd: 0.8 });
    l.add("standard", { server_tool_use: { web_search_requests: 25 } }); // 0.25 spent
    expect(l.canAfford("broad")).toBe(false); // 0.25 + 0.09 + 0.11 > 0.40
    expect(l.canAffordCoverage("broad")).toBe(true); // 0.45 <= 0.80
    l.add("broad", { server_tool_use: { web_search_requests: 40 } }); // 0.65 spent
    expect(l.canAffordCoverage("standard")).toBe(false); // 0.65 + 0.075 + 0.11 > 0.80
    expect(createCostLedger({ capUsd: 0.5, hardCapUsd: 0.3 }).canAffordCoverage("standard")).toBe(true);
    expect(createCostLedger({ capUsd: null }).canAffordCoverage("standard")).toBe(true);
  });
});

describe("an idea without a real place is replaced, not shown", () => {
  it("replaces a choice of the person's own that has no place by a related activity that has one, and says so to the writer", async () => {
    placesOnlyForTheFirstSelection(["kralen-rijgen"]);
    // The activities next to it do have a place: everything that is not a "first selection" activity finds one in this variant.
    const first = new Set<string>();
    researchSeeds.mockImplementation(async (o: unknown) => {
      if (first.size === 0) for (const id of ids(o)) first.add(id);
      return { byActivity: new Map(ids(o).map((id) => [id, { activityId: id, source: "search", options: modeOf(o) === "online" || id === "kralen-rijgen" ? [] : [option(id)] }])), stats: stats(o) };
    });
    const { book, report } = await run();
    expect(report.seeds.map((s) => s.activityId)).not.toContain("kralen-rijgen");
    const replacement = report.notes.find((n) => n.startsWith("coverage_replaced:kralen-rijgen>") || n.startsWith("replaced_pick:kralen-rijgen>"));
    expect(replacement).toBeTruthy();
    expect(report.options!.withOption).toBe(report.options!.ideas);
    expect([...book.ideas, book.wildcard].every((i) => (i.places?.length ?? 0) > 0)).toBe(true);
    const core = create.mock.calls.map((c) => c[0]).find((a) => a.tools[0].name === "create_idea_book");
    expect(String(core.messages[0].content)).toContain("Replaces their own choice");
  });

  it("does so also when the soft cost cap was reached long ago: these rounds are held to the hard ceiling", async () => {
    // Every research call costs USD 0.45, so the first one already passes the soft cap (0.40) and every optional round is skipped.
    const first = new Set<string>();
    researchSeeds.mockImplementation(async (o: unknown) => {
      if (first.size === 0) for (const id of ids(o)) first.add(id);
      (o as { ledger?: { add: (kind: string, usage: unknown) => void } }).ledger?.add("standard", { server_tool_use: { web_search_requests: first.size > 0 && researchSeeds.mock.calls.length === 1 ? 45 : 1 } });
      return { byActivity: new Map(ids(o).map((id) => [id, { activityId: id, source: "search", options: modeOf(o) === "online" || id === "kralen-rijgen" ? [] : [option(id)] }])), stats: stats(o) };
    });
    const { report } = await run();
    expect(report.cost!.skipped.length).toBeGreaterThan(0); // the optional rounds were skipped for the soft cap
    expect(report.seeds.map((s) => s.activityId)).not.toContain("kralen-rijgen");
    expect(report.options!.withOption).toBe(report.options!.ideas);
    expect(report.cost!.usd).toBeGreaterThan(0.4);
  });

  it("stops at the hard ceiling: with no room left no coverage round starts, and the book says it is incomplete", async () => {
    vi.stubEnv("WINDOW_BOOK_COST_CAP", "0.40");
    vi.stubEnv("WINDOW_BOOK_HARD_CAP", "0.40");
    placesOnlyForTheFirstSelection(["kralen-rijgen"], { cost: 0.3 });
    const { report } = await run();
    expect(researchCalls()).toHaveLength(1);
    expect(report.notes).not.toEqual(expect.arrayContaining([expect.stringMatching(/^coverage_replaced:/)]));
    expect(report.notes).toContain("dropped_no_option:kralen-rijgen"); // nothing could be tried, so the idea is left out of the book
  });
});

describe("an idea that cannot be replaced is left out", () => {
  it("leaves it out of the book, which is written for one idea fewer", async () => {
    placesOnlyForTheFirstSelection(["kralen-rijgen"]);
    const { book, report } = await run();
    expect(report.notes).toContain("dropped_no_option:kralen-rijgen");
    expect(report.seeds.map((s) => s.activityId)).not.toContain("kralen-rijgen");
    expect(report.seeds).toHaveLength(6);
    expect(book.ideas).toHaveLength(5);
    expect([...book.ideas, book.wildcard].every((i) => (i.places?.length ?? 0) > 0)).toBe(true);
    expect(report.notes).not.toContain("coverage_incomplete");
    // kept with the book (progress_meta.cost.coverage), so it can be read from the admin
    expect(report.cost!.coverage).toEqual({ replaced: 0, dropped: 1, incomplete: false });
  });

  it("never leaves out the wildcard and never goes below the fewest ideas; what stays without a place is reported", async () => {
    researchSeeds.mockImplementation(async (o: unknown) => ({ byActivity: new Map(ids(o).map((id) => [id, { activityId: id, source: "search", options: [] }])), stats: stats(o) }));
    const { report } = await run();
    expect(report.seeds.length).toBeGreaterThanOrEqual(MIN_SEEDS);
    expect(report.seeds.some((s) => s.direction === "wildcard")).toBe(true);
    expect(report.notes).toContain("coverage_incomplete");
  });

  it("is off with WINDOW_COVERAGE=0: the older rules apply and the choice of the person stays", async () => {
    vi.stubEnv("WINDOW_COVERAGE", "0");
    placesOnlyForTheFirstSelection(["kralen-rijgen"]);
    const { report } = await run();
    expect(report.seeds.map((s) => s.activityId)).toContain("kralen-rijgen");
    expect(report.notes.some((n) => n.startsWith("dropped_no_option:"))).toBe(false);
  });
});

describe("which activities are tried instead", () => {
  const candidatesOfTheFirstCoverageRound = () => {
    const calls = researchCalls();
    // the first call is the selection of the book; the next standard call (not online, not broad) is the coverage round
    return calls.slice(1).find((o) => modeOf(o) !== "online" && (o as { pass?: string }).pass !== "broad");
  };

  it("leaves out the activities that earlier research found nothing for near this place, and tries the ones it found something for first", async () => {
    placesOnlyForTheFirstSelection(["kralen-rijgen"]);
    await run();
    const learned = ids(candidatesOfTheFirstCoverageRound());
    expect(learned.length).toBeGreaterThan(1);

    researchSeeds.mockReset();
    placesOnlyForTheFirstSelection(["kralen-rijgen"]);
    await run({ quietSupply: learned });
    const afterQuiet = candidatesOfTheFirstCoverageRound();
    for (const id of ids(afterQuiet ?? { activityIds: [] })) expect(learned).not.toContain(id);

    researchSeeds.mockReset();
    placesOnlyForTheFirstSelection(["kralen-rijgen"]);
    const found = learned[learned.length - 1];
    await run({ foundSupply: [found] });
    expect(ids(candidatesOfTheFirstCoverageRound())[0]).toBe(found);
  });
});
