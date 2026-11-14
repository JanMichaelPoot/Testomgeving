import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeAnswers } from "@/app/intake/actions";
import { computeCharacterProfile } from "@/lib/characterProfile";
import { languageLabel } from "@/lib/locale";
import { getActivity } from "@/lib/discovery/library";

// B5 (V1 + V2) behind KNOWLEDGE_ENGINE_V2: the model and the research are replaced, so this tests what the
// pipeline asks for and what it does with the answer. Nothing here costs anything.
const create = vi.fn();
vi.mock("@/lib/anthropic", () => ({ anthropic: { messages: { create: (...a: unknown[]) => create(...a) } }, CLAUDE_MODEL: "test-model" }));

const researchSeeds = vi.fn();
vi.mock("@/lib/claude/localResearch", async (orig) => ({
  ...(await orig<typeof import("@/lib/claude/localResearch")>()),
  researchSeeds: (...a: unknown[]) => researchSeeds(...a),
}));

import { FILL_PROMPT_RULES, HONEST_ORIGIN_RULE, ROUTE_CONSISTENCY_RULE, generateIdeaBookFromSeeds, why } from "@/lib/claude/generateFromSeeds";
import type { Seed } from "@/lib/discovery/engine";

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
  associations: ["moment-clay", "place-forest-edge", "sense-wood"],
  interests: ["pottenbakken"],
  interestDomains: ["creative"],
};

const size = (n: number) => ({ title: `Maat ${n}`, description: "Een zin.", estimated_cost: "€10", duration: "1 uur" });
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
// Twenty-one different opening words, so the default fills never look repetitive.
const OPENERS = ["Neem", "Probeer", "Vraag", "Fotografeer", "Vergelijk", "Deel", "Kies", "Zoek", "Bewaar", "Luister", "Schrijf", "Teken", "Ruik", "Proef", "Bel", "Plan", "Leen", "Ruil", "Haal", "Breng", "Wacht"];
const fillOf = (n: number, over: Record<string, unknown> = {}) => ({
  timeline: [`Start ${n}`, `Midden ${n}`, `Einde ${n}`, `Daarna ${n}`],
  takeaways: [`Mee ${n}a`, `Mee ${n}b`, `Mee ${n}c`],
  suggestions: [0, 1, 2].map((k) => `${OPENERS[(n - 1) * 3 + k]} tip ${n}${"abc"[k]}`),
  ...over,
});
const layer = (n: number, extra: Record<string, unknown> = {}) => ({
  feels_like: `Koel ${n}. Stil.`,
  sizes: [size(1), size(2), size(3)],
  next_step: `Doe het nog eens ${n}.`,
  ...fillOf(n),
  ...extra,
});
const toolUse = (name: string, input: unknown) => ({ content: [{ type: "tool_use", name, input }], usage: {} });
const coreAnswer = () =>
  toolUse("create_idea_book", {
    profile_summary: "Samenvatting.",
    must_haves: [],
    preferences: [],
    ideas: [1, 2, 3, 4].map(entry),
    wildcard: entry(5),
  });
const layersAnswer = (layers: unknown[]) => toolUse("create_layers", { ideas: layers });
const fiveLayers = (extra: (n: number) => Record<string, unknown> = () => ({})) => [1, 2, 3, 4, 5].map((n) => layer(n, extra(n)));

function respond(layers: () => unknown = () => layersAnswer(fiveLayers())) {
  create.mockImplementation(async (args: { tools: { name: string }[] }) => (args.tools[0].name === "create_layers" ? layers() : coreAnswer()));
}
const callsFor = (tool: string) => create.mock.calls.map((c) => c[0]).filter((a) => a.tools[0].name === tool);
const squash = (s: string) => s.replace(/\s+/g, " ");

beforeEach(() => {
  create.mockReset();
  researchSeeds.mockReset();
  researchSeeds.mockImplementation(async (opts: { activityIds: string[] }) => ({
    byActivity: new Map(opts.activityIds.map((id) => [id, { activityId: id, source: "search", options: [] }])),
    stats: { cached: 0, searched: opts.activityIds.length, failed: 0, ms: 1 },
  }));
});
afterEach(() => vi.unstubAllEnvs());

const run = (over: Partial<IntakeAnswers> = {}) => {
  const answers = { ...intake, ...over };
  return generateIdeaBookFromSeeds(answers, "nl", computeCharacterProfile(answers), { sessionId: "v2-test" });
};

describe("KNOWLEDGE_ENGINE_V2 off (the default): nothing changes", () => {
  it("asks for no fill lines, adds no new prompt rule and stores no fill", async () => {
    respond(() => layersAnswer(fiveLayers()));
    const { book } = await run();
    const [extra] = callsFor("create_layers");
    const [core] = callsFor("create_idea_book");
    expect(Object.keys(extra.tools[0].input_schema.properties.ideas.items.properties)).toEqual(["feels_like", "sizes", "next_step"]);
    expect(squash(extra.system)).not.toContain("timeline: exactly four");
    expect(squash(core.system)).not.toContain("The person chose IMAGES");
    expect(squash(core.system)).not.toContain("Route. The");
    expect(squash(extra.system)).not.toContain("never switch the medium");
    expect(squash(core.messages[0].content)).toContain("Related to something they picked");
    expect([...book.ideas, book.wildcard].some((i) => i.fill)).toBe(false);
    // B4: the selection keeps its old weights and the ideas carry no measured fit.
    expect([...book.ideas, book.wildcard].some((i) => i.fit !== undefined || i.reasons !== undefined)).toBe(false);
  });
});

describe("KNOWLEDGE_ENGINE_V2 on", () => {
  beforeEach(() => vi.stubEnv("KNOWLEDGE_ENGINE_V2", "1"));

  it("adds the fill fields to the layers schema and the fill rules, before the honesty rules, to the layers prompt", async () => {
    respond();
    await run();
    const [extra] = callsFor("create_layers");
    const items = extra.tools[0].input_schema.properties.ideas.items;
    expect(Object.keys(items.properties)).toEqual(["feels_like", "sizes", "next_step", "timeline", "takeaways", "suggestions"]);
    expect(items.required).toEqual(["feels_like", "sizes", "next_step", "timeline", "takeaways", "suggestions"]);
    expect(items.properties.timeline.minItems).toBe(4);
    const prompt = squash(extra.system);
    expect(prompt).toContain(squash(FILL_PROMPT_RULES.replaceAll("{{LANGUAGE}}", languageLabel("nl"))).trim());
    expect(prompt.indexOf("timeline: exactly four")).toBeGreaterThan(prompt.indexOf("next_step: one sentence"));
    expect(prompt.indexOf("timeline: exactly four")).toBeLessThan(prompt.indexOf("Honesty. These matter"));
  });

  it("tells the writer that the person chose images, and never that they picked a derived activity", async () => {
    respond();
    await run();
    const [core] = callsFor("create_idea_book");
    expect(squash(core.system)).toContain(squash(HONEST_ORIGIN_RULE).trim());
    const why = (core.messages[0].content as string).split("\n").filter((l) => l.includes("Why it was chosen"));
    expect(why.length).toBe(5);
    // The familiar ideas are read from the images ("point to"); none of the five says "picked" or "chose" about an activity.
    expect(why.filter((l) => /(?<!not )picked|chose themselves|on the cards/i.test(l))).toEqual([]);
  });

  it("keeps a complete fill on the idea, in the order of the ideas, the wildcard last", async () => {
    respond();
    const { book, report } = await run();
    book.ideas.forEach((idea, i) => expect(idea.fill).toEqual(fillOf(i + 1)));
    expect(book.wildcard.fill).toEqual(fillOf(5));
    expect(report.issues.filter((x) => x.includes("fill_"))).toEqual([]);
  });

  it("drops a fill with the wrong number of lines and says why, without failing the book", async () => {
    respond(() => layersAnswer(fiveLayers((n) => (n === 2 ? { takeaways: ["Eén"] } : n === 3 ? { timeline: undefined } : {}))));
    const { book, report } = await run();
    expect(book.ideas[1].fill).toBeUndefined();
    expect(book.ideas[2].fill).toBeUndefined();
    expect(book.ideas[0].fill).toBeDefined();
    expect(report.issues).toContain("idea2:fill_dropped (takeaways has 1 lines instead of 3)");
    expect(report.issues).toContain("idea3:fill_dropped (timeline is not a list)");
    // The rest of the layers of those ideas survive.
    expect(book.ideas[1].feels_like).toBe("Koel 2. Stil.");
  });

  it("drops a fill that contradicts the idea: 'bring someone' for a person who goes alone", async () => {
    respond(() => layersAnswer(fiveLayers(() => ({ suggestions: ["Neem iemand mee", "Tip b", "Tip c"] }))));
    const { book, report } = await run({ company: ["alone"] });
    expect([...book.ideas, book.wildcard].every((i) => !i.fill)).toBe(true);
    expect(report.issues.some((x) => x.startsWith("idea1:fill_conflict") && x.includes("suggestions:solo"))).toBe(true);
  });

  it("tells both writers to follow the route of 'Easy way in', and the layers writer to vary the openings", async () => {
    respond();
    await run();
    const [core] = callsFor("create_idea_book");
    const [extra] = callsFor("create_layers");
    expect(squash(core.system)).toContain(squash(ROUTE_CONSISTENCY_RULE).trim());
    expect(squash(core.system).indexOf("Route. The")).toBeLessThan(squash(core.system).indexOf("For every idea:"));
    const layers = squash(extra.system);
    expect(layers).toContain("never switch the medium or the route");
    expect(layers).toContain("no verb may start more than two of the suggestions in the whole book");
    expect(layers).toContain(`written entirely in ${languageLabel("nl")}`);
  });

  it("reports an opening word that starts many suggestions, and still keeps every line", async () => {
    respond(() => layersAnswer(fiveLayers((n) => ({ suggestions: [`Noteer a${n}`, `Noteer b${n}`, `${OPENERS[n]} c${n}`] }))));
    const { book, report } = await run();
    expect(report.issues).toContain("fill_repetitive (noteer x10)");
    expect([...book.ideas, book.wildcard].every((i) => i.fill)).toBe(true);
  });

  it("selects with the B4 ranking: every idea carries its measured fit and the reasons that led to it", async () => {
    respond();
    const { book } = await run();
    for (const idea of [...book.ideas, book.wildcard]) {
      expect(idea.fit).toBeGreaterThanOrEqual(0);
      expect(idea.fit).toBeLessThanOrEqual(100);
      expect(idea.reasons?.some((r) => r.startsWith("direction:"))).toBe(true);
    }
    // The most direct idea fits better than the most far-out one.
    expect(Math.max(...book.ideas.map((i) => i.fit ?? 0))).toBeGreaterThan(Math.min(...book.ideas.map((i) => i.fit ?? 0)));
  });

  it("still stores the chain of every idea (the origin the person can see)", async () => {
    respond();
    const { book } = await run();
    for (const idea of [...book.ideas, book.wildcard]) expect(idea.chain?.length).toBeGreaterThan(0);
  });
});

describe("why(): the line that tells the writer where an idea came from", () => {
  const seed = (over: Partial<Seed>): Seed =>
    ({ activityId: "pottenbakken", direction: "adjacent", door: "discovery", chain: ["meditatie", "pottenbakken"], via: ["calm"], verify: [], lead: null, alsoFormats: [], ...over }) as Seed;

  it("is unchanged without the honest option", () => {
    expect(why(seed({}), "en", true)).toContain("Related to something they picked");
    expect(why(seed({ direction: "unexpected" }), "en", true)).toContain("Far from what they picked");
  });

  it("with the honest option and images, calls a derived activity derived, never picked", () => {
    for (const direction of ["adjacent", "unexpected", "stretch", "wildcard"] as const) {
      const line = why(seed({ direction }), "en", true, true);
      expect(line).not.toMatch(/(?<!not )picked|chose themselves/i);
      expect(line.length).toBeGreaterThan(20);
    }
    expect(why(seed({ direction: "adjacent" }), "en", true, true)).toContain("not picked by them");
    expect(why(seed({ direction: "unexpected" }), "en", true, true)).toContain("They did not pick any of it");
  });

  it("does not change what the card wizard says (there the person did pick activities)", () => {
    expect(why(seed({}), "en", false, true)).toContain("Related to something they picked");
  });
});

describe("the title follows the first found place (Jan, 14 Nov 2026)", () => {
  it("tells the writer to take the setting from the option, not from the general hint, and shows what each place really is", async () => {
    researchSeeds.mockImplementation(async (opts: { activityIds: string[] }) => ({
      byActivity: new Map(
        opts.activityIds.map((id) => [
          id,
          {
            activityId: id,
            source: "search",
            options: [{ name: "Theehuis 't Bluk", city: "Laren", url: null, note: `${getActivity(id)?.label.nl ?? id}: high tea op afspraak.`, until: null, rating: null, kind: "café op de hei", match: "close" }],
          },
        ]),
      ),
      stats: { cached: 0, searched: opts.activityIds.length, failed: 0, ms: 1 },
    }));
    respond();
    await run();
    const [core] = callsFor("create_idea_book");
    const system = squash(core.system);
    expect(system).toContain("it must be TRUE OF THE FIRST verified local option");
    expect(system).toContain("never a high tea in a country house");
    expect(system).toContain("that none of the verified options shows");
    const user = squash(core.messages[0].content);
    expect(user).toContain("Theehuis 't Bluk (Laren) — is: café op de hei [another form than the usual way in]");
    expect(user).toContain("Easy way in (a general hint, not a fact about the options below)");
  });
});

describe("the cost of one book (Jan, 14 Nov 2026: at most USD 0.40)", () => {
  // Every research call "costs" USD 0.25 (twenty-five searches) and finds nothing, so every optional round is wanted (the test setup has them off by default).
  const spendy = () => {
    vi.stubEnv("REQUIRE_CONCRETE_OPTIONS", "1");
    researchSeeds.mockImplementation(async (opts: { activityIds: string[]; ledger?: { add: (kind: string, usage: unknown) => void } }) => {
      opts.ledger?.add("standard", { server_tool_use: { web_search_requests: 25 } });
      return {
        byActivity: new Map(opts.activityIds.map((id) => [id, { activityId: id, source: "search", options: [] }])),
        stats: { cached: 0, searched: opts.activityIds.length, failed: 0, ms: 1 },
      };
    });
  };

  it("stops the optional rounds when the next one would pass the cap, and says so in the report", async () => {
    spendy();
    respond();
    const { report } = await run();
    // Only the first search: 0.25 spent, so neither a broad round (0.09) nor an online round (0.05) fits with the writing (0.11) still to pay.
    expect(researchSeeds).toHaveBeenCalledTimes(1);
    expect(report.cost?.skipped).toEqual(expect.arrayContaining(["broad", "standard"]));
    expect(report.cost?.skipped).toContain("online");
    expect(report.notes).toContain("cost_cap_skipped:broad");
    expect(report.cost?.capUsd).toBe(0.4);
    expect(report.cost?.usd).toBeGreaterThanOrEqual(0.25);
  });

  it("still delivers a complete book when rounds were skipped", async () => {
    spendy();
    respond();
    const { book } = await run();
    expect(book.ideas).toHaveLength(4);
    expect(book.wildcard.title).toBeTruthy();
  });

  it("runs the rounds as before when the limit is off", async () => {
    vi.stubEnv("WINDOW_BOOK_COST_CAP", "off");
    spendy();
    respond();
    const { report } = await run();
    expect(researchSeeds.mock.calls.length).toBeGreaterThan(1);
    expect(report.cost?.capUsd).toBeNull();
    expect(report.cost?.skipped).toEqual([]);
  });

  it("counts the writing in the book's cost", async () => {
    vi.stubEnv("WINDOW_BOOK_COST_CAP", "off");
    create.mockImplementation(async (args: { tools: { name: string }[] }) => ({
      ...(args.tools[0].name === "create_layers" ? layersAnswer(fiveLayers()) : coreAnswer()),
      usage: { input_tokens: 10_000, output_tokens: 3_000 },
    }));
    const { report } = await run();
    expect(report.cost?.breakdown.writing).toBeGreaterThan(0.05); // two calls of 10k in and 3k out at $2 and $10 per million
  });
});

describe("what is kept with the book (Stap 195)", () => {
  const runWith = (extra: Record<string, unknown>, over: Partial<IntakeAnswers> = {}) => {
    const answers = { ...intake, ...over };
    return generateIdeaBookFromSeeds(answers, "nl", computeCharacterProfile(answers), { sessionId: "v2-test", ...extra });
  };
  const price = { usage: { input_tokens: 10_000, output_tokens: 3_000 } };
  const answerWithUsage = () =>
    create.mockImplementation(async (args: { tools: { name: string }[] }) => ({ ...(args.tools[0].name === "create_layers" ? layersAnswer(fiveLayers()) : coreAnswer()), ...price }));

  it("reports the cost in the shape that goes into progress_meta: model calls, the Google lookups, the research counts and the supply index", async () => {
    vi.stubEnv("WINDOW_BOOK_COST_CAP", "off");
    answerWithUsage();
    const { report } = await runWith({ quietSupply: ["fossielen", "kamperen"] });
    expect(report.cost).toMatchObject({ capUsd: null, skipped: [], placesLookups: 0, placesListUsd: 0, research: { cached: expect.any(Number), searched: expect.any(Number), failed: 0 }, quiet: { known: 2, inBook: expect.any(Number) } });
    expect(report.cost?.usd).toBeGreaterThan(0.05);
  });

  it("uses the ledger of the caller, so what a failed attempt had spent can still be read", async () => {
    vi.stubEnv("WINDOW_BOOK_COST_CAP", "off");
    answerWithUsage();
    const { createCostLedger } = await import("@/lib/claude/costLedger");
    const ledger = createCostLedger({ capUsd: null });
    const { report } = await runWith({ ledger });
    expect(ledger.spentUsd()).toBeCloseTo(report.cost!.usd, 3);
    expect(ledger.breakdown().writing).toBeGreaterThan(0.05);
  });

  it("hands the quiet activities to the selection: fewer of them end up in the book, and the report counts the ones that still do", async () => {
    answerWithUsage();
    const plain = (await runWith({ quietSupply: [] })).report.seeds.map((s) => s.activityId);
    const avoid = plain.filter((id) => id !== "pottenbakken").slice(0, 3);
    expect(avoid.length).toBeGreaterThan(0);
    const { report } = await runWith({ quietSupply: avoid });
    // A soft penalty, not a ban: all of them were in the book before, a slot that nothing else fits may still hold one.
    const stillIn = avoid.filter((id) => report.seeds.some((s) => s.activityId === id)).length;
    expect(stillIn).toBeLessThan(avoid.length);
    expect(report.cost?.quiet).toEqual({ known: avoid.length, inBook: stillIn });
  });

  it("reads the quiet activities from the research cache when the caller gives none, and a failure there only means a book without them", async () => {
    answerWithUsage();
    const { report } = await runWith({});
    // WINDOW_SUPPLY_INDEX=0 in the test environment: the index is off, nothing is read, the book is made as before.
    expect(report.cost?.quiet).toEqual({ known: 0, inBook: 0 });
  });
});
