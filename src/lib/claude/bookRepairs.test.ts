// Step 254: the five faults of the rejected sample book of 27 Nov 2026, each with what the real book and the real sites showed.
import { describe, expect, it } from "vitest";
import { PDFPage } from "pdf-lib";
import { applyVerdict, readEvidence, unbackedAge } from "@/lib/claude/factCheck";
import { placesNamedFirst } from "@/lib/claude/namedPlace";
import { addPrices, createPriceMemo, verifiedPrices, type PriceItem } from "@/lib/claude/priceResearch";
import { normalizePlaces } from "@/lib/claude/ideaLayers";
import { timeChipConflict } from "@/lib/claude/qualityGate";
import { priceKind } from "@/lib/links/priceClaims";
import { isAppPage, minimumForAmount, minimumPeople } from "@/lib/links/priceTerms";
import { getActivity } from "@/lib/discovery/library";
import { renderIdeaBookPdf } from "@/lib/pdf/ideaBook";
import type { LocalOption } from "@/lib/claude/localResearch";
import type { Fetcher } from "@/lib/claude/verifyUrls";
import type { ModelCall } from "@/lib/claude/qualityRepair";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

const entry = (over: Partial<IdeaBookEntry>): IdeaBookEntry =>
  ({ title: "Idee", intro: "Een middag.", why_it_fits: "Dit past.", details: ["Kijk op de site.", "Meld je aan."], first_action: "Open de site.", requirements: [], practical: { estimated_cost: "", duration: "2 uur", difficulty: "easy", preparation: "" }, location: null, ...over }) as unknown as IdeaBookEntry;

describe("1. the fact check reads the place the idea names", () => {
  const archery = entry({
    activity_id: "boogschieten",
    title: "Boogschieten bij De Vrije Schutter",
    details: ["Meld je aan bij De Vrije Schutter voor een introductieles.", "Je schiet met materiaal van de club."],
    first_action: "Open devrijeschutter.test en kies een datum.",
    requirements: ["Aanmelding vooraf", "Minimaal 16 jaar"],
    practical: { estimated_cost: "€22,50", duration: "4 uur", difficulty: "easy", preparation: "" },
    places: [
      { name: "Boogschietvereniging Aim for Fun", city: "Utrecht", url: "https://aim.test/", note: "Vanaf 16 jaar" },
      { name: "Stichting Schietsport Utrecht", city: "Utrecht", url: "https://schietsport.test/", note: "" },
      { name: "De Vrije Schutter", city: "Utrecht", url: "https://devrijeschutter.test/", note: "", price: { amount: 22.5, text: "€22,50", label: "introductie", source: "https://devrijeschutter.test/" } },
    ],
  });
  const filler = `<p>${"Wij schieten buiten en binnen, het hele jaar door. ".repeat(12)}</p>`;
  const sites: Record<string, string> = {
    "https://aim.test/": `<p>Aim for Fun: leden vanaf 16 jaar.</p>${filler}`,
    "https://schietsport.test/": filler,
    "https://devrijeschutter.test/": `<p>De introductie is voor iedereen vanaf 11 jaar. Het materiaal van de club is bij de les inbegrepen.</p>${filler}`,
  };
  const fetcher: Fetcher = async (url) => (sites[url] === undefined ? { status: 404, text: async () => "" } : { status: 200, text: async () => sites[url] });

  it("puts that place first, though the list starts with another club", () => {
    expect(placesNamedFirst(archery).map((p) => p.name)[0]).toBe("De Vrije Schutter");
  });

  it("reads its site, and judges an age against that site alone", async () => {
    const { evidence, full, named } = await readEvidence(archery, "nl", fetcher);
    expect(evidence[0].url).toContain("devrijeschutter.test");
    expect(named).toContain("vanaf 11 jaar");
    expect(named).not.toContain("16 jaar");
    // another club's minimum age is not this one's
    expect(unbackedAge("Minimaal 16 jaar", named)).toBe(true);
    expect(unbackedAge("Je kunt mee vanaf 11 jaar.", named)).toBe(false);
    const verdict = applyVerdict(archery, { offers: "De introductie is voor iedereen vanaf 11 jaar", claims: [], fixes: [] }, full, "nl", named);
    expect(verdict.entry.requirements).toEqual(["Aanmelding vooraf"]);
    // what the named place's own site says stays
    expect(verdict.entry.details).toEqual(archery.details);
  });

  it("names that place in a fixed sentence", () => {
    const verdict = applyVerdict(archery, { offers: "", claims: [{ field: "details[0]", claim: "introductieles", quote: "" }], fixes: [] }, "Niets hierover.", "nl", "Niets hierover.");
    expect(verdict.entry.details[0]).toBe("Vraag De Vrije Schutter of zij dit aanbieden en wanneer je mee kunt.");
  });

  it("keeps the other sentences of a field when the code refuses one", () => {
    const farm = entry({ intro: "Je helpt een ochtend mee op de boerderij. Gereedschap is aanwezig.", places: [{ name: "Boerderij", city: "Utrecht", url: "https://boerderij.test/", note: "" }] });
    expect(applyVerdict(farm, { offers: "", claims: [], fixes: [] }, "Word vrijwilliger.", "nl").entry.intro).toBe("Je helpt een ochtend mee op de boerderij.");
  });
});

const option = (over: Partial<LocalOption>): LocalOption => ({ name: "Aanbieder", city: "Utrecht", url: "https://a.test/", note: "", until: null, rating: null, ...over });
const item = (snippet: string, url = "https://a.test/prijzen", over: Partial<LocalOption> = {}): PriceItem => ({ activityId: "spookwandeling", activity: "Spookwandeling", option: option(over), pages: [{ url, snippets: [snippet] }] });
const picked = (amount: number, min: number | null = null) => ({ prices: [{ n: 1, amount, what: "per persoon", min_people: min }] });

describe("2. a price from a minimum number of people is not one person's price", () => {
  it("finds the minimum that stands with the amount, and not the next row's", () => {
    const at = (text: string, amount: string) => minimumForAmount(text, text.indexOf(amount), amount.length);
    expect(at("Vanaf 12 personen v.a. € 15.00 p.p.", "15.00")).toBe(12);
    expect(at("€ 15,00 per persoon, vanaf 10 personen.", "15,00")).toBe(10);
    expect(at("Individueel € 12,50. Groepen vanaf 15 personen € 10,00", "12,50")).toBeNull();
    expect(at("Los kaartje € 12,50, vanaf 15 personen: € 10,00", "12,50")).toBeNull();
    expect(at("Los kaartje € 12,50, vanaf 15 personen: € 10,00", "10,00")).toBe(15);
    expect(at("Voor scholen vanaf 25 personen is er een arrangement. Een kaartje kost € 12,50", "12,50")).toBeNull();
    expect(minimumPeople("boekbaar op gewenste moment voor groepen van 12+ of minimum betaling mogelijk, €15+ pp")).toBe(12);
  });

  it("keeps the minimum with the price and says it on the place's line, whatever the model saw", () => {
    const [price] = verifiedPrices(picked(15), [item("Spookwandeling. Vanaf 12 personen v.a. € 15.00 p.p.")], "nl");
    expect(price).toMatchObject({ amount: 15, text: "€15", label: "vanaf 12 personen", minPeople: 12 });
    expect(verifiedPrices(picked(40, 2), [item("Een duo-les kost € 40")], "nl")[0]).toMatchObject({ minPeople: 2, label: "per persoon" });
    expect(normalizePlaces([{ name: "Get Events", city: "Utrecht", url: "https://a.test/", note: "", price }])?.[0].price?.minPeople).toBe(12);
  });

  it("does not show it as the idea's price, from the price nor from the note; a single ticket elsewhere does count", () => {
    const group = { name: "Get Events", city: "Utrecht", url: "https://a.test/", note: "voor groepen van 12+, €15 pp", price: { amount: 15, text: "€15", label: "vanaf 12 personen", source: "https://a.test/", minPeople: 12 } };
    const single = { name: "StoryTrail", city: "Utrecht", url: "https://b.test/", note: "", price: { amount: 12.5, text: "€12,50", label: "volwassene", source: "https://b.test/" } };
    expect(priceKind("€15", { places: [group, single] })).toBe("unconfirmed");
    expect(priceKind("€12,50", { places: [group, single] })).toBe("found");
  });

  it("gives the writer the option anybody can book first", async () => {
    const pages: Record<string, string> = { "https://group.test/": "<p>Vanaf 12 personen v.a. € 15.00 p.p.</p>", "https://single.test/": "<p>Een kaartje voor een volwassene kost € 12,50.</p>" };
    const fetcher: Fetcher = async (url) => (pages[url] === undefined ? { status: 404, text: async () => "" } : { status: 200, text: async () => pages[url] });
    const call: ModelCall = async ({ user }) => ({
      prices: [...user.matchAll(/## Item (\d+)[\s\S]*?(?=## Item|$)/g)].map((m) => ({ n: Number(m[1]), amount: m[0].includes("12,50") ? 12.5 : 15, what: "kaartje", min_people: null })),
    });
    const found = await addPrices(new Map([["spookwandeling", { activityId: "spookwandeling", source: "search" as const, options: [option({ name: "Get Events", url: "https://group.test/" }), option({ name: "StoryTrail", url: "https://single.test/" })] }]]), { locale: "nl", memo: createPriceMemo(), fetcher, call });
    expect(found.get("spookwandeling")!.options.map((o) => o.name)).toEqual(["StoryTrail", "Get Events"]);
  });
});

describe("3. the duration the provider states stays", () => {
  const cuddle = (note: string, duration: string) => entry({ activity_id: "koeknuffelen", practical: { estimated_cost: "€25", duration, difficulty: "easy", preparation: "" }, places: [{ name: "KnuffelKoe enzo", city: "Eemdijk", url: "https://koe.test/", note }] });
  const activity = getActivity("koeknuffelen")!;

  it("leaves 2 hours when the place says about 2 hours", () => {
    expect(timeChipConflict(cuddle("Workshop zaterdag 10:30 of 13:30 uur, ongeveer 2 uur, €25 per persoon", "2 uur"), activity)).toBeNull();
  });

  it("still corrects a duration no place states; a starting time is no duration", () => {
    expect(timeChipConflict(cuddle("Workshop zaterdag 10:30 of 13:30 uur", "2 uur"), activity)).not.toBeNull();
    expect(timeChipConflict(cuddle("Duurt ongeveer 45 minuten", "2 uur"), activity)).not.toBeNull();
  });
});

describe("4. the price of an app is not the price of the activity", () => {
  // The text of the real page, with "Premium" a good hundred characters before the amount.
  const route = "De Premium routes vind je in de Fietsnetwerk App in het inspiratiescherm. Je kunt ze direct aanschaffen voor slechts € 4,- per route.";

  it("knows an app page from a tour that comes with an app", () => {
    expect(isAppPage("https://www.fietsnetwerk.nl/fiets-app/")).toBe(true);
    expect(isAppPage("https://a.test/premium")).toBe(true);
    expect(isAppPage("https://a.test/self-guided-tour-met-app/")).toBe(false);
    expect(isAppPage("https://a.test/appeltaart-workshop")).toBe(false);
  });

  it("takes no amount from such a page, nor one the page calls premium", () => {
    expect(verifiedPrices(picked(4), [item("De route kost € 4,00", "https://www.fietsnetwerk.nl/fiets-app/")], "nl")).toEqual([null]);
    expect(verifiedPrices(picked(4), [item(route)], "nl")).toEqual([null]);
    expect(verifiedPrices(picked(17.5), [item("De zelfgeleide tour met app kost € 17,50")], "nl")[0]?.amount).toBe(17.5);
  });
});

describe("5. an idea page never runs into the footer", () => {
  const SCORES = { relevance: 70, novelty: 60, feasibility: 75, surprise: 50, shareability: 60, effort: 50, cost: 40, social_fit: 60, challenge_level: 50 };
  const long = (n: number) => "Vraag vooraf bij de organisatie na waar je precies moet zijn en wat je zelf meeneemt. ".repeat(n).trim();
  const full = (i: number, text: number): IdeaBookEntry =>
    entry({
      activity_id: "boogschieten",
      title: text > 1 ? "Een heel lange titel over een middag boogschieten bij de vereniging net buiten de stad" : "Boogschieten",
      intro: long(text > 1 ? 3 : 1),
      why_it_fits: long(text),
      details: [long(text), long(text), long(text)],
      first_action: long(text),
      requirements: ["Aanmelding vooraf", "Dichte schoenen"],
      practical: { estimated_cost: "€22,50", duration: "Een halve dag", difficulty: "moderate", preparation: long(text) },
      location: { name: text > 1 ? "Boogschietvereniging Handboogsport Utrecht en omstreken, afdeling buitenbaan" : "De baan", city: "Utrecht", address: "" },
      photo_category: "social_games",
      door: i < 2 ? "natural" : "discovery",
      scores: SCORES,
    });
  const book = (text: number): GeneratedIdeaBook => ({
    profile_summary: "Samenvatting.",
    must_haves: [],
    preferences: [],
    ideas: [0, 1, 2, 3].map((i) => full(i, text)),
    wildcard: { ...full(4, text), door: "wildcard" },
    labels: { steps_heading: "", first_action_heading: "", wildcard_heading: "", time_label: "", cost_label: "", location_heading: "", requirements_heading: "" },
  });

  /** Every line the PDF writes below the idea area (56 pt from the bottom), where only the footer belongs. */
  async function lowText(b: GeneratedIdeaBook): Promise<string[]> {
    const original = PDFPage.prototype.drawText;
    const low: string[] = [];
    PDFPage.prototype.drawText = function (this: PDFPage, text, options) {
      if ((options?.y ?? 100) < 50) low.push(text);
      return original.call(this, text, options);
    };
    try {
      await renderIdeaBookPdf(b, "Titel", "nl", { company: ["partner", "friends", "family"] });
    } finally {
      PDFPage.prototype.drawText = original;
    }
    return low;
  }

  it("leaves out blocks until the longest texts fit", async () => {
    expect(await lowText(book(8))).toEqual(await lowText(book(1)));
  }, 60_000);
});
