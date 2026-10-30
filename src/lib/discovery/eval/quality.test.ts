import { describe, expect, it } from "vitest";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { checkBook } from "./checks";
import { summariseQuality } from "./quality";

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

const book = (ideas: IdeaBookEntry[]): GeneratedIdeaBook => ({
  profile_summary: "Je zoekt rust.",
  must_haves: [],
  preferences: [],
  ideas,
  wildcard: idea("Wildcard"),
  labels: { steps_heading: "", first_action_heading: "", wildcard_heading: "", time_label: "", cost_label: "", location_heading: "", requirements_heading: "" },
});

const CTX = { locale: "nl" as const, month: 10, budget: "100", timeAvailable: "halfday" };
const clean = () => book(["A", "B", "C", "D", "E", "F"].map((t) => idea(`Idee ${t}`)));

describe("the quality checks of a written book", () => {
  it("find nothing in a clean book and need no context to run the older checks", () => {
    expect(checkBook(clean(), "P1", CTX).filter((f) => f.check.startsWith("quality:"))).toEqual([]);
    expect(checkBook(clean(), "P1").some((f) => f.check.startsWith("quality:"))).toBe(false);
  });

  it("make exposed reasoning and a repeated sentence errors, and the rest warnings", () => {
    const b = clean();
    b.ideas[0] = idea("A", { intro: "Van het station → het park." });
    const shared = "Dit is precies de zin die op twee ideeën staat gekopieerd.";
    b.ideas[1] = idea("B", { why_it_fits: shared });
    b.ideas[2] = idea("C", { why_it_fits: shared, intro: "Ga bloemen plukken bij een zelfpluktuin." });
    const findings = checkBook(b, "P1", { ...CTX, month: 1 });
    const bySeverity = (check: string) => findings.filter((f) => f.check === check).map((f) => f.severity);
    expect(bySeverity("quality:exposed_reasoning")).toEqual(["error"]);
    expect(bySeverity("quality:repeated_sentence")).toEqual(["error"]);
    expect(bySeverity("quality:season")).toEqual(["warn"]);
  });
});

describe("the release gate", () => {
  it("passes a clean set of books and fails on one arrow or one repeated sentence", () => {
    const ok = summariseQuality({ P1: clean() }, checkBook(clean(), "P1", CTX));
    expect(ok.releaseGate).toEqual({ pass: true, failures: [] });
    const dirty = clean();
    dirty.ideas[0] = idea("A", { intro: "Van het station → het park." });
    const bad = summariseQuality({ P1: dirty }, checkBook(dirty, "P1", CTX));
    expect(bad.releaseGate.pass).toBe(false);
    expect(bad.releaseGate.failures.join(" ")).toMatch(/exposed reasoning/);
  });

  it("counts the ideas with a real place and its website, and sums cost and time", () => {
    const b = clean();
    b.ideas[0] = idea("A", { places: [{ name: "Klei & Co", city: "Utrecht", url: "https://klei.nl", note: "" }] });
    b.ideas[1] = idea("B", { places: [{ name: "Zonder site", city: "Utrecht", url: "", note: "" }] });
    const q = summariseQuality({ P1: b }, [], { P1: { usd: 0.2, seconds: 60, issues: [], fillCount: 0 } });
    expect(q.ideas).toBe(7);
    expect(q.ideasWithPlace).toBe(2);
    expect(q.ideasWithPlaceSite).toBe(1);
    expect(q.totalUsd).toBeCloseTo(0.2);
    expect(q.avgSeconds).toBe(60);
  });
});
