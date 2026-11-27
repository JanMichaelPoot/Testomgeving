// Step 252: slow websites or a model that does not answer may not push a book past the 300 s of its function.
import { describe, expect, it, vi } from "vitest";
import { CHECK_TIMES, timeFor, within } from "@/lib/claude/checkTime";
import { addPrices, createPriceMemo } from "@/lib/claude/priceResearch";
import { factCheck } from "@/lib/claude/factCheck";
import type { Fetcher } from "@/lib/claude/verifyUrls";
import type { SeedResearch } from "@/lib/claude/localResearch";
import type { ModelCall } from "@/lib/claude/qualityRepair";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

const never = <T>() => new Promise<T>(() => undefined);
const PAGE = `<main><p>${"Welkom bij de droneclub, iedereen mag komen kijken. ".repeat(15)} De avond kost €8,50 per persoon.</p></main>`;
const quick: Fetcher = async () => ({ status: 200, text: async () => PAGE });
const hanging: Fetcher = () => never();

const option = { name: "Club", city: "Utrecht", url: "https://club.test/", note: "Trainingen", until: null, rating: null };
const research = new Map<string, SeedResearch>([["fpv-drone", { activityId: "fpv-drone", options: [option], source: "search" }]]);

const drone = {
  activity_id: "fpv-drone", title: "Droneracen", intro: "Je vliegt een geleende drone.", why_it_fits: "Snelheid.",
  details: ["Meld je aan voor een avond.", "Kom langs en leen een drone van de club."], first_action: "Open de website.", requirements: [],
  practical: { estimated_cost: "€8,50", duration: "Een avond", difficulty: "moderate", preparation: "" }, location: null,
  places: [{ name: "Club", city: "Utrecht", url: "https://club.test/", note: "Trainingen" }],
} as unknown as IdeaBookEntry;
const book = { profile_summary: "", must_haves: [], preferences: [], ideas: [drone], wildcard: drone, labels: {} } as unknown as GeneratedIdeaBook;

describe("the time a check gets", () => {
  it("is what is left of its own total, never past its latest moment in the book", () => {
    expect(timeFor(0, 10_000, 35_000, 160_000)).toBe(35_000);
    expect(timeFor(0, 150_000, 35_000, 160_000)).toBe(10_000);
    expect(timeFor(0, 158_000, 35_000, 160_000)).toBe(0); // too little to be worth starting
    expect(timeFor(0, 300_000, 35_000, 160_000)).toBe(0);
    expect(timeFor(0, 10_000, 2_000, 160_000)).toBe(0); // its own total is used up
  });

  it("leaves room in the 300 s of the function for the writing before the facts and the delivery after them", () => {
    // writing takes about 100 s after the research; link check, PDF, upload and e-mail come after the fact check
    expect(CHECK_TIMES.priceLatestEndMs + 100_000).toBeLessThanOrEqual(300_000 - 30_000);
    expect(CHECK_TIMES.factLatestEndMs).toBeLessThanOrEqual(300_000 - 60_000);
  });

  it("gives the fallback when the work is too slow or fails", async () => {
    await expect(within(never<string>(), 20, "later")).resolves.toBe("later");
    await expect(within(Promise.reject(new Error("down")), 1000, "later")).resolves.toBe("later");
    await expect(within(Promise.resolve("now"), 1000, "later")).resolves.toBe("now");
  });
});

describe("the price check under time pressure", () => {
  it("comes back in time when a site never answers, without a price", async () => {
    const call = vi.fn<ModelCall>(async () => ({ prices: [] }));
    const started = Date.now();
    const priced = await addPrices(research, { locale: "nl", memo: createPriceMemo(), fetcher: hanging, call, timeMs: 300 });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(priced.get("fpv-drone")!.options).toHaveLength(1);
    expect(priced.get("fpv-drone")!.options[0].price).toBeUndefined();
    expect(call).not.toHaveBeenCalled();
  });

  it("comes back in time when the model never answers, and passes it the time it has", async () => {
    const call = vi.fn<ModelCall>(() => never());
    const started = Date.now();
    await addPrices(research, { locale: "nl", memo: createPriceMemo(), fetcher: quick, call, timeMs: 2500 });
    expect(Date.now() - started).toBeLessThan(4000);
    expect(call.mock.calls[0][0].timeoutMs).toBeGreaterThan(0);
    expect(call.mock.calls[0][0].timeoutMs).toBeLessThanOrEqual(2500);
  });

  it("reads nothing new without time, and still gives what it already knows", async () => {
    const memo = createPriceMemo();
    memo.seen.set("fpv-drone|https://club.test/", { amount: 8.5, text: "€8,50", label: "avond", source: "https://club.test/" });
    const fetcher = vi.fn<Fetcher>(quick);
    const known = await addPrices(research, { locale: "nl", memo, fetcher, call: async () => null, timeMs: 0 });
    expect(known.get("fpv-drone")!.options[0].price?.amount).toBe(8.5);
    const fresh = await addPrices(research, { locale: "nl", memo: createPriceMemo(), fetcher, call: async () => null, timeMs: 0 });
    expect(fresh.get("fpv-drone")!.options[0].price).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("the fact check under time pressure", () => {
  it("leaves an idea as written when its website is too slow", async () => {
    const started = Date.now();
    const { book: out, report } = await factCheck(book, { locale: "nl", fetcher: hanging, call: async () => null, timeMs: 300 });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(out.ideas[0].details).toEqual(drone.details);
    expect(report.unjudged[0]).toContain("too slow");
  });

  it("still takes out the drone to borrow when the model does not answer in time", async () => {
    const call = vi.fn<ModelCall>(() => never());
    const started = Date.now();
    const { book: out, report } = await factCheck(book, { locale: "nl", fetcher: quick, call, timeMs: 1500 });
    expect(Date.now() - started).toBeLessThan(3500);
    expect(JSON.stringify([out.ideas[0].intro, out.ideas[0].details])).not.toMatch(/leen|geleend/i);
    expect(report.unjudged[0]).toContain("no usable answer");
    expect(call.mock.calls[0][0].timeoutMs).toBeGreaterThan(0);
  });
});
