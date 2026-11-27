import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeAnswers } from "@/app/intake/actions";
import type { SeedResearch } from "@/lib/claude/localResearch";
import { computeCharacterProfile } from "@/lib/characterProfile";

// Step 249, the whole pipeline: what the price check finds decides which ideas stay. The model, the research and the reading of the
// providers' sites are replaced (that reading has its own tests in priceResearch.test.ts); the selection, the budget rule and the
// replacing are the real ones. Nothing here costs anything.
const create = vi.fn();
vi.mock("@/lib/anthropic", () => ({ anthropic: { messages: { create: (...a: unknown[]) => create(...a) } }, CLAUDE_MODEL: "test-model" }));

const researchSeeds = vi.fn();
vi.mock("@/lib/claude/localResearch", async (orig) => ({
  ...(await orig<typeof import("@/lib/claude/localResearch")>()),
  researchSeeds: (...a: unknown[]) => researchSeeds(...a),
}));

/** What "the places' own sites" say, per activity; an activity without an entry has no price. */
let amountFor: (activityId: string) => number | null = () => null;
const addPrices = vi.fn(async (byActivity: ReadonlyMap<string, SeedResearch>) =>
  new Map(
    [...byActivity].map(([id, r]) => {
      const amount = amountFor(id);
      return [id, amount === null ? r : { ...r, options: r.options.map((o) => ({ ...o, price: { amount, text: `€${amount}`, label: "cursus", source: "https://prijs.test/" } })) }];
    }),
  ),
);
vi.mock("@/lib/claude/priceResearch", async (orig) => ({
  ...(await orig<typeof import("@/lib/claude/priceResearch")>()),
  addPrices: (...a: Parameters<typeof addPrices>) => addPrices(...a),
}));

import { generateIdeaBookFromSeeds } from "@/lib/claude/generateFromSeeds";

const PICKS = ["pottenbakken", "kralen-rijgen", "high-tea", "modemuseum"];
const base: IntakeAnswers = {
  situation: "", purpose: "self", purposeFollowUp: "", ageCategory: "35-44", location: "Laren", searchDistance: "hour", freeTimePattern: "",
  practicalToWild: "either", timeAvailable: "halfday", budget: "50", effort: "some", solutionTypes: ["activity"], mustHaves: "", preferences: "",
  company: ["partner"], personalReflection: "", intakeVariant: "associations", intakeFlow: "images2", associations: ["place-still-water", "moment-stillness"],
  interests: PICKS, interestDomains: ["creative"],
};
const entry = (n: number) => ({
  title: `Idee ${n}`, intro: "Een zin.", why_it_fits: "Omdat.", details: ["Stap één.", "Stap twee."], first_action: "Doe dit.",
  practical: { estimated_cost: "€40", duration: "1 uur", difficulty: "easy", preparation: "" }, location: null, requirements: [],
});
const toolUse = (name: string, input: unknown) => ({ content: [{ type: "tool_use", name, input }], usage: {} });

const run = () => generateIdeaBookFromSeeds(base, "nl", computeCharacterProfile(base), { sessionId: "price-test" });
const idsOf = (book: Awaited<ReturnType<typeof run>>["book"]) => [...book.ideas, book.wildcard].map((e) => e.activity_id!);
const entryOf = (book: Awaited<ReturnType<typeof run>>["book"], id: string) => [...book.ideas, book.wildcard].find((e) => e.activity_id === id)!;
const prompts = () => create.mock.calls.map((c) => JSON.stringify(c[0])).join("\n");

beforeEach(() => {
  create.mockReset();
  researchSeeds.mockReset();
  addPrices.mockClear();
  amountFor = () => null;
  vi.stubEnv("REQUIRE_CONCRETE_OPTIONS", "1");
  vi.stubEnv("WINDOW_COVERAGE", "1");
  vi.stubEnv("WINDOW_PRICE_CHECK", "1");
  researchSeeds.mockImplementation(async (opts: { activityIds: string[] }) => ({
    byActivity: new Map(
      opts.activityIds.map((id) => [id, { activityId: id, source: "search", options: [{ name: `Lokaal ${id}`, city: "Laren", url: `https://${id}.test/`, note: "Proefles", until: null, rating: null }] }]),
    ),
    stats: { cached: 0, searched: opts.activityIds.length, failed: 0, dropped: 0, ms: 1 },
  }));
  create.mockImplementation(async (args: { tools: { name: string }[] }) =>
    args.tools[0].name === "create_layers"
      ? toolUse("create_layers", { ideas: [] })
      : toolUse("create_idea_book", { profile_summary: "S.", must_haves: [], preferences: [], ideas: [1, 2, 3, 4].map(entry), wildcard: entry(5) }),
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

describe("real prices in the pipeline", () => {
  /** The ideas of a book without any price, and one of them the person did not choose themselves. */
  const baseline = async () => {
    const ids = idsOf((await run()).book);
    return { ids, extra: ids.find((id) => !PICKS.includes(id))!, own: ids.find((id) => PICKS.includes(id))! };
  };

  it("replaces an idea whose only place is far above the budget", async () => {
    const { extra, ids } = await baseline();
    amountFor = (id) => (id === extra ? 775 : null);
    const { book, report } = await run();
    expect(idsOf(book)).not.toContain(extra);
    expect(idsOf(book)).toHaveLength(ids.length);
    expect(report.notes).toContain(`over_budget_place:${extra} (€775)`);
  });

  it("keeps the person's own choice, with the real price instead of what the writer wrote", async () => {
    const { own, extra } = await baseline();
    amountFor = (id) => (id === own ? 420 : id === extra ? 19 : null);
    const { book } = await run();
    expect(entryOf(book, own).practical.estimated_cost).toBe("€420");
    expect(entryOf(book, own).places?.[0].price?.amount).toBe(420);
    // within the budget: it stays, with the found price
    expect(entryOf(book, extra).practical.estimated_cost).toBe("€19");
    expect(prompts()).toContain("price on its own website: €420, cursus");
  });

  it("does not make the book shorter when nothing cheaper exists: the idea keeps its place and shows the price", async () => {
    const { ids } = await baseline();
    amountFor = () => 775;
    const { book, report } = await run();
    expect(idsOf(book)).toHaveLength(ids.length);
    expect(report.notes.some((n) => n.startsWith("kept_above_budget:"))).toBe(true);
    for (const e of [...book.ideas, book.wildcard]) expect(e.practical.estimated_cost, e.activity_id).toBe("€775");
  });

  it("asks nothing and changes nothing when it is switched off", async () => {
    vi.stubEnv("WINDOW_PRICE_CHECK", "0");
    amountFor = () => 775;
    const { book } = await run();
    expect(addPrices).not.toHaveBeenCalled();
    for (const e of [...book.ideas, book.wildcard]) expect(e.places?.[0]?.price).toBeUndefined();
  });

  it("no longer asks the writer to spend the budget or to estimate", async () => {
    await run();
    const text = prompts();
    expect(text).not.toContain("40-100%");
    expect(text).not.toContain("rough range");
    expect(text).not.toContain("{{ASK}}");
    expect(text).toContain("Prijs navragen");
  });
});
