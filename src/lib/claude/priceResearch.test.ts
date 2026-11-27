import { describe, expect, it, vi } from "vitest";
import { addPrices, buildPricePrompt, createPriceMemo, readPricePages, splitByBudget, tooDear, verifiedPrices, type PriceItem } from "@/lib/claude/priceResearch";
import type { Fetcher } from "@/lib/claude/verifyUrls";
import type { LocalOption, SeedResearch } from "@/lib/claude/localResearch";
import type { ModelCall } from "@/lib/claude/qualityRepair";
import { createCostLedger } from "@/lib/claude/costLedger";
import { moneySnippets, priceLinks, linkHints } from "@/lib/links/priceText";
import { normalizePlaces } from "@/lib/claude/ideaLayers";
import { priceKind } from "@/lib/links/priceClaims";
import { verifyBook } from "@/lib/links/verifyBook";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

// Step 249. The pages below mirror what the real ones showed on 27 Nov 2026: the right price stands next to wrong ones (a discount, another
// course, a four-year programme), sometimes only on a sub page.
const PAGES: Record<string, string> = {
  "https://school.test/utrecht": `<main><h1>Schrijfcursussen in Utrecht</h1><p>De korting bedraagt &euro;50 als je een kortingscode hebt.</p>
    <a href="/opleiding/kosten-opleiding">Kosten opleiding</a><a href="/schrijfcursussen/kosten-schrijfcursus">Kosten schrijfcursus</a><a href="/privacy">Prijs en privacy</a><a href="https://elders.test/prijzen">Prijzen</a></main>`,
  "https://school.test/schrijfcursussen/kosten-schrijfcursus": `<p>Een schrijfcursus kost € 575, met uitzondering van de romancursus. Die cursus kost € 775.</p>`,
  "https://school.test/opleiding/kosten-opleiding": `<p>Het studiegeld bedraagt € 2.850 per studiejaar.</p>`,
  "https://sterren.test/": `<a href="/sterrenkijkavonden">Sterrenkijkavonden</a><a href="/winkel">Winkel</a><p>Welkom bij de sterrenwacht.</p>`,
  "https://sterren.test/sterrenkijkavonden": `<script>var x = "€99";</script><div hidden><p>Donderdag en vrijdag. Prijs: €19,50</p></div>`,
};
const fetcher: Fetcher = async (url) => {
  const html = PAGES[url];
  return html === undefined ? { status: 404, text: async () => "" } : { status: 200, text: async () => html };
};
const option = (over: Partial<LocalOption>): LocalOption => ({ name: "Schrijfschool", city: "Utrecht", url: "https://school.test/utrecht", note: "Cursussen Roman en kort verhaal", until: null, rating: null, ...over });
const research = (activityId: string, ...options: LocalOption[]): SeedResearch => ({ activityId, options, source: "search" });

describe("the money passages of a provider's pages", () => {
  it("reads hidden fold-outs, not scripts, and follows the price pages of the same site only", () => {
    expect(moneySnippets(PAGES["https://sterren.test/sterrenkijkavonden"]).join(" ")).toContain("€19,50");
    expect(moneySnippets(PAGES["https://sterren.test/sterrenkijkavonden"]).join(" ")).not.toContain("€99");
    const links = priceLinks(PAGES["https://school.test/utrecht"], "https://school.test/utrecht", linkHints(["Een roman schrijven", "Cursussen Roman"]));
    expect(links).toEqual(["https://school.test/schrijfcursussen/kosten-schrijfcursus", "https://school.test/opleiding/kosten-opleiding"]);
    expect(priceLinks(PAGES["https://sterren.test/"], "https://sterren.test/", linkHints(["Sterrenkijken"]))).toEqual(["https://sterren.test/sterrenkijkavonden"]);
  });

  it("collects the main page and the linked ones", async () => {
    const pages = await readPricePages(option({}), "Een roman schrijven", fetcher);
    expect(pages.map((p) => p.url)).toContain("https://school.test/schrijfcursussen/kosten-schrijfcursus");
    expect(pages.flatMap((p) => p.snippets).join(" ")).toContain("€ 775");
  });
});

describe("which of the model's picks is kept", () => {
  const items: PriceItem[] = [
    { activityId: "roman-schrijven", activity: "Een roman schrijven", option: option({}), pages: [{ url: "https://school.test/k", snippets: ["De romancursus kost € 775."] }] },
    { activityId: "sterrenkijken", activity: "Sterrenkijken", option: option({ name: "Sterrenwacht" }), pages: [{ url: "https://sterren.test/a", snippets: ["Prijs: €19,50"] }] },
  ];

  it("only an amount that stands in that item's own text, as euros", () => {
    const [roman, stars] = verifiedPrices({ prices: [{ n: 1, amount: 775, what: "romancursus" }, { n: 2, amount: 19.5, what: "per persoon" }] }, items, "nl");
    expect(roman).toEqual({ amount: 775, text: "€775", label: "romancursus", source: "https://school.test/k" });
    expect(stars?.text).toBe("€19,50");
    // invented, taken from the other item, zero, a wrong item number, and nonsense
    expect(verifiedPrices({ prices: [{ n: 1, amount: 45, what: "x" }, { n: 2, amount: 775, what: "x" }, { n: 2, amount: 0, what: "x" }, { n: 9, amount: 19.5, what: "x" }] }, items, "nl")).toEqual([null, null]);
    expect(verifiedPrices(null, items, "nl")).toEqual([null, null]);
    expect(verifiedPrices({ prices: [{ n: 1, amount: null, what: "" }] }, items, "nl")).toEqual([null, null]);
  });

  it("not an amount in another currency", () => {
    const franc: PriceItem[] = [{ ...items[0], pages: [{ url: "https://x.test/", snippets: ["Kurs CHF 40"] }] }];
    expect(verifiedPrices({ prices: [{ n: 1, amount: 40, what: "Kurs" }] }, franc, "nl")).toEqual([null]);
  });

  it("tells the model the page text is data", () => {
    expect(buildPricePrompt(items)).toContain("## Item 2");
  });
});

describe("a whole round", () => {
  const answer: ModelCall = async ({ user, onUsage }) => {
    onUsage?.({ input_tokens: 4000, output_tokens: 200 }, "claude-haiku-4-5-20251001");
    return { prices: [...user.matchAll(/## Item (\d+)\nactivity: (.*)/g)].map((m) => ({ n: Number(m[1]), amount: /roman/i.test(m[2]) ? 775 : 19.5, what: "test" })) };
  };
  const byActivity = new Map([
    ["roman-schrijven", research("roman-schrijven", option({}))],
    ["sterrenkijken", research("sterrenkijken", option({ name: "Sterrenwacht", url: "https://sterren.test/", note: "Sterrenkijkavonden" }))],
  ]);

  it("puts verified prices on the places, counts the cost, and reads nothing twice", async () => {
    const call = vi.fn(answer);
    const ledger = createCostLedger();
    const memo = createPriceMemo();
    const priced = await addPrices(byActivity, { locale: "nl", memo, ledger, fetcher, call });
    expect(priced.get("roman-schrijven")!.options[0].price?.text).toBe("€775");
    expect(priced.get("sterrenkijken")!.options[0].price?.text).toBe("€19,50");
    expect(ledger.spentUsd()).toBeCloseTo(0.005, 4);
    const again = await addPrices(byActivity, { locale: "nl", memo, ledger, fetcher, call });
    expect(again.get("roman-schrijven")!.options[0].price?.amount).toBe(775);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("fails soft: no answer means no price", async () => {
    const priced = await addPrices(byActivity, { locale: "nl", memo: createPriceMemo(), fetcher, call: async () => null });
    expect(priced.get("roman-schrijven")!.options[0].price).toBeUndefined();
    const broken = await addPrices(byActivity, { locale: "nl", memo: createPriceMemo(), fetcher, call: async () => Promise.reject(new Error("down")) });
    expect(broken.get("roman-schrijven")!.options).toHaveLength(1);
  });

  it("keeps the price on the stored place, so the book may show it", async () => {
    const priced = await addPrices(byActivity, { locale: "nl", memo: createPriceMemo(), fetcher, call: answer });
    const places = normalizePlaces(priced.get("sterrenkijken")!.options);
    expect(places[0].price).toMatchObject({ text: "€19,50", source: "https://sterren.test/sterrenkijkavonden" });
    expect(priceKind("€19,50", { places, activity_id: "sterrenkijken" })).toBe("found");
    expect(priceKind("€15", { places, activity_id: "sterrenkijken" })).toBe("unconfirmed");
  });
});

describe("the budget", () => {
  const price = (amount: number) => ({ amount, text: `€${amount}`, label: "", source: "https://x.test/" });

  it("drops what is more than one and a half times the budget", () => {
    expect(tooDear(price(775), "50")).toBe(true);
    expect(tooDear(price(75), "50")).toBe(false);
    expect(tooDear(price(76), "50")).toBe(true);
    expect(tooDear(price(1), "free")).toBe(true);
    expect(tooDear(price(5000), "allin")).toBe(false);
    expect(tooDear(price(5000), undefined)).toBe(false);
    expect(tooDear(undefined, "50")).toBe(false);
  });

  it("takes only the dear places away, remembers them cheapest first, and never touches an own choice", () => {
    const options = [option({ name: "A", price: price(775) }), option({ name: "B" }), option({ name: "C", price: price(420) })];
    const byActivity = new Map([["roman-schrijven", research("roman-schrijven", ...options)], ["storytelling", research("storytelling", option({ name: "D", price: price(420) }))]]);
    const split = splitByBudget(byActivity, "50", new Set(["storytelling"]));
    expect(split.byActivity.get("roman-schrijven")!.options.map((o) => o.name)).toEqual(["B"]);
    expect(split.dear.get("roman-schrijven")!.map((o) => o.name)).toEqual(["C", "A"]);
    expect(split.byActivity.get("storytelling")!.options).toHaveLength(1);
    expect(split.dear.has("storytelling")).toBe(false);
  });
});

describe("the last check before a book is saved", () => {
  it("keeps a price that was read from a sub page of the place", async () => {
    const place = { name: "Schrijfschool", city: "Utrecht", url: "https://school.test/utrecht", note: "Cursussen Roman", price: { amount: 775, text: "€775", label: "romancursus", source: "https://school.test/schrijfcursussen/kosten-schrijfcursus" } };
    const idea = {
      activity_id: "roman-schrijven", title: "Een eigen roman", intro: "Schrijven.", why_it_fits: "Verhalen.", details: ["Schrijf je in.", "Begin."], first_action: "Open de site.", requirements: [],
      practical: { estimated_cost: "€775", duration: "10 weken", difficulty: "moderate", preparation: "" }, location: null, places: [place],
    } as unknown as IdeaBookEntry;
    const page = `<main><h1>Schrijfschool Utrecht</h1><p>${"Schrijfcursussen voor beginners in Utrecht. ".repeat(20)}</p></main>`;
    const { book } = await verifyBook(
      { profile_summary: "", must_haves: [], preferences: [], ideas: [idea], wildcard: idea, labels: {} } as unknown as GeneratedIdeaBook,
      { language: "nl", country: "NL", adultsOnly: true, place: "Utrecht", fetcher: async () => ({ status: 200, text: async () => page, contentLanguage: "nl" }) },
    );
    expect(book.ideas[0].practical.estimated_cost).toBe("€775");
    expect(book.ideas[0].places?.[0].price?.amount).toBe(775);
  });
});
