import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeAnswers } from "@/app/intake/actions";
import { computeCharacterProfile } from "@/lib/characterProfile";
import type { Seed } from "@/lib/discovery/engine";

// The model and the research are replaced; nothing here costs anything. This tests the two promises of
// "only realistic options": what is suggested fits the season of the day of asking, and an idea that needs
// somebody's offer is not kept when no real offer could be found.
const create = vi.fn();
vi.mock("@/lib/anthropic", () => ({ anthropic: { messages: { create: (...a: unknown[]) => create(...a) } }, CLAUDE_MODEL: "test-model" }));

const researchSeeds = vi.fn();
vi.mock("@/lib/claude/localResearch", async (orig) => ({
  ...(await orig<typeof import("@/lib/claude/localResearch")>()),
  researchSeeds: (...a: unknown[]) => researchSeeds(...a),
}));

import { generateIdeaBookFromSeeds, needsProvider, seedsWithoutSupply } from "@/lib/claude/generateFromSeeds";
import { getActivity } from "@/lib/discovery/library";

const intake: IntakeAnswers = {
  situation: "",
  purpose: "self",
  purposeFollowUp: "",
  ageCategory: "35-44",
  location: "Utrecht",
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
  associations: ["place-still-water", "moment-stillness"],
  interests: ["open-water", "schaatsen", "paddenstoelen"],
  interestDomains: ["nature"],
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

const withOptions = (id: string) => ({ activityId: id, source: "search", options: [{ name: `Aanbieder ${id}`, city: "Utrecht", url: null, note: "Proefles", until: null }] });
const withoutOptions = (id: string) => ({ activityId: id, source: "search", options: [] });

function answerAll() {
  create.mockImplementation(async (args: { tools: { name: string }[] }) =>
    args.tools[0].name === "create_layers"
      ? toolUse("create_layers", { ideas: [] })
      : toolUse("create_idea_book", { profile_summary: "S.", must_haves: [], preferences: [], ideas: [1, 2, 3, 4, 5, 6].map(entry), wildcard: entry(7) }),
  );
}

const run = () => generateIdeaBookFromSeeds(intake, "nl", computeCharacterProfile(intake), { sessionId: "season-test" });

beforeEach(() => {
  create.mockReset();
  researchSeeds.mockReset();
  answerAll();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const ids = (opts: unknown) => (opts as { activityIds: string[] }).activityIds;
const allSupplied = async (opts: unknown) => ({
  byActivity: new Map(ids(opts).map((id) => [id, withOptions(id)])),
  stats: { cached: 0, searched: ids(opts).length, failed: 0, dropped: 0, ms: 1 },
});

describe("the season of the day of asking", () => {
  it("never suggests an activity that is out of season, even one the person picked, and tells the writer the date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-15T10:00:00Z"));
    researchSeeds.mockImplementation(allSupplied);
    const { report } = await run();
    const chosen = report.seeds.map((s) => s.activityId);
    expect(chosen).not.toContain("open-water"); // June-September
    expect(chosen).not.toContain("paddenstoelen"); // September-November
    const core = create.mock.calls.map((c) => c[0]).find((a) => a.tools[0].name === "create_idea_book");
    expect(core.messages[0].content).toContain("Today is 15 januari 2026 (winter) (2026-01-15)");
    expect(core.system.replace(/\s+/g, " ")).toContain("Never write about what is out of season");
  });

  it("suggests the same activities in their own season", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-15T10:00:00Z"));
    researchSeeds.mockImplementation(allSupplied);
    const { report } = await run();
    const chosen = report.seeds.map((s) => s.activityId);
    expect(chosen).toContain("open-water");
    expect(chosen).not.toContain("schaatsen");
  });

  it("gives the research the same moment, so it asks for what is open now", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-25T10:00:00Z"));
    researchSeeds.mockImplementation(allSupplied);
    await run();
    expect((researchSeeds.mock.calls[0][0] as { now: Date }).now.toISOString()).toBe("2026-10-25T10:00:00.000Z");
  });
});

describe("an idea that needs somebody's offer but has none", () => {
  const seed = (activityId: string): Seed => ({ activityId, direction: "familiar", door: "natural", chain: [activityId], via: [], lead: null, alsoFormats: [], verify: [] });

  it("is recognised for paid, supervised or rare activities, and only when the research really ran", () => {
    const empty = new Map([
      ["pottenbakken", withoutOptions("pottenbakken")], // paid: needs a provider
      ["wandelen", withoutOptions("wandelen")], // free: nobody has to offer it
      ["schietles", withoutOptions("schietles")], // supervised
      ["karten", { activityId: "karten", source: "none", options: [] }], // research failed: not proof
      ["klootschieten", withoutOptions("klootschieten")], // free, but only exists in a few places: needs a provider in reach
    ]);
    const list = (...a: string[]) => seedsWithoutSupply(a.map(seed), empty as never).map((s) => s.activityId);
    expect(list("pottenbakken", "wandelen", "schietles", "karten")).toEqual(["pottenbakken", "schietles"]);
    expect(list("klootschieten")).toEqual(["klootschieten"]);
    expect(list("pottenbakken")).toEqual(["pottenbakken"]);
  });

  it("is replaced once: the engine is asked again without it, and only the new ones are researched", async () => {
    // First pass: nothing is found for any paid activity. Second pass: everything is found.
    let call = 0;
    researchSeeds.mockImplementation(async (opts: unknown) => {
      call++;
      const found = call > 1;
      const known = (opts as { known?: Map<string, unknown> }).known;
      return {
        byActivity: new Map(ids(opts).map((id) => [id, known?.get(id) ?? (found ? withOptions(id) : withoutOptions(id))])),
        stats: { cached: 0, searched: ids(opts).length, failed: 0, dropped: 0, ms: 1 },
      };
    });
    const first = (await run().then(() => researchSeeds.mock.calls[0][0])) as { activityIds: string[] };
    expect(researchSeeds).toHaveBeenCalledTimes(2);
    const second = researchSeeds.mock.calls[1][0] as { activityIds: string[]; known: Map<string, unknown> };
    // the first pass is handed along, so nothing researched twice
    expect([...second.known.keys()].sort()).toEqual([...first.activityIds].sort());
    expect(second.activityIds.join()).not.toBe(first.activityIds.join());
  });

  it("tries two replacement rounds at most, never a loop: the second only allows activities that need nobody's offer", async () => {
    researchSeeds.mockImplementation(async (opts: unknown) => ({
      byActivity: new Map(ids(opts).map((id) => [id, withoutOptions(id)])),
      stats: { cached: 0, searched: ids(opts).length, failed: 0, dropped: 0, ms: 1 },
    }));
    const { report } = await run();
    expect(researchSeeds).toHaveBeenCalledTimes(3); // the first research, the first replacement, the provider-free one
    // the last round can only pick activities that need no provider, so nothing is left without an offer
    const last = researchSeeds.mock.calls[2][0] as { activityIds: string[] };
    for (const id of last.activityIds) expect(needsProvider(getActivity(id)!), id).toBe(false);
    for (const s of report.seeds) expect(seedsWithoutSupply([s], new Map([[s.activityId, withoutOptions(s.activityId)]]) as never)).toEqual([]);
    expect(report.notes.some((n) => /^replaced_no_local_offer:/.test(n))).toBe(true);
  });

  it("tells the writer, for an idea that still has no provider, not to imply that a venue exists", async () => {
    researchSeeds.mockImplementation(async (opts: unknown) => ({
      byActivity: new Map(ids(opts).map((id) => [id, withoutOptions(id)])),
      stats: { cached: 0, searched: ids(opts).length, failed: 0, dropped: 0, ms: 1 },
    }));
    await run();
    // (in this run the free ideas have no options either: that wording is for free ones)
    const core = create.mock.calls.map((c) => c[0]).find((a) => a.tools[0].name === "create_idea_book");
    expect(core.messages[0].content).toContain("none verified: keep this idea's location null");
  });

  it("does not replace anything after a failed research pass", async () => {
    researchSeeds.mockImplementation(async (opts: unknown) => ({
      byActivity: new Map(ids(opts).map((id) => [id, { activityId: id, source: "none", options: [] }])),
      stats: { cached: 0, searched: 0, failed: ids(opts).length, dropped: 0, ms: 1 },
    }));
    await run();
    expect(researchSeeds).toHaveBeenCalledTimes(1);
  });
});
