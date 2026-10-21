import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderIdeaBookPdf } from "@/lib/pdf/ideaBook";
import { IdeaMore } from "@/components/plan/IdeaMore";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import type { IdeaSize } from "@/lib/claude/ideaLayers";

const SCORES = { relevance: 70, novelty: 60, feasibility: 75, surprise: 50, shareability: 60, effort: 50, cost: 40, social_fit: 60, challenge_level: 50 };

const sizes: IdeaSize[] = [
  { kind: "taste", title: "Een uurtje", description: "Kort proberen.", estimated_cost: "Gratis", duration: "1 uur" },
  { kind: "do", title: "Een middag", description: "Een kom maken.", estimated_cost: "±€45", duration: "3 uur" },
  { kind: "deepen", title: "Een cursus", description: "Zes weken.", estimated_cost: "±€180", duration: "6 weken" },
];

function idea(n: number, layered: boolean): IdeaBookEntry {
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
    ...(layered
      ? {
          feels_like: "Koel. Stil.",
          sizes,
          next_step: "Doe het nog eens.",
          places: [{ name: "Atelier", city: "Utrecht", url: "https://example.org", note: "Proefles" }],
          related: [{ id: "beeldhouwen", label: "Beeldhouwen" }],
        }
      : {}),
  };
}

function book(layeredAt: number[]): GeneratedIdeaBook {
  return {
    profile_summary: "Samenvatting.",
    must_haves: [],
    preferences: [],
    ideas: [1, 2, 3, 4, 5, 6].map((n) => idea(n, layeredAt.includes(n))),
    wildcard: idea(7, layeredAt.includes(7)),
    labels: { steps_heading: "", first_action_heading: "", wildcard_heading: "", time_label: "", cost_label: "", location_heading: "", requirements_heading: "" },
  };
}

const pageCount = async (b: GeneratedIdeaBook) => (await PDFDocument.load(await renderIdeaBookPdf(b, "Titel", "nl"))).getPageCount();

describe("the PDF with the R2.3 layers", () => {
  it("is exactly as long as before for a book without layers (old books keep their PDF)", async () => {
    expect(await pageCount(book([]))).toBe(10);
  });

  it("gives an idea with layers one extra page, and only that idea", async () => {
    expect(await pageCount(book([2, 7]))).toBe(12);
  }, 30_000);

  it("is at most seven pages longer, and stays small", async () => {
    const bytes = await renderIdeaBookPdf(book([1, 2, 3, 4, 5, 6, 7]), "Titel", "nl");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(17);
    expect(bytes.length).toBeLessThan(4 * 1024 * 1024);
  }, 30_000);
});

describe("IdeaMore (the web layers)", () => {
  const copy = getDictionary("nl").venster.more;
  const render = (entry: IdeaBookEntry, mode?: "full" | "shared") => renderToStaticMarkup(createElement(IdeaMore, { idea: entry, copy, mode }));

  it("shows nothing for an idea without layers", () => {
    expect(render(idea(1, false))).toBe("");
    expect(render(idea(1, false), "shared")).toBe("");
  });

  it("shows every layer to the buyer, with real links to the places", () => {
    const html = render(idea(1, true));
    for (const text of [copy.heading, copy.feelsHeading, copy.sizesHeading, copy.placesHeading, copy.relatedHeading, copy.nextHeading, "Koel. Stil.", "Een middag", "Atelier", "Beeldhouwen", "Doe het nog eens."]) {
      expect(html).toContain(text);
    }
    expect(html).toContain("https://example.org");
    expect(html).toContain("google.com/maps/search");
  });

  it("shows the public preview only the three sizes", () => {
    const html = render(idea(1, true), "shared");
    expect(html).toContain("Een uurtje");
    expect(html).toContain("Een cursus");
    for (const text of [copy.feelsHeading, copy.placesHeading, copy.relatedHeading, copy.nextHeading, "Koel. Stil.", "Atelier", "Beeldhouwen", "Doe het nog eens."]) {
      expect(html).not.toContain(text);
    }
  });
});
