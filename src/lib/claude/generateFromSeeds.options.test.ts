import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeAnswers } from "@/app/intake/actions";
import { computeCharacterProfile } from "@/lib/characterProfile";

// Every idea needs a concrete, real option (Jan, 31 Oct 2026): a place near the person, or failing that an online or national
// provider with a website, best rated first. The model and the research are replaced; nothing here costs anything.
const create = vi.fn();
vi.mock("@/lib/anthropic", () => ({ anthropic: { messages: { create: (...a: unknown[]) => create(...a) } }, CLAUDE_MODEL: "test-model" }));

const researchSeeds = vi.fn();
vi.mock("@/lib/claude/localResearch", async (orig) => ({
  ...(await orig<typeof import("@/lib/claude/localResearch")>()),
  researchSeeds: (...a: unknown[]) => researchSeeds(...a),
}));

import { generateIdeaBookFromSeeds, widerRadiusKm } from "@/lib/claude/generateFromSeeds";
import { buildOnlinePrompt, rankOptions } from "@/lib/claude/localResearch";
import { concreteOptionsRequired, knowledgeAnchorEnabled } from "@/lib/knowledgeFlags";

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
const option = (name: string, city = "Laren", score = 4.6) => ({ name, city, url: null, note: "Proefles", until: null, rating: { score, scale: 5, reviews: 120, source: "Google" } });
const ids = (opts: unknown) => (opts as { activityIds: string[] }).activityIds;
const modeOf = (opts: unknown) => (opts as { mode?: string }).mode;
const stats = (opts: unknown) => ({ cached: 0, searched: ids(opts).length, failed: 0, dropped: 0, ms: 1 });
const run = (intake: IntakeAnswers) => generateIdeaBookFromSeeds(intake, "nl", computeCharacterProfile(intake), { sessionId: "options-test" });

beforeEach(() => {
  create.mockReset();
  researchSeeds.mockReset();
  vi.stubEnv("REQUIRE_CONCRETE_OPTIONS", "1");
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
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the switches", () => {
  it("are on unless they are switched off on purpose", () => {
    expect(concreteOptionsRequired("")).toBe(true);
    expect(concreteOptionsRequired("")).toBe(true);
    expect(concreteOptionsRequired("0")).toBe(false);
    expect(concreteOptionsRequired("off")).toBe(false);
    expect(knowledgeAnchorEnabled("")).toBe(true);
    expect(knowledgeAnchorEnabled("1")).toBe(true);
    expect(knowledgeAnchorEnabled("0")).toBe(false);
    expect(knowledgeAnchorEnabled("false")).toBe(false);
  });
});

// Physical first, online last (Jan, 13 Nov 2026): the local search asks for places to go to; an idea with nothing near the person first gets twice the distance, and only
// then the online providers.
describe("physical first, online last", () => {
  const widerOf = (o: unknown) => (o as { searchDistanceKm?: number }).searchDistanceKm === 120;

  it("tries twice the distance for an idea with nothing near the person, and then needs no online provider for it", async () => {
    researchSeeds.mockImplementation(async (opts: unknown) => ({
      byActivity: new Map(
        ids(opts).map((id) => [id, { activityId: id, source: "search", options: modeOf(opts) === "online" ? [option(`Online ${id}`, "Online")] : id === "kralen-rijgen" && !widerOf(opts) ? [] : [option(`Lokaal ${id}`)] }]),
      ),
      stats: stats(opts),
    }));
    const { book, report } = await run(base);
    const calls = researchSeeds.mock.calls.map((c) => c[0]);
    const wide = calls.filter(widerOf);
    expect(wide.flatMap((o) => ids(o))).toContain("kralen-rijgen");
    expect(wide.flatMap((o) => ids(o))).not.toContain("high-tea");
    // found at the wider distance, so there is nothing left for the online pass
    expect(calls.filter((o) => modeOf(o) === "online").flatMap((o) => ids(o))).not.toContain("kralen-rijgen");
    expect(report.notes).toContain("widened_radius:kralen-rijgen");
    const kralen = [...book.ideas, book.wildcard].find((i) => i.activity_id === "kralen-rijgen");
    expect(kralen?.places?.map((p) => p.name)).toEqual(["Lokaal kralen-rijgen"]);
  });

  it("asks the online providers last: after the local search and the wider search found nothing", async () => {
    researchSeeds.mockImplementation(async (opts: unknown) => ({
      byActivity: new Map(
        ids(opts).map((id) => [id, { activityId: id, source: "search", options: modeOf(opts) === "online" ? [option(`Online ${id}`, "Online")] : id === "kralen-rijgen" ? [] : [option(`Lokaal ${id}`)] }]),
      ),
      stats: stats(opts),
    }));
    await run(base);
    const calls = researchSeeds.mock.calls.map((c) => c[0]);
    const firstWide = calls.findIndex((o) => widerOf(o) && ids(o).includes("kralen-rijgen"));
    const firstOnline = calls.findIndex((o) => modeOf(o) === "online" && ids(o).includes("kralen-rijgen"));
    expect(firstWide).toBeGreaterThanOrEqual(0);
    expect(firstOnline).toBeGreaterThan(firstWide);
    // only what still lacked an option goes to the online pass
    expect(calls.filter((o) => modeOf(o) === "online").flatMap((o) => ids(o))).not.toContain("high-tea");
  });

  it("asks for the wider distance only where the chosen distance can be widened", () => {
    expect(widerRadiusKm("hour", undefined)).toBe(120);
    expect(widerRadiusKm("city", undefined)).toBe(30);
    expect(widerRadiusKm("city", 25)).toBe(50);
    expect(widerRadiusKm("hour", 75)).toBe(150);
    expect(widerRadiusKm("hour", 100)).toBeNull();
    expect(widerRadiusKm("anywhere", undefined)).toBeNull();
  });
});

describe("an idea with nothing near the person", () => {
  it("gets the online pass for exactly the ideas that lack an option, and keeps what that finds", async () => {
    researchSeeds.mockImplementation(async (opts: unknown) => {
      const online = modeOf(opts) === "online";
      return {
        byActivity: new Map(
          ids(opts).map((id) => [id, { activityId: id, source: "search", options: online ? [option(`Online ${id}`, "Online")] : id === "kralen-rijgen" ? [] : [option(`Lokaal ${id}`)] }]),
        ),
        stats: stats(opts),
      };
    });
    const { book, report } = await run(base);
    const onlineCalls = researchSeeds.mock.calls.map((c) => c[0]).filter((o) => modeOf(o) === "online");
    expect(onlineCalls.length).toBeGreaterThan(0);
    // only what lacked an option was asked, and kralen-rijgen is one of those
    expect(onlineCalls.flatMap((o) => ids(o))).toContain("kralen-rijgen");
    expect(onlineCalls.flatMap((o) => ids(o))).not.toContain("high-tea");
    const kralen = [...book.ideas, book.wildcard].find((i) => i.activity_id === "kralen-rijgen");
    expect(kralen?.places?.map((p) => p.name)).toEqual(["Online kralen-rijgen"]);
    expect(report.options?.withOption).toBe(report.options?.ideas);
    expect(report.notes.some((n) => n.startsWith("no_option:"))).toBe(false);
  });

  it("still keeps the person's own choice when even the online pass finds nothing, and says so", async () => {
    researchSeeds.mockImplementation(async (opts: unknown) => ({
      byActivity: new Map(ids(opts).map((id) => [id, { activityId: id, source: "search", options: id === "kralen-rijgen" || modeOf(opts) === "online" ? [] : [option(`Lokaal ${id}`)] }])),
      stats: stats(opts),
    }));
    const { report } = await run(base);
    expect(report.seeds.map((s) => s.activityId)).toContain("kralen-rijgen");
    expect(report.notes).toContain("no_option:kralen-rijgen");
    expect(report.options!.withOption).toBeLessThan(report.options!.ideas);
  });

  it("tries to replace an idea of the engine's own that has no option at all, even a free one, and flags what stays without", async () => {
    // Nothing is found for anything except the picks: the engine looks for other ideas twice, finds none that does better, and says so.
    researchSeeds.mockImplementation(async (opts: unknown) => ({
      byActivity: new Map(ids(opts).map((id) => [id, { activityId: id, source: "search", options: PICKS.includes(id) && modeOf(opts) !== "online" ? [option(`Lokaal ${id}`)] : [] }])),
      stats: stats(opts),
    }));
    const { report } = await run(base);
    const extras = report.seeds.filter((s) => !PICKS.includes(s.activityId));
    expect(extras.length).toBeGreaterThan(0);
    // what the engine added by itself and could not support is flagged, never silently presented as having an option
    for (const s of extras) {
      // a curated combination with one of the picks is supplied by that pick's option (the providers of both halves count)
      if (s.hybrid && PICKS.includes(s.hybrid.partnerId)) continue;
      expect(report.notes, s.activityId).toContain(`no_option:${s.activityId}`);
    }
  });
});

describe("the online question", () => {
  it("asks for real providers anywhere in the Netherlands, ratings only when shown, and an empty answer when nothing is verifiable", () => {
    const prompt = buildOnlinePrompt(["kralen-rijgen", "magneetvissen"], "Laren", "nl", new Date("2026-10-25T10:00:00Z"));
    expect(prompt).toContain('id "kralen-rijgen"');
    expect(prompt).toContain("Netherlands");
    expect(prompt).toContain("Never estimate or");
    expect(prompt).toContain("empty options list");
    expect(prompt).toContain("Write the notes in Dutch");
  });
});

describe("high ratings first", () => {
  it("drops an option the reviews put under 4.0 as soon as a better one exists", () => {
    const o = (name: string, score: number, reviews: number) => ({ name, city: "X", url: null, note: "", until: null, rating: { score, scale: 5 as const, reviews, source: "Google" } });
    const ranked = rankOptions([o("Middling", 3.9, 400), o("Good", 4.5, 200), o("Fine", 4.2, 150)]);
    expect(ranked.map((x) => x.name)).toEqual(["Good", "Fine"]);
    // but when nothing reaches 4.0, the best of what there is stays
    expect(rankOptions([o("Only", 3.6, 300)]).map((x) => x.name)).toEqual(["Only"]);
  });
});

describe("research only (warming the cache while the buyer pays)", () => {
  const found = async (opts: unknown) => ({
    byActivity: new Map(ids(opts).map((id) => [id, { activityId: id, source: "search", options: [option(`Lokaal ${id}`)] }])),
    stats: stats(opts),
  });

  it("writes nothing and asks the same searches as the real generation", async () => {
    researchSeeds.mockImplementation(found);
    const warm = await generateIdeaBookFromSeeds(base, "nl", computeCharacterProfile(base), { sessionId: "options-test", researchOnly: true });
    expect(create).not.toHaveBeenCalled(); // no model call: nothing is written
    expect(warm.book).toBeNull();
    expect(warm.report.seeds.length).toBe(7);
    const warmCalls = researchSeeds.mock.calls.map((c) => JSON.stringify([ids(c[0]), modeOf(c[0])]));

    researchSeeds.mockClear();
    create.mockClear();
    const real = await run(base);
    expect(create).toHaveBeenCalled();
    const realCalls = researchSeeds.mock.calls.map((c) => JSON.stringify([ids(c[0]), modeOf(c[0])]));
    // The very same selection and the very same questions, so every answer is waiting in the cache when the book is written.
    expect(realCalls).toEqual(warmCalls);
    expect(real.report.seeds.map((s) => s.activityId)).toEqual(warm.report.seeds.map((s) => s.activityId));
  });
});
