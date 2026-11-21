import { describe, expect, it } from "vitest";
import { CRITERIA, bookCriteria, criteriaSummary, inventedFacts, type CriteriaContext } from "@/lib/claude/bookCriteria";
import { autoFix, inventedSentences, qaBook, thinParts } from "@/lib/claude/qualityGate";
import { resolveConstraints } from "@/lib/discovery/engine/constraints";
import { syntheticTwoPageProfiles } from "@/lib/discovery/engine/syntheticTwoPages";
import { ALL_ACTIVITIES } from "@/lib/discovery/library";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

// C1 (docs/plan-activiteitenselectie.md, the reference's 4.4): the six criteria on a finished book.

const base = syntheticTwoPageProfiles(1, "criteria")[0].input;
const open = resolveConstraints({ ...base, budget: "allin", effort: "committed", mustHaves: "", searchContext: undefined, ageCategory: "" });
const strict = resolveConstraints({ ...base, budget: "free", effort: "minimal", mustHaves: "", searchContext: undefined, ageCategory: "" });
const month = new Date().getMonth() + 1;
const ctx = (over: Partial<CriteriaContext> = {}): CriteriaContext => ({ constraints: { ...open, month: null }, ...over });

// Activities that are plain enough to test with: cheap, common, safe, and one that is not.
const cheap = ALL_ACTIVITIES.find((a) => a.id === "tekenen") ?? ALL_ACTIVITIES.find((a) => a.cost === 0 && a.safety.tier === 0 && !a.months)!;
const dear = ALL_ACTIVITIES.find((a) => a.cost === 3 && !a.months)!;
const entryFor = (activityId: string, over: Partial<IdeaBookEntry> = {}): IdeaBookEntry =>
  ({
    title: "Een idee",
    intro: "Een middag waarin je iets nieuws probeert.",
    why_it_fits: "Je koos dit zelf.",
    details: ["Zoek een rustige plek en haal je spullen bij elkaar.", "Neem de tijd om het rustig te proberen."],
    first_action: "Pak vandaag nog papier en een potlood en begin.",
    practical: { estimated_cost: "€10", duration: "2 uur", difficulty: "easy", preparation: "" },
    location: null,
    requirements: [],
    image_suggestion: "",
    photo_category: "creative_workshop",
    door: "natural",
    scores: {},
    activity_id: activityId,
    reasons: ["picked", "direction:familiar"],
    places: [{ name: "Atelier", city: "Utrecht", url: "https://atelier.example.org", note: "Proefles €10" }],
    ...over,
  }) as unknown as IdeaBookEntry;
const bookOf = (e: IdeaBookEntry): GeneratedIdeaBook => ({ profile_summary: "S.", must_haves: [], preferences: [], ideas: [e], wildcard: { ...e, door: "wildcard" }, labels: {} as never });

describe("the six criteria on a book", () => {
  it("passes a complete, suitable idea with a verified place on all six, and says so in the summary", () => {
    const report = bookCriteria(bookOf(entryFor(cheap.id)), ctx());
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(report.checked);
    expect(criteriaSummary(report)).toBe(`criteria:${report.checked}/${report.checked}`);
    for (const c of CRITERIA) expect(report.perCriterion[c].checked).toBeGreaterThan(0);
  });

  it("exists: fails an activity that is not in the library, and an idea without a way in", () => {
    expect(bookCriteria(bookOf(entryFor("does-not-exist")), ctx()).failures.some((f) => f.criterion === "exists")).toBe(true);
    const noWay = bookCriteria(bookOf(entryFor(dear.id, { places: [] })), ctx());
    expect(noWay.failures.some((f) => f.criterion === "exists")).toBe(true);
    // the person's own choice keeps its place in the book, with an honest note
    expect(bookCriteria(bookOf(entryFor(dear.id, { places: [] })), ctx({ ownPicks: new Set([dear.id]) })).failures.some((f) => f.criterion === "exists")).toBe(false);
  });

  it("audience: fails an activity that breaks a hard limit of this person (the same limits the selection uses)", () => {
    const report = bookCriteria(bookOf(entryFor(dear.id)), ctx({ constraints: { ...strict, month: null } }));
    expect(report.failures.some((f) => f.criterion === "audience")).toBe(true);
  });

  it("concrete: fails an idea that is too thin to act on", () => {
    const thin = entryFor(cheap.id, { first_action: "Begin.", details: ["Een."] });
    expect(thinParts(thin)).toEqual(expect.arrayContaining(["first step", "steps"]));
    expect(bookCriteria(bookOf(thin), ctx()).failures.some((f) => f.criterion === "concrete")).toBe(true);
    expect(thinParts(entryFor(cheap.id))).toEqual([]);
  });

  it("feasible: fails an estimate far above the budget the person gave", () => {
    const report = bookCriteria(bookOf(entryFor(cheap.id, { practical: { estimated_cost: "€400", duration: "2 uur", difficulty: "easy", preparation: "" } })), ctx({ budget: "25" }));
    expect(report.failures.some((f) => f.criterion === "feasible")).toBe(true);
  });

  it("relation: fails an ordinary idea with no recorded relation, never a wildcard, an own choice or an idea with a direction", () => {
    const noRelation = entryFor(cheap.id, { reasons: ["direction:adjacent"] });
    expect(bookCriteria(bookOf(noRelation), ctx()).failures.some((f) => f.criterion === "relation" && f.where === "idea1")).toBe(true);
    expect(bookCriteria(bookOf(noRelation), ctx()).failures.some((f) => f.criterion === "relation" && f.where === "wildcard")).toBe(false);
    expect(bookCriteria(bookOf(noRelation), ctx({ ownPicks: new Set([cheap.id]) })).failures.some((f) => f.criterion === "relation")).toBe(false);
    expect(bookCriteria(bookOf({ ...noRelation, direction: "natuur" }), ctx()).failures.some((f) => f.criterion === "relation" && f.where === "idea1")).toBe(false);
  });

  it("checks the companions too: one that does not suit the person fails 'audience'", () => {
    const withCompanion = entryFor(cheap.id, { related: [{ id: dear.id, label: "Duur", facts: "x" }], direction: "natuur" });
    const report = bookCriteria(bookOf(withCompanion), ctx({ constraints: { ...strict, month: null } }));
    expect(report.failures.some((f) => f.criterion === "audience" && f.activityId === dear.id)).toBe(true);
    expect(report.perCriterion.audience.checked).toBeGreaterThan(2);
  });

  it("counts how the book can be done: ideas by yourself and ideas that have to be organised first", () => {
    const report = bookCriteria(bookOf(entryFor(cheap.id)), ctx());
    expect(report.modes.self + report.modes.organise).toBeLessThanOrEqual(2);
  });
});

describe("nothing invented", () => {
  const e = (over: Partial<IdeaBookEntry>) => entryFor(cheap.id, over);

  it("finds a phone number, opening hours and a link the research did not find, and lets ordinary text through", () => {
    expect(inventedFacts(e({ details: ["Bel 030 123 4567 voor een afspraak.", "Neem de tijd."] }))).not.toEqual([]);
    expect(inventedFacts(e({ intro: "Het atelier is geopend van 9.00 tot 17.00 uur." }))).not.toEqual([]);
    const hosts = new Set(["atelier.example.org"]);
    expect(inventedFacts(e({ first_action: "Kijk op https://onbekend.example.com voor tijden." }), hosts)).not.toEqual([]);
    expect(inventedFacts(e({ first_action: "Kijk op https://atelier.example.org voor tijden." }), hosts)).toEqual([]);
    expect(inventedFacts(e({ details: ["Neem 2 uur de tijd en maak 3 schetsen op 12-05.", "Bewaar je beste werk."] }))).toEqual([]);
    expect(inventedFacts(e({ intro: "Een proefles kost €900." }))).not.toEqual([]);
  });

  it("is taken out by the repair that needs no model, sentence by sentence, and never empties a field", () => {
    const entry = e({ details: ["Bel 030 123 4567 voor een afspraak. Neem je spullen mee.", "Het atelier is geopend van 9.00 tot 17.00 uur."], intro: "Je kunt bellen op 06 12345678." });
    expect(inventedSentences(entry.details[0])).toHaveLength(1);
    const fixed = autoFix(bookOf(entry), "nl");
    const idea = fixed.book.ideas[0];
    expect(idea.details[0]).toBe("Neem je spullen mee.");
    // a field made only of the invented claim is left as it was (the gate reports it), not emptied
    expect(idea.details[1].length).toBeGreaterThan(0);
    expect(idea.intro.length).toBeGreaterThan(0);
    expect(fixed.fixes.some((x) => x.endsWith("invented_fact_removed"))).toBe(true);
  });

  it("is reported by the quality gate as 'invented_fact' (repaired without a model) and a thin idea as 'incomplete' (rewritten)", () => {
    const issues = qaBook(bookOf(e({ intro: "Bel 030 123 4567.", first_action: "Begin.", details: ["Een."] })), { locale: "nl", month });
    const invented = issues.find((i) => i.code === "invented_fact");
    const incomplete = issues.find((i) => i.code === "incomplete");
    expect(invented?.needsRewrite).toBe(false);
    expect(incomplete?.needsRewrite).toBe(true);
    expect(qaBook(bookOf(e({})), { locale: "nl", month }).some((i) => i.code === "invented_fact" || i.code === "incomplete")).toBe(false);
  });
});
