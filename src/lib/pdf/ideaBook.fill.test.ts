import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderIdeaBookPdf } from "@/lib/pdf/ideaBook";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import type { IdeaFill } from "@/lib/claude/ideaFill";
import { kindCopy } from "@/lib/pdf/ideaContent";

// B5 / V1 in the PDF: lines written for the idea are printed when they are there and sound; the per-kind
// templates are the fallback, and with KNOWLEDGE_ENGINE_V2 on a template line that contradicts the idea is skipped.
// The fonts are subset, so the printed words cannot be searched in the file: these tests check that the page layout
// holds (page count) and that nothing throws; what is printed was checked by eye on a rendered sample (see CLAUDE.md,
// Stap 98), and the decision which line is kept is tested on the data in ideaFill.test.ts.

const SCORES = { relevance: 70, novelty: 60, feasibility: 75, surprise: 50, shareability: 60, effort: 50, cost: 40, social_fit: 60, challenge_level: 50 };
const FILL: IdeaFill = {
  timeline: ["Je komt aan bij het atelier", "Je draait je eerste kom", "Je kom gaat de oven in", "Je haalt hem een week later op"],
  takeaways: ["Een kom van jezelf", "Klei onder je nagels", "Een nieuwe hobby-optie"],
  suggestions: ["Draag kleding die vies mag worden", "Laat je nagels kort", "Vraag naar een vervolgles"],
};

function idea(n: number, over: Partial<IdeaBookEntry> = {}): IdeaBookEntry {
  return {
    title: `Idee ${n}`,
    intro: "Een middag waarin je handen het denkwerk overnemen.",
    why_it_fits: "Je koos de werkplaats met zaagsel.",
    details: ["Zoek op Google Maps naar een atelier.", "Boek een proefles."],
    first_action: "Open Google Maps en zoek 'proefles'.",
    practical: { estimated_cost: "€35", duration: "2 uur", difficulty: "easy", preparation: "" },
    location: null,
    requirements: [],
    image_suggestion: "",
    photo_category: "creative_workshop",
    door: (["natural", "natural", "discovery", "discovery", "unexpected", "stretch"] as const)[n - 1] ?? "wildcard",
    scores: SCORES,
    activity_id: "pottenbakken",
    ...over,
  };
}
const book = (over: Partial<IdeaBookEntry> = {}): GeneratedIdeaBook => ({
  profile_summary: "Samenvatting.",
  must_haves: [],
  preferences: [],
  ideas: [1, 2, 3, 4, 5, 6].map((n) => idea(n, over)),
  wildcard: idea(7, over),
  labels: { steps_heading: "", first_action_heading: "", wildcard_heading: "", time_label: "", cost_label: "", location_heading: "", requirements_heading: "" },
});
const render = async (b: GeneratedIdeaBook, company?: string[]) =>
  PDFDocument.load(await renderIdeaBookPdf(b, "Titel", "nl", company ? { company } : undefined));

afterEach(() => vi.unstubAllEnvs());

describe("the idea page with a fill", () => {
  it("stays on one page per idea: a fill is the same size as the template it replaces", async () => {
    expect((await render(book())).getPageCount()).toBe(9);
    expect((await render(book({ fill: FILL }))).getPageCount()).toBe(9);
  });

  it("does not break on a stored fill that is malformed (it is checked again when read)", async () => {
    const broken = { timeline: ["a"], takeaways: [], suggestions: "x" } as unknown as IdeaFill;
    expect((await render(book({ fill: broken }))).getPageCount()).toBe(9);
  });

  it("with the option on, still renders for a solo person whose template lines would conflict", async () => {
    vi.stubEnv("KNOWLEDGE_ENGINE_V2", "1");
    expect((await render(book(), ["alone"])).getPageCount()).toBe(9);
    // The decision itself is covered in ideaFill.test.ts; here: a solo idea has template lines left to print.
    const copy = kindCopy("social", "nl");
    expect(copy.suggestions.length).toBeGreaterThanOrEqual(3);
  });
});
