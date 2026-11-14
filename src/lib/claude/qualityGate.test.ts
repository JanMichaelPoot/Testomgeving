import { describe, expect, it } from "vitest";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import {
  autoFix,
  coverageOf,
  exposedReasoning,
  onlineStart,
  qaBook,
  repeatedSentences,
  rewriteTargets,
  seasonProblems,
  splitSentences,
  stripExposed,
  timeChipConflict,
  typeSettingConflict,
  type QaContext,
} from "./qualityGate";
import { getActivity } from "@/lib/discovery/library";

const CTX: QaContext = { locale: "nl", month: 10, budget: "100", timeAvailable: "halfday" };

function idea(title: string, extra: Partial<IdeaBookEntry> = {}): IdeaBookEntry {
  return {
    title,
    intro: `Een korte kennismaking met ${title}.`,
    why_it_fits: `Dit sluit aan bij wat jij zocht met ${title}.`,
    details: [`Zoek een plek voor ${title} in de buurt.`, `Boek een eerste les voor ${title}.`],
    first_action: `Open de website van ${title} en boek een proefles voor volgende week.`,
    practical: { estimated_cost: "€40", duration: "Een halve dag", difficulty: "easy", preparation: "" },
    location: null,
    requirements: [],
    image_suggestion: "",
    photo_category: "creative_workshop",
    door: "natural",
    scores: { relevance: 70, novelty: 60, feasibility: 75, surprise: 50, shareability: 60, effort: 50, cost: 40, social_fit: 60, challenge_level: 50 },
    ...extra,
  } as IdeaBookEntry;
}

function book(ideas: IdeaBookEntry[], wildcard = idea("Wildcard")): GeneratedIdeaBook {
  return {
    profile_summary: "Je zoekt rust.",
    must_haves: [],
    preferences: [],
    ideas,
    wildcard,
    labels: { steps_heading: "", first_action_heading: "", wildcard_heading: "", time_label: "", cost_label: "", location_heading: "", requirements_heading: "" },
  };
}

const six = () => ["A", "B", "C", "D", "E", "F"].map((t) => idea(`Idee ${t}`));

describe("exposed reasoning", () => {
  it("finds arrows and the phrases that show how an idea was found", () => {
    expect(exposedReasoning("Utrecht → Laren")).toContain("arrow");
    expect(exposedReasoning("A -> B")).toContain("arrow");
    expect(exposedReasoning("Onderweg kwamen we langs yoga: dat leiden wij uit je beelden af.").length).toBeGreaterThan(0);
    expect(exposedReasoning("Je koos zelf niet iets dat je zelf koos.").length).toBeGreaterThan(0);
    expect(exposedReasoning("Een rustige middag in de klei, met koffie erbij.")).toEqual([]);
  });

  it("strips the arrows and drops only the sentences that expose their reasoning", () => {
    expect(stripExposed("Loop van het station → het park.")).toBe("Loop van het station, het park.");
    const text = "Een middag in de klei. Onderweg kwamen we langs keramiek: dat leiden wij uit je beelden af. Neem een schort mee.";
    expect(stripExposed(text)).toBe("Een middag in de klei. Neem een schort mee.");
  });

  it("autoFix cleans every field of every idea and says so", () => {
    const dirty = book([idea("A", { intro: "Eerst dit → dan dat.", details: ["Stap 1 -> stap 2.", "Neutraal."] }), ...six().slice(1)]);
    const { book: clean, fixes } = autoFix(dirty, "nl");
    expect(clean.ideas[0].intro).toBe("Eerst dit, dan dat.");
    expect(clean.ideas[0].details[0]).toBe("Stap 1, stap 2.");
    expect(fixes.some((f) => f.startsWith("idea1:exposed_reasoning_removed"))).toBe(true);
    expect(qaBook(clean, CTX).filter((i) => i.code === "exposed_reasoning")).toEqual([]);
  });
});

describe("repeated sentences", () => {
  it("finds the same sentence on two ideas, ignoring case and punctuation, and not short ones", () => {
    const shared = "Het past bij de tijd die je hebt en het budget dat je opgaf.";
    const b = book([idea("A", { why_it_fits: `Mooi. ${shared}` }), idea("B", { why_it_fits: shared.toLowerCase().replace(".", "!") }), ...six().slice(2)]);
    const found = repeatedSentences(b);
    expect(found).toHaveLength(1);
    expect(found[0].where.sort()).toEqual(["idea1", "idea2"]);
    expect(repeatedSentences(book([idea("A", { details: ["Neem een jas mee."] }), idea("B", { details: ["Neem een jas mee."] })]))).toEqual([]);
  });

  it("asks for a rewrite of every idea but the first that carries the sentence", () => {
    const shared = "Dit is precies de zin die op twee ideeën staat gekopieerd.";
    const b = book([idea("A", { intro: shared }), idea("B", { intro: shared }), ...six().slice(2)]);
    const targets = rewriteTargets(qaBook(b, CTX));
    expect([...targets.keys()]).toEqual(["idea2"]);
  });
});

describe("season", () => {
  it("flags what cannot be done this month and lets the right season through", () => {
    expect(seasonProblems("Ga bloemen plukken bij een zelfpluktuin.", 1)).not.toEqual([]);
    expect(seasonProblems("Ga bloemen plukken bij een zelfpluktuin.", 7)).toEqual([]);
    expect(seasonProblems("Een uurtje schaatsen op de ijsbaan.", 7)).not.toEqual([]);
    expect(seasonProblems("Een uurtje schaatsen op de ijsbaan.", 12)).toEqual([]);
    expect(seasonProblems("Zwemmen in open water bij het strand", 2)).not.toEqual([]);
    expect(seasonProblems("Een rustige middag in de klei.", 1)).toEqual([]);
  });

  it("is an issue that needs a rewrite", () => {
    const b = book([idea("A", { intro: "Ga bloemen plukken bij een zelfpluktuin." }), ...six().slice(1)]);
    const issues = qaBook(b, { ...CTX, month: 1 }).filter((i) => i.code === "season");
    expect(issues).toHaveLength(1);
    expect(issues[0].needsRewrite).toBe(true);
  });
});

describe("chips", () => {
  const pottery = getActivity("houtbewerking")!; // indoor, half a day
  const running = getActivity("hardlopen")!; // outdoor, 1-3 hours

  it("an outdoor type on an indoor activity is a conflict, the matching one is not", () => {
    expect(typeSettingConflict(idea("A", { photo_category: "nature_outdoor" }), pottery)).toMatch(/indoors/);
    expect(typeSettingConflict(idea("A", { photo_category: "creative_workshop" }), pottery)).toBeNull();
    expect(typeSettingConflict(idea("A", { photo_category: "home_cozy" }), running)).toMatch(/outdoors/);
    expect(typeSettingConflict(idea("A"), undefined)).toBeNull();
  });

  it("a time chip that cannot be right for the activity is replaced by the activity's own duration", () => {
    const wrong = idea("Houtwerk", { activity_id: "houtbewerking", practical: { estimated_cost: "€40", duration: "30 minuten", difficulty: "easy", preparation: "" } });
    expect(timeChipConflict(wrong, pottery)).not.toBeNull();
    const fixed = autoFix(book([wrong, ...six().slice(1)]), "nl");
    expect(fixed.book.ideas[0].practical.duration).toBe("Een halve dag");
    expect(fixed.fixes).toContain("idea1:time_chip_from_activity");
    // A chip that agrees, or one that cannot be read, is left alone.
    expect(timeChipConflict(idea("A", { activity_id: "houtbewerking", practical: { estimated_cost: "", duration: "Een halve dag", difficulty: "easy", preparation: "" } }), pottery)).toBeNull();
    expect(timeChipConflict(idea("A", { practical: { estimated_cost: "", duration: "Flexibel", difficulty: "easy", preparation: "" } }), pottery)).toBeNull();
  });
});

describe("coverage of what the person gave", () => {
  it("counts ideas that fill the time and ideas that use 40-100% of the budget, sizes included", () => {
    const filling = idea("A", { practical: { estimated_cost: "€45", duration: "Een halve dag", difficulty: "easy", preparation: "" } });
    const cheap = idea("B", { practical: { estimated_cost: "Gratis", duration: "Een uur", difficulty: "easy", preparation: "" } });
    const viaSize = idea("C", {
      practical: { estimated_cost: "Gratis", duration: "Een uur", difficulty: "easy", preparation: "" },
      sizes: [{ kind: "do", title: "Doen", description: "Een middag", estimated_cost: "€70", duration: "Een halve dag" }],
    } as Partial<IdeaBookEntry>);
    const c = coverageOf(book([filling, cheap, viaSize]), { budget: "100", timeAvailable: "halfday" });
    expect(c).toMatchObject({ timeApplicable: true, budgetApplicable: true });
    expect(c.timeFilled).toBe(3); // the wildcard (a half day for €40) counts as well
    expect(c.budgetUsed).toBe(3); // A (€45), C (€70 as the "do" size) and the wildcard (€40); B is free
  });

  it("is not applicable without a time or an uncapped budget, and the gate reports a book that uses neither", () => {
    expect(coverageOf(book(six()), { budget: "allin" }).budgetApplicable).toBe(false);
    expect(coverageOf(book(six()), {}).timeApplicable).toBe(false);
    const cheapBook = book(six().map((e) => ({ ...e, practical: { ...e.practical, estimated_cost: "Gratis", duration: "Een uur" } })), idea("W", { practical: { estimated_cost: "Gratis", duration: "Een uur", difficulty: "easy", preparation: "" } }));
    const codes = qaBook(cheapBook, CTX).map((i) => i.code);
    expect(codes).toContain("coverage_budget");
    expect(codes).toContain("coverage_time");
  });
});

describe("a clean book", () => {
  it("has no issues", () => {
    expect(qaBook(book(six()), CTX)).toEqual([]);
    expect(splitSentences("Eén. Twee woorden hier staan. Drie!")).toHaveLength(3);
  });
});

describe("an online start (physical first, online last)", () => {
  const places = [{ name: "Klei Atelier", city: "Utrecht", url: null, note: "proefles" }];
  const e = (first_action: string, details: string[] = ["Bel de studio.", "Neem een schort mee."], withPlace = true) => ({ first_action, details, places: withPlace ? places : [], location: null });

  it("flags a first step or detail that sends the person online while the idea lists a place to go to", () => {
    expect(onlineStart(e("Download de app Stop Motion Studio en maak je eerste tien seconden."))?.field).toBe("first_action");
    expect(onlineStart(e("Maak een gratis account aan op Soofos."))?.field).toBe("first_action");
    expect(onlineStart(e("Open maxvandaag.nl en start de online cursus bandplakken."))?.field).toBe("first_action");
    expect(onlineStart(e("Bel de studio.", ["Bestel een startset in de webshop.", "Kom langs."]))?.field).toBe("details[0]");
    expect(onlineStart(e("Bekijk de videolessen van de academie."))?.field).toBe("first_action");
  });

  it("leaves an idea alone whose only options are online: that is the last resort, so an online start is the way in", () => {
    const onlinePlace = [{ name: "MAX Vandaag", city: "Online", url: "https://www.maxvandaag.nl", note: "cursus" }];
    expect(onlineStart({ first_action: "Open maxvandaag.nl en start de online cursus.", details: ["Kijk de eerste video.", "Oefen een uur."], places: onlinePlace, location: null })).toBeNull();
    expect(onlineStart(e("Download de app en start.", ["Kijk.", "Oefen."], false))).toBeNull();
  });

  it("lets a visit, a call, a booking and 'Open Google Maps' pass", () => {
    for (const text of [
      "Bel Klei Atelier in Utrecht en vraag naar de proefles van zaterdag.",
      "Reserveer via de website van De Boog een plek voor de buurtmaaltijd.",
      "Open Google Maps, zoek paardenfokkerij bij Utrecht en bel de dichtstbijzijnde.",
      "Check de openingstijden van het museum en loop vanavond binnen.",
      "Call the studio and book a trial class.",
    ]) {
      expect(onlineStart(e(text)), text).toBeNull();
    }
  });

  it("is a qa issue that needs a rewrite, and a clean book has none", () => {
    const clean = book([idea("Aardewerk", { places }), idea("Schilderen")]);
    expect(qaBook(clean, CTX).filter((i) => i.code === "online_start")).toEqual([]);
    const online = book([idea("Aardewerk", { places, first_action: "Download de app en start de eerste les." }), idea("Schilderen")]);
    const issues = qaBook(online, CTX).filter((i) => i.code === "online_start");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ where: "idea1", needsRewrite: true });
  });
});

describe("the title must be true of the places found (Jan, 14 Nov 2026)", () => {
  const heath = [{ name: "Theehuis 't Bluk", city: "Laren", url: null, note: "Café op de hei met een high tea op afspraak." }];
  const highTea = (title: string, places = heath) => idea(title, { activity_id: "high-tea", places, location: null });

  it("flags a title that claims a country house when the only place found is a café on the heath", () => {
    const issues = qaBook(book([highTea("Een high tea in een landhuis")]), CTX).filter((i) => i.code === "title_place");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ where: "idea1", needsRewrite: false });
    expect(issues[0].detail).toContain("country house");
  });

  it("leaves a title alone that a found place shows, in its name or its note", () => {
    expect(qaBook(book([highTea("Een high tea op de hei")]), CTX).filter((i) => i.code === "title_place")).toEqual([]);
    expect(qaBook(book([highTea("High tea in een theehuis")]), CTX).filter((i) => i.code === "title_place")).toEqual([]);
    const manor = [{ name: "Landgoed De Hooge Vuursche", city: "Baarn", url: null, note: "Theeschenkerij in het koetshuis." }];
    expect(qaBook(book([highTea("High tea op een landgoed", manor)]), CTX).filter((i) => i.code === "title_place")).toEqual([]);
  });

  it("does nothing for a title without a claimed kind of place, or for an idea without found places", () => {
    expect(qaBook(book([highTea("Een middag high tea")]), CTX).filter((i) => i.code === "title_place")).toEqual([]);
    expect(qaBook(book([highTea("Een high tea in een landhuis", [])]), CTX).filter((i) => i.code === "title_place")).toEqual([]);
  });

  it("repairs it without a model: the activity's own name at the first found place", () => {
    const fixed = autoFix(book([highTea("Een high tea in een landhuis")]), "nl");
    expect(fixed.book.ideas[0].title).toBe("High tea bij Theehuis 't Bluk");
    expect(fixed.fixes).toContain("idea1:title_from_found_place");
    expect(qaBook(fixed.book, CTX).filter((i) => i.code === "title_place")).toEqual([]);
    const long = [{ name: "Het Bijzonder Lange Theehuis op de Heide van Laren en Blaricum", city: "Laren", url: null, note: "Café op de hei." }];
    expect(autoFix(book([highTea("High tea in een landhuis", long)]), "nl").book.ideas[0].title).toBe("High tea in Laren");
  });
});

describe("any other setting a title names has to turn up in the places (the measurement of 14 Nov 2026)", () => {
  const teds = { name: "Teds Utrecht", city: "Utrecht", url: null, note: "Original Afternoon Tea from €27.50 pp." };
  const ubica = { name: "Ubica Utrecht", city: "Utrecht", url: null, note: "High tea from €29 pp. Reservation required, can be served in historic wine cellar." };
  const combo = (places: typeof teds[]) => idea("High Tea in a Wine Cellar", { activity_id: "buitenplaats", reasons: ["hybrid:high-tea", "chain:high-tea>buitenplaats"], places, location: { name: "Ubica Utrecht", address: "", city: "Utrecht" } });

  it("lets a setting stand that a place's note shows, and flags one that no place shows", () => {
    expect(qaBook(book([combo([teds, ubica])]), CTX).filter((i) => i.code === "title_place")).toEqual([]);
    const issues = qaBook(book([combo([teds])]), CTX).filter((i) => i.code === "title_place");
    expect(issues).toHaveLength(1);
    expect(issues[0].detail).toContain("Wine Cellar");
  });

  it("repairs a combination with the plain name of its first half at the place the idea names", () => {
    const fixed = autoFix(book([combo([teds])]), "en");
    expect(fixed.book.ideas[0].title).toBe("High tea at Ubica Utrecht");
  });

  it("does not flag a place or a plain location after 'in' or 'bij'", () => {
    const plain = (title: string) => idea(title, { activity_id: "high-tea", places: [teds], location: null });
    for (const t of ["High tea in Utrecht", "High tea bij Teds Utrecht", "Een middag in de buurt"]) expect(qaBook(book([plain(t)]), CTX).filter((i) => i.code === "title_place"), t).toEqual([]);
  });
});
