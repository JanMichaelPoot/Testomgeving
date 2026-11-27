import { describe, expect, it, vi } from "vitest";
import { applyVerdict, buildFactPrompt, factCheck, fixAccepted, passages, quoteStands, readEvidence, standingQuote, unbackedPromise } from "@/lib/claude/factCheck";
import type { Fetcher } from "@/lib/claude/verifyUrls";
import type { ModelCall } from "@/lib/claude/qualityRepair";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { createCostLedger } from "@/lib/claude/costLedger";

// Step 250. The cases are from a generated book of 27 Nov 2026: a drone to borrow that no page offers, tools that "are there" at a farm
// whose page never mentions the work, next to claims the sites do carry.
const CLUB = `<main><h1>Dronerace Vereniging Midden-Nederland</h1><p>We trainen samen in FPV-droneracen: met het beeld vanuit je drone vlieg je zo snel mogelijk door een parcours.</p>
<a href="/agenda">Agenda</a><a href="/huisregels">Huisregels</a><a href="https://elders.test/beginners">Elders</a></main>`;
const AGENDA = `<p>Of je nou beginner bent of een ervaren prof, iedereen is welkom! Gratis parkeergelegenheid. De kosten voor deelname bedragen €8,50 per persoon.</p>`;
const PAGES: Record<string, string> = { "https://club.test/": CLUB, "https://club.test/agenda": AGENDA + "<p>" + "Zaterdagavond in een gymzaal. ".repeat(10) + "</p>" };
const fetcher: Fetcher = async (url) => (PAGES[url] === undefined ? { status: 404, text: async () => "" } : { status: 200, text: async () => PAGES[url] });
const SITE = "Dronerace Vereniging Midden-Nederland. We trainen samen in FPV-droneracen. Of je nou beginner bent of een ervaren prof, iedereen is welkom! Gratis parkeergelegenheid.";

const drone = (): IdeaBookEntry =>
  ({
    activity_id: "fpv-drone",
    title: "Droneracen (FPV) in Midden-Nederland",
    intro: "Je sluit aan bij een open trainingsavond van een droneclub en vliegt een geleende FPV-drone.",
    why_it_fits: "Je interesse in competitie bracht ons bij dit snelle spoor.",
    details: [
      "Meld je aan bij Dronerace Vereniging Midden-Nederland voor een trainingsavond voor beginners.",
      "Kom naar de trainingsavond, leen een drone van de club en volg de instructies voor je eerste vlucht.",
    ],
    first_action: "Open club.test en bekijk de eerstvolgende trainingsavond.",
    requirements: ["Aanmelding vooraf", "Gesloten schoenen"],
    practical: { estimated_cost: "€8,50", duration: "Een avond", difficulty: "moderate", preparation: "Meld je vooraf aan via de website." },
    places: [{ name: "Dronerace Vereniging Midden-Nederland", city: "Midden-Nederland", url: "https://club.test/", note: "Droneclub voor beginners, wekelijkse trainingsavonden" }],
    location: null,
  }) as unknown as IdeaBookEntry;

const OFFERS = "We trainen samen in FPV-droneracen";

describe("what the code decides itself", () => {
  it("accepts a quote only when it stands in what was read", () => {
    expect(quoteStands("Of je nou beginner bent of een ervaren prof, iedereen is welkom", SITE)).toBe(true);
    expect(quoteStands("of je nou BEGINNER bent  of een ervaren prof", SITE)).toBe(true);
    expect(quoteStands("Je kunt bij ons een drone lenen", SITE)).toBe(false);
    expect(quoteStands("welkom", SITE)).toBe(false); // too short to carry anything
  });

  it("sees a promise of something to borrow or gear that is there, when the site makes none", () => {
    expect(unbackedPromise("Kom naar de avond, leen een drone van de club.", SITE)).toBe(true);
    expect(unbackedPromise("Je vliegt een geleende FPV-drone.", SITE)).toBe(true);
    expect(unbackedPromise("Werk mee met snoeien; gereedschap is aanwezig.", "Word vrijwilliger in de tuin.")).toBe(true);
    // a menu with "Verhuur" (of rooms, for parties) is no tools: this hid a real case on a city farm's site
    const menu = "Projecten Horeca en verhuur Terug Verhuur Kinderfeestje Boerderijwinkels Nieuws Word vrijwilliger";
    expect(unbackedPromise("Werk mee; gereedschap is aanwezig.", menu)).toBe(true);
    expect(unbackedPromise("Leen een drone van de club.", menu)).toBe(true);
    expect(unbackedPromise("Leen een drone van de club.", "Verhuur van drones voor beginners.")).toBe(false);
    expect(unbackedPromise("Leen een drone van de club.", `${SITE} We hebben leendrones voor nieuwe leden.`)).toBe(false);
    expect(unbackedPromise("Gereedschap is aanwezig.", "Al het gereedschap is bij ons aanwezig.")).toBe(false);
    // ordinary words and sentences that promise nothing
    expect(unbackedPromise("Ga alleen en bekijk de eerstvolgende beschikbare datum.", SITE)).toBe(false);
    expect(unbackedPromise("Neem je eigen gereedschap mee.", SITE)).toBe(false);
  });

  it("keeps the passages about the idea when a page is long", () => {
    const long = `Welkom. ${"Over onze geschiedenis. ".repeat(200)} Beginners kunnen een drone lenen. ${"Nieuws van de club. ".repeat(200)}`;
    const out = passages(long, ["drone"], 1500);
    expect(out.length).toBeLessThanOrEqual(1500);
    expect(out).toContain("Beginners kunnen een drone lenen");
  });

  it("reads the place's own page and its pages about taking part", async () => {
    const { evidence, full } = await readEvidence(drone(), "nl", fetcher);
    expect(evidence.map((e) => e.url)).toEqual(["https://club.test", "https://club.test/agenda"].map((u) => expect.stringContaining(u.replace("https://", ""))));
    expect(full).toContain("iedereen is welkom");
  });
});

describe("applying the verdict", () => {
  const claims = [
    { field: "intro", claim: "vliegt een geleende FPV-drone", quote: "" },
    // a real quote that has nothing to do with the claim
    { field: "details[1]", claim: "leen een drone van de club", quote: "Gratis parkeergelegenheid" },
    { field: "details[0]", claim: "trainingsavond voor beginners", quote: "Of je nou beginner bent of een ervaren prof, iedereen is welkom" },
    { field: "places[0].note", claim: "wekelijkse trainingsavonden", quote: "Elke week trainen wij" },
  ];

  it("takes out what the site does not carry and leaves the rest as written", () => {
    const { entry, removed, offered } = applyVerdict(
      drone(),
      {
        offers: OFFERS,
        claims,
        fixes: [
          { field: "intro", text: "Je sluit aan bij een trainingsavond van een droneclub en vraagt of je een drone kunt gebruiken." },
          { field: "details[1]", text: "Kom naar de trainingsavond en vraag vooraf wat je zelf moet meenemen om te vliegen." },
          { field: "places[0].note", text: "Droneclub voor beginners met trainingsavonden" },
        ],
      },
      SITE,
      "nl",
    );
    expect(offered).toBe(true);
    expect(entry.intro).toContain("vraagt of je een drone kunt gebruiken");
    expect(entry.details[1]).not.toMatch(/leen/i);
    expect(entry.details[0]).toBe(drone().details[0]);
    expect(entry.places![0].note).toBe("Droneclub voor beginners met trainingsavonden");
    expect(entry.practical).toEqual(drone().practical);
    expect(removed.length).toBe(3);
  });

  it("uses a fixed honest sentence when the rewrite is refused or missing", () => {
    const { entry, fallbacks } = applyVerdict(
      drone(),
      {
        offers: OFFERS,
        claims,
        // still lends; and one that adds a new fact
        fixes: [
          { field: "intro", text: "Je leent een drone bij de club en vliegt mee." },
          { field: "details[1]", text: "Kom op 12 januari om 19:00 naar de hal." },
        ],
      },
      SITE,
      "nl",
    );
    expect(fallbacks).toBe(3);
    for (const text of [entry.intro, ...entry.details, entry.places![0].note]) expect(text).not.toMatch(/leen|geleend|12 januari|wekelijks/i);
    expect(entry.intro.length).toBeGreaterThan(20);
    expect(entry.details).toHaveLength(2);
  });

  it("catches a promise the model did not list", () => {
    const { entry, removed } = applyVerdict(drone(), { offers: OFFERS, claims: [], fixes: [] }, SITE, "nl");
    expect(JSON.stringify([entry.intro, entry.details])).not.toMatch(/leen|geleend/i);
    expect(removed.length).toBeGreaterThanOrEqual(2);
  });

  it("does not let the first step read as an offer when nothing shows the activity is offered there", () => {
    const farm = { ...drone(), activity_id: "knotten-heggenvlechten", intro: "Je knot wilgen op een stadsboerderij.", details: ["Meld je aan voor een werkdag knotten.", "Kom en werk mee."], places: [{ name: "Stadsboerderij Griftsteede | Utrecht Natuurlijk", city: "Utrecht", url: "https://boerderij.test/", note: "" }] } as unknown as IdeaBookEntry;
    const { entry, offered } = applyVerdict(farm, { offers: "", claims: [{ field: "intro", claim: "Je knot wilgen", quote: "" }], fixes: [] }, "Word vrijwilliger en werk mee in de tuin.", "nl");
    expect(offered).toBe(false);
    expect(entry.details[0]).toBe("Vraag Stadsboerderij Griftsteede of zij dit aanbieden en wanneer je mee kunt.");
    expect(entry.intro).not.toContain("knot wilgen op een stadsboerderij");
  });

  it("refuses a rewrite in another language or with a new name", () => {
    const before = "Kom naar de trainingsavond en volg de instructies van de club.";
    expect(fixAccepted(before, "Come to the training night and follow the instructions of the club.", [], SITE, "nl", "")).toBe(false);
    expect(fixAccepted(before, "Kom naar de trainingsavond bij Skyracers en volg de instructies.", [], SITE, "nl", "")).toBe(false);
    expect(fixAccepted(before, "Kom naar de trainingsavond en vraag wat je zelf moet meenemen.", [], SITE, "nl", "")).toBe(true);
  });

  it("drops the written timeline when one of its lines claimed something, and a requirement that did", () => {
    const withFill = { ...drone(), requirements: ["Leendrone van de club", "Gesloten schoenen"], fill: { timeline: ["Je krijgt een drone en materiaal is aanwezig", "b", "c", "d"], takeaways: ["a", "b", "c"], suggestions: ["a", "b", "c"] } } as unknown as IdeaBookEntry;
    const { entry } = applyVerdict(withFill, { offers: OFFERS, claims: [], fixes: [] }, SITE, "nl");
    expect(entry.fill).toBeUndefined();
    expect(entry.requirements).toEqual(["Gesloten schoenen"]);
  });
});

describe("a whole book", () => {
  const bare = { ...drone(), places: undefined, intro: "Je schrijft thuis.", details: ["Pak pen en papier.", "Schrijf een bladzijde."] } as unknown as IdeaBookEntry;
  const book = { profile_summary: "", must_haves: [], preferences: [], ideas: [drone(), bare], wildcard: bare, labels: {} } as unknown as GeneratedIdeaBook;

  it("judges only ideas with a place, and counts the cost", async () => {
    const call = vi.fn<ModelCall>(async ({ onUsage }) => {
      onUsage?.({ input_tokens: 5000, output_tokens: 600 }, "claude-haiku-4-5-20251001");
      return { offers: OFFERS, claims: [], fixes: [] };
    });
    const ledger = createCostLedger();
    const { book: out, report } = await factCheck(book, { locale: "nl", ledger, fetcher, call });
    expect(call).toHaveBeenCalledTimes(1);
    expect(report.checked).toBe(1);
    expect(ledger.spentUsd()).toBeCloseTo(0.008, 4);
    expect(out.ideas[1]).toBe(bare);
    expect(JSON.stringify(out.ideas[0].details)).not.toMatch(/leen/i);
  });

  it("fails soft: no answer or no readable site leaves the idea as written", async () => {
    const noAnswer = await factCheck(book, { locale: "nl", fetcher, call: async () => null });
    expect(noAnswer.book.ideas[0].details).toEqual(drone().details);
    expect(noAnswer.report.unjudged[0]).toContain("no usable answer");
    const noSite = await factCheck(book, { locale: "nl", fetcher: async () => ({ status: 500, text: async () => "" }), call: async () => ({ offers: "", claims: [], fixes: [] }) });
    expect(noSite.report.unjudged[0]).toContain("no readable website");
    expect(noSite.book.ideas[0].intro).toBe(drone().intro);
    const broken = await factCheck(book, { locale: "nl", fetcher, call: async () => Promise.reject(new Error("down")) });
    expect(broken.report.unjudged[0]).toContain("down");
  });
});

// What the first real run of the cheap model showed (27 Nov 2026): each of these was a fault of the code, not of the model.
describe("what the first real run showed", () => {
  it("does not take asking for promising, so a good rewrite is not thrown away", () => {
    expect(unbackedPromise("Kom naar de avond, vraag of je een drone kunt lenen van de club en volg de instructies.", SITE)).toBe(false);
    expect(unbackedPromise("Vraag of gereedschap aanwezig is.", SITE)).toBe(false);
    expect(unbackedPromise("Kun je er een drone lenen?", SITE)).toBe(false);
    expect(unbackedPromise("Ask whether you can borrow a drone.", SITE)).toBe(false);
    // a promise next to a question is still a promise
    expect(unbackedPromise("Vraag wat je meeneemt, en leen een drone van de club.", SITE)).toBe(true);
    expect(unbackedPromise("Bekijk de agenda en leen een drone van de club.", SITE)).toBe(true);
  });

  it("accepts real sentences that do not stand next to each other, and lets no made-up part back anything", () => {
    const page = "Het wemelt van de katten, het zijn er zeven. Veel posters. Je drinkt er koffie en eet vegan gebak. Meer over het ontwerp. De minimale leeftijd is zes jaar.";
    expect(quoteStands("Het wemelt van de katten, het zijn er zeven. Je drinkt er koffie en eet vegan gebak. De minimale leeftijd is zes jaar.", page)).toBe(true);
    expect(quoteStands("Het wemelt van de katten, het zijn er zeven … De minimale leeftijd is zes jaar", page)).toBe(true);
    expect(quoteStands("Je drinkt er koffie en eet vegan gebak. Je mag de katten gratis voeren.", page)).toBe(false);
    // a scrap too short to be checked is dropped, so it cannot carry a promise of something to borrow
    expect(standingQuote("Je drinkt er koffie en eet vegan gebak. Wij lenen.", page)).toBe("Je drinkt er koffie en eet vegan gebak.");
    const { entry } = applyVerdict(drone(), { offers: OFFERS, claims: [{ field: "details[1]", claim: "leen een drone van de club", quote: "Of je nou beginner bent of een ervaren prof. Drone lenen." }], fixes: [] }, SITE, "nl");
    expect(entry.details[1]).not.toMatch(/leen/i);
  });

  it("shows the model a sentence with a price also when no word of the idea is near it", () => {
    const long = `Welkom bij ons. ${"Over de buurt en de makers. ".repeat(150)} Een tweegangendiner kost €12, lunch €7. ${"Nieuws en agenda. ".repeat(150)}`;
    const out = passages(long, ["onbeke"], 3000);
    expect(out).toContain("Een tweegangendiner kost €12");
    expect(out.length).toBeGreaterThan(2500);
    expect(out.length).toBeLessThanOrEqual(3000);
  });

  it("does not ask the model about the list of what to bring, and ignores what it says about it", () => {
    const e = { ...drone(), requirements: ["Gesloten schoenen", "Leendrone van de club"] } as IdeaBookEntry;
    expect(buildFactPrompt(e, [], "nl")).not.toContain("Gesloten schoenen");
    const { entry } = applyVerdict(e, { offers: OFFERS, claims: [{ field: "requirements[0]", claim: "Gesloten schoenen", quote: "" }], fixes: [] }, SITE, "nl");
    // the advice stays; the promise to borrow is still taken out by the code
    expect(entry.requirements).toEqual(["Gesloten schoenen"]);
  });

  it("lets a rewrite name the provider's own address, and no other", () => {
    const known = "Droneracen https://www.club.test/agenda";
    expect(fixAccepted("Kijk waar de avond is.", "Kijk op club.test waar de avond is.", [], SITE, "nl", known)).toBe(true);
    expect(fixAccepted("Kijk waar de avond is.", "Kijk op anders.nl waar de avond is.", [], SITE, "nl", known)).toBe(false);
  });

  it("asks whether the activity can be done there when nothing shows it, whatever the model wrote", () => {
    const { entry } = applyVerdict(drone(), { offers: "", claims: [{ field: "details[0]", claim: "trainingsavond voor beginners", quote: "" }], fixes: [{ field: "details[0]", text: "Meld je aan om te vragen of je mee kunt doen aan een avond." }] }, SITE, "nl");
    expect(entry.details[0]).toBe("Vraag Dronerace Vereniging Midden-Nederland of zij dit aanbieden en wanneer je mee kunt.");
  });
});

describe("what the second real run showed", () => {
  it("refuses a rewrite with a doubled word, and gives a short line room to become honest", () => {
    const before = "Loop binnen bij Kat & Bakkie, of reserveer vooraf een plek.";
    expect(fixAccepted(before, "Kijk of je kunt binnenlopen, of of je beter vooraf reserveert.", [], SITE, "nl", "")).toBe(false);
    expect(fixAccepted("Geen, gewoon aanschuiven.", "Je hoeft van tevoren niets te regelen; voor de meeste evenementen hoef je niet te reserveren.", [], SITE, "nl", "")).toBe(true);
  });

  it("takes no rewrite from the model for an idea whose activity nothing shows", () => {
    const { entry } = applyVerdict(
      drone(),
      { offers: "", claims: [{ field: "intro", claim: "vliegt een geleende FPV-drone", quote: "" }], fixes: [{ field: "intro", text: "Je kunt op een avond meewerken aan projecten van de club." }] },
      SITE,
      "nl",
    );
    expect(entry.intro).toBe("Vraag bij Dronerace Vereniging Midden-Nederland na wat je daar kunt doen.");
  });
});
