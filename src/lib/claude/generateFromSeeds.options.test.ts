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
const passOf = (opts: unknown) => (opts as { pass?: string }).pass;
/**
 * Places exist only for the activities of the first selection, and kralen-rijgen (the person's own choice) has none anywhere: another idea that is
 * tried instead finds nothing physical either. Online providers exist for everything unless `online: false`.
 */
const mockOnlyTheFirstSelectionHasPlaces = ({ online = true }: { online?: boolean } = {}) => {
  const first = new Set<string>();
  researchSeeds.mockImplementation(async (opts: unknown) => {
    if (first.size === 0) for (const id of ids(opts)) first.add(id);
    const isOnline = modeOf(opts) === "online";
    return {
      byActivity: new Map(
        ids(opts).map((id) => [
          id,
          { activityId: id, source: "search", options: isOnline ? (online ? [option(`Online ${id}`, "Online")] : []) : id === "kralen-rijgen" || !first.has(id) ? [] : [option(`Lokaal ${id}`)] },
        ]),
      ),
      stats: stats(opts),
    };
  });
};
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

  it("asks the online providers last: after the local, the broad and the wider search found nothing, and after another idea was tried", async () => {
    mockOnlyTheFirstSelectionHasPlaces();
    await run(base);
    const calls = researchSeeds.mock.calls.map((c) => c[0]);
    const firstStandard = calls.findIndex((o) => !passOf(o) && modeOf(o) !== "online" && !widerOf(o) && ids(o).includes("kralen-rijgen"));
    const firstBroad = calls.findIndex((o) => passOf(o) === "broad" && !widerOf(o) && ids(o).includes("kralen-rijgen"));
    const firstWide = calls.findIndex((o) => widerOf(o) && ids(o).includes("kralen-rijgen"));
    const firstOnline = calls.findIndex((o) => modeOf(o) === "online" && ids(o).includes("kralen-rijgen"));
    expect(firstStandard).toBe(0);
    expect(firstBroad).toBeGreaterThan(firstStandard);
    expect(firstWide).toBeGreaterThan(firstBroad);
    expect(firstOnline).toBeGreaterThan(firstWide);
    // only what still lacked an option goes to the online pass
    expect(calls.filter((o) => modeOf(o) === "online").flatMap((o) => ids(o))).not.toContain("high-tea");
  });

  it("gives an idea with nothing a second, broader search at the same distance before it widens the distance", async () => {
    researchSeeds.mockImplementation(async (opts: unknown) => ({
      byActivity: new Map(
        ids(opts).map((id) => [id, { activityId: id, source: "search", options: id === "kralen-rijgen" && passOf(opts) !== "broad" ? [] : [option(`Lokaal ${id}`)] }]),
      ),
      stats: stats(opts),
    }));
    const { book, report } = await run(base);
    const calls = researchSeeds.mock.calls.map((c) => c[0]);
    expect(calls.filter((o) => passOf(o) === "broad").flatMap((o) => ids(o))).toEqual(["kralen-rijgen"]);
    expect(calls.filter(widerOf).flatMap((o) => ids(o))).not.toContain("kralen-rijgen");
    expect(report.notes).toContain("broadened_search:kralen-rijgen");
    const kralen = [...book.ideas, book.wildcard].find((i) => i.activity_id === "kralen-rijgen");
    expect(kralen?.places?.map((p) => p.name)).toEqual(["Lokaal kralen-rijgen"]);
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
  it("gets the online pass, as the very last resort, for exactly the ideas that lack an option, and keeps what that finds", async () => {
    mockOnlyTheFirstSelectionHasPlaces();
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

  it("replaces the person's own choice by a related activity that has a real place, and says so to the writer", async () => {
    // kralen-rijgen has nothing anywhere (not near, not wider, not online); the activities next to it do have a place.
    researchSeeds.mockImplementation(async (opts: unknown) => ({
      byActivity: new Map(ids(opts).map((id) => [id, { activityId: id, source: "search", options: id === "kralen-rijgen" ? [] : [option(`Lokaal ${id}`)] }])),
      stats: stats(opts),
    }));
    const { book, report } = await run(base);
    const replacement = report.notes.find((n) => n.startsWith("replaced_pick:kralen-rijgen>"));
    expect(replacement).toBeTruthy();
    const newId = replacement!.split(">")[1];
    expect(report.seeds.map((s) => s.activityId)).not.toContain("kralen-rijgen");
    expect(report.seeds.map((s) => s.activityId)).toContain(newId);
    const idea = [...book.ideas, book.wildcard].find((i) => i.activity_id === newId);
    expect(idea?.places?.map((p) => p.name)).toEqual([`Lokaal ${newId}`]);
    const core = create.mock.calls.map((c) => c[0]).find((a) => a.tools[0].name === "create_idea_book");
    expect(core.messages[0].content).toContain("Replaces their own choice");
    // nothing was asked online for it: another idea came before that
    expect(researchSeeds.mock.calls.map((c) => c[0]).filter((o) => modeOf(o) === "online").flatMap((o) => ids(o))).not.toContain("kralen-rijgen");
    expect(report.options!.withOption).toBe(report.options!.ideas);
  });

  it("still keeps the person's own choice when nothing else works, not even the online pass, and says so", async () => {
    mockOnlyTheFirstSelectionHasPlaces({ online: false });
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

describe("no idea goes into the book without an option (Jan, 14 Nov 2026)", () => {
  const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7);

  it("holds when half of all searches come back empty and there are no online providers at all", async () => {
    const lacking: string[] = [];
    const mechanisms = new Set<string>();
    for (let i = 0; i < 8; i++) {
      researchSeeds.mockReset();
      researchSeeds.mockImplementation(async (opts: unknown) => ({
        byActivity: new Map(
          ids(opts).map((id) => [id, { activityId: id, source: "search", options: modeOf(opts) === "online" ? [] : hash(`${id}:${i}:${passOf(opts) ?? ""}`) % 2 === 0 ? [option(`Plek ${id}`)] : [] }]),
        ),
        stats: stats(opts),
      }));
      const { report } = await generateIdeaBookFromSeeds(base, "nl", computeCharacterProfile(base), { sessionId: `guarantee-${i}` });
      for (const n of report.notes) mechanisms.add(n.split(":")[0]);
      if (report.options!.withOption < report.options!.ideas) lacking.push(`${i}: ${report.notes.filter((n) => n.startsWith("no_option:")).join(",")}`);
    }
    expect(lacking).toEqual([]);
    // not a vacuous pass: the broad search and the replacement of ideas really were needed
    expect([...mechanisms].filter((m) => ["broadened_search", "replaced_no_local_offer", "replaced_pick", "swapped_no_option", "widened_radius"].includes(m)).length).toBeGreaterThanOrEqual(2);
  }, 120_000);

  it("swaps an idea that has nothing for one an earlier round did find a place for", async () => {
    // Round one has places for everything except kralen-rijgen and the activities next to it; the second selection has places only for itself.
    researchSeeds.mockImplementation(async (opts: unknown) => ({
      byActivity: new Map(ids(opts).map((id) => [id, { activityId: id, source: "search", options: modeOf(opts) === "online" ? [] : id === "kralen-rijgen" ? [] : [option(`Plek ${id}`)] }])),
      stats: stats(opts),
    }));
    const { report } = await run(base);
    expect(report.options!.withOption).toBe(report.options!.ideas);
  });

  it("stops starting new search rounds once the research has used its time, and still writes the book", async () => {
    researchSeeds.mockImplementation(async (opts: unknown) => {
      vi.setSystemTime(Date.now() + 150_000); // every round "takes" 150 s
      return { byActivity: new Map(ids(opts).map((id) => [id, { activityId: id, source: "search", options: id === "kralen-rijgen" ? [] : [option(`Plek ${id}`)] }])), stats: stats(opts) };
    });
    const { book } = await run(base);
    const calls = researchSeeds.mock.calls.map((c) => c[0]);
    // the first round ran; after that nothing was started (no broad, no wider, no other idea tried)
    expect(calls.filter((o) => passOf(o) === "broad" || widerOf(o))).toHaveLength(0);
    expect(book.ideas.length).toBe(6);
  });
});

const widerOf = (o: unknown) => (o as { searchDistanceKm?: number }).searchDistanceKm === 120;

describe("one place, one idea", () => {
  const seed = (id: string) => ({ activityId: id, direction: "familiar", door: "natural", chain: [id], via: [], lead: null, alsoFormats: [], verify: [] }) as unknown as import("@/lib/discovery/engine").Seed;
  const res = (id: string, ...names: string[]) => [id, { activityId: id, source: "search" as const, options: names.map((n) => ({ ...option(n), rating: null })) }] as const;

  it("takes a place away from a later idea when an earlier idea already has it, and the person's own choices come first", async () => {
    const { dedupePlaces } = await import("@/lib/claude/generateFromSeeds");
    const byActivity = new Map([res("high-tea", "Theehuis", "Landgoed"), res("modemuseum", "Theehuis"), res("yoga", "Studio", "Theehuis")]);
    const out = dedupePlaces([seed("high-tea"), seed("modemuseum"), seed("yoga")], byActivity);
    expect(out.get("high-tea")!.options.map((o) => o.name)).toEqual(["Theehuis", "Landgoed"]);
    expect(out.get("modemuseum")!.options).toEqual([]); // its only place is taken: it counts as lacking an option
    expect(out.get("yoga")!.options.map((o) => o.name)).toEqual(["Studio"]);
    // the person's own choice wins over an idea that stands earlier in the list
    const own = dedupePlaces([seed("high-tea"), seed("modemuseum")], new Map([res("high-tea", "Theehuis"), res("modemuseum", "Theehuis")]), new Set(["modemuseum"]));
    expect(own.get("modemuseum")!.options.map((o) => o.name)).toEqual(["Theehuis"]);
    expect(own.get("high-tea")!.options).toEqual([]);
  });

  it("an alternative option may be shared; only the first option is the idea's place", async () => {
    const { dedupePlaces } = await import("@/lib/claude/generateFromSeeds");
    const out = dedupePlaces([seed("high-tea"), seed("yoga")], new Map([res("high-tea", "A", "Gedeeld"), res("yoga", "B", "Gedeeld")]));
    expect(out.get("yoga")!.options.map((o) => o.name)).toEqual(["B", "Gedeeld"]);
  });
});

describe("online by nature", () => {
  it("is an activity that is only ever done alone or online, such as a writing or language course", async () => {
    const { isOnlineByNature } = await import("@/lib/claude/generateFromSeeds");
    const { getActivity } = await import("@/lib/discovery/library");
    expect(isOnlineByNature(getActivity("vertalen"))).toBe(true);
    expect(isOnlineByNature(getActivity("high-tea"))).toBe(false);
    expect(isOnlineByNature(undefined)).toBe(false);
  });
});
