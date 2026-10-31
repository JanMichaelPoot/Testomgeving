import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeAnswers } from "@/app/intake/actions";
import { computeCharacterProfile } from "@/lib/characterProfile";

// The model and the research are replaced; nothing here costs anything. The promise tested (Stap 124): an activity the person
// chose themselves is never swapped for something else because no provider was found. It stays, honestly described.
const create = vi.fn();
vi.mock("@/lib/anthropic", () => ({ anthropic: { messages: { create: (...a: unknown[]) => create(...a) } }, CLAUDE_MODEL: "test-model" }));

const researchSeeds = vi.fn();
vi.mock("@/lib/claude/localResearch", async (orig) => ({
  ...(await orig<typeof import("@/lib/claude/localResearch")>()),
  researchSeeds: (...a: unknown[]) => researchSeeds(...a),
}));

import { explicitPickIds, generateIdeaBookFromSeeds, needsProvider } from "@/lib/claude/generateFromSeeds";
import { getActivity } from "@/lib/discovery/library";

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
const withOptions = (id: string) => ({ activityId: id, source: "search", options: [{ name: `Aanbieder ${id}`, city: "Laren", url: null, note: "Proefles", until: null }] });
const withoutOptions = (id: string) => ({ activityId: id, source: "search", options: [] });
const ids = (opts: unknown) => (opts as { activityIds: string[] }).activityIds;
const stats = (opts: unknown) => ({ cached: 0, searched: ids(opts).length, failed: 0, dropped: 0, ms: 1 });

const run = (intake: IntakeAnswers) => generateIdeaBookFromSeeds(intake, "nl", computeCharacterProfile(intake), { sessionId: "picks-test" });

beforeEach(() => {
  create.mockReset();
  researchSeeds.mockReset();
  create.mockImplementation(async (args: { tools: { name: string }[] }) =>
    args.tools[0].name === "create_layers"
      ? toolUse("create_layers", { ideas: [] })
      : toolUse("create_idea_book", { profile_summary: "S.", must_haves: [], preferences: [], ideas: [1, 2, 3, 4, 5, 6].map(entry), wildcard: entry(7) }),
  );
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-25T10:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("which activities count as the person's own choices", () => {
  it("are the interests of the two-page intake and of the card wizard, and not those derived from images", () => {
    expect(explicitPickIds({ interests: PICKS, intakeFlow: "images2", intakeVariant: "associations" })).toEqual(PICKS);
    expect(explicitPickIds({ interests: PICKS })).toEqual(PICKS); // the card wizard: no variant
    expect(explicitPickIds({ interests: PICKS, intakeVariant: "associations" })).toEqual([]); // derived from the images
    expect(explicitPickIds({ interests: ["pottenbakken", "pottenbakken", "no-such-activity"], intakeFlow: "images2" })).toEqual(["pottenbakken"]);
  });
});

describe("a chosen activity without a provider", () => {
  it("is researched with priority, so the research can give it its own, wider call", async () => {
    researchSeeds.mockImplementation(async (opts: unknown) => ({ byActivity: new Map(ids(opts).map((id) => [id, withOptions(id)])), stats: stats(opts) }));
    await run(base);
    expect((researchSeeds.mock.calls[0][0] as { priorityIds: string[] }).priorityIds).toEqual(PICKS);
  });

  it("stays in the book when the research finds nothing for it, while the engine's own extras are replaced", async () => {
    // With everything supplied, see which picks the engine puts in the book.
    researchSeeds.mockImplementation(async (opts: unknown) => ({ byActivity: new Map(ids(opts).map((id) => [id, withOptions(id)])), stats: stats(opts) }));
    const reference = await run(base);
    const picksInBook = reference.report.seeds.map((s) => s.activityId).filter((id) => PICKS.includes(id));
    expect(picksInBook.length).toBeGreaterThanOrEqual(2);

    // Now nothing is found anywhere. The picks must still be there.
    researchSeeds.mockReset();
    researchSeeds.mockImplementation(async (opts: unknown) => ({ byActivity: new Map(ids(opts).map((id) => [id, withoutOptions(id)])), stats: stats(opts) }));
    const { report } = await run(base);
    const ids2 = report.seeds.map((s) => s.activityId);
    for (const id of picksInBook) expect(ids2, id).toContain(id);
    for (const id of picksInBook.filter((p) => needsProvider(getActivity(p)!))) expect(report.notes, id).toContain(`pick_without_provider:${id}`);
    // what the engine added by itself and could not support is gone: nothing else in the book needs a provider
    for (const s of report.seeds) if (!PICKS.includes(s.activityId)) expect(needsProvider(getActivity(s.activityId)!), s.activityId).toBe(false);
  });

  it("is told to the writer as a keep-it-honestly instruction, not as 'find a replacement'", async () => {
    researchSeeds.mockImplementation(async (opts: unknown) => ({ byActivity: new Map(ids(opts).map((id) => [id, withoutOptions(id)])), stats: stats(opts) }));
    await run(base);
    const core = create.mock.calls.map((c) => c[0]).find((a) => a.tools[0].name === "create_idea_book");
    expect(core.messages[0].content).toContain("the person chose this activity themselves, so it stays");
  });

  it("keeps the activities that did have a provider when the last round swaps something else (no wholesale reshuffle)", async () => {
    // Supply only for the picks that need one: the engine's extras that need a provider have none and are replaced.
    researchSeeds.mockImplementation(async (opts: unknown) => ({
      byActivity: new Map(ids(opts).map((id) => [id, PICKS.includes(id) ? withOptions(id) : withoutOptions(id)])),
      stats: stats(opts),
    }));
    const { report } = await run(base);
    const reference = report.seeds.filter((s) => PICKS.includes(s.activityId)).map((s) => s.activityId);
    expect(reference.length).toBeGreaterThanOrEqual(2);
    expect(report.notes.some((n) => n.startsWith("pick_without_provider:"))).toBe(false);
  });
});

describe("an image-only intake keeps the old behaviour", () => {
  it("replaces an interest that was only derived from the images", async () => {
    const derived: IntakeAnswers = { ...base, intakeFlow: undefined };
    researchSeeds.mockImplementation(async (opts: unknown) => ({ byActivity: new Map(ids(opts).map((id) => [id, withoutOptions(id)])), stats: stats(opts) }));
    const { report } = await run(derived);
    expect(report.notes.some((n) => n.startsWith("pick_without_provider:"))).toBe(false);
    for (const s of report.seeds) expect(needsProvider(getActivity(s.activityId)!), s.activityId).toBe(false);
  });
});

describe("the guard counts picks, it does not pin an exact list", () => {
  it("accepts a replacement that swaps a pick without a provider for a pick with one", async () => {
    // Only high tea has a provider; every other thing that needs one has none. The engine may then swap kralen-rijgen for high tea.
    researchSeeds.mockImplementation(async (opts: unknown) => ({
      byActivity: new Map(ids(opts).map((id) => [id, id === "high-tea" ? withOptions(id) : withoutOptions(id)])),
      stats: stats(opts),
    }));
    const { report } = await run(base);
    // never fewer picks than the first selection had, and nothing unsupported left apart from the picks themselves
    expect(report.notes).not.toContain("replacement_refused_would_lose_pick");
    for (const s of report.seeds) {
      if (PICKS.includes(s.activityId)) continue;
      // a curated combination with high tea is supplied by high tea's provider (the providers of both halves count)
      if (s.hybrid?.partnerId === "high-tea") continue;
      expect(needsProvider(getActivity(s.activityId)!), s.activityId).toBe(false);
    }
  });
});


describe("a curated combination counts the providers of both halves", () => {
  const seedOf = (activityId: string, partnerId?: string) =>
    ({ activityId, direction: "unexpected", door: "unexpected", chain: [activityId], via: [], lead: null, alsoFormats: [], verify: [], ...(partnerId ? { hybrid: { partnerId, label: { nl: "x", en: "x" } } } : {}) }) as unknown as import("@/lib/discovery/engine").Seed;

  it("researches the partner activity as well", async () => {
    const { researchIds } = await import("@/lib/claude/generateFromSeeds");
    expect(researchIds([seedOf("buitenplaats", "high-tea"), seedOf("yoga")])).toEqual(["buitenplaats", "high-tea", "yoga"]);
    expect(researchIds([seedOf("buitenplaats", "no-such-activity")])).toEqual(["buitenplaats"]);
  });

  it("merges the options of both halves, own first, without doubles", async () => {
    const { seedResearch } = await import("@/lib/claude/generateFromSeeds");
    const opt = (name: string) => ({ name, city: "Laren", url: null, note: "", until: null, rating: null });
    const byActivity = new Map([
      ["buitenplaats", { activityId: "buitenplaats", source: "search" as const, options: [opt("Landgoed")] }],
      ["high-tea", { activityId: "high-tea", source: "search" as const, options: [opt("Theehuis"), opt("Landgoed")] }],
    ]);
    const merged = seedResearch(seedOf("buitenplaats", "high-tea"), byActivity);
    expect(merged?.options.map((o) => o.name)).toEqual(["Landgoed", "Theehuis"]);
    // a plain seed is untouched
    expect(seedResearch(seedOf("buitenplaats"), byActivity)).toBe(byActivity.get("buitenplaats"));
  });

  it("counts a combination as supplied when only the partner has a provider", async () => {
    const { seedsWithoutSupply } = await import("@/lib/claude/generateFromSeeds");
    const byActivity = new Map([
      ["buitenplaats", { activityId: "buitenplaats", source: "search" as const, options: [] }],
      ["high-tea", { activityId: "high-tea", source: "search" as const, options: [{ name: "Theehuis", city: "Laren", url: null, note: "", until: null, rating: null }] }],
    ]);
    expect(seedsWithoutSupply([seedOf("buitenplaats", "high-tea")], byActivity)).toHaveLength(0);
    expect(seedsWithoutSupply([seedOf("buitenplaats")], byActivity).length).toBeLessThanOrEqual(1);
  });
});
