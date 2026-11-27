// Fix round "plan links": a PDF that holds a bare domain ("escape-kit.com") must carry absolute links over it, to the checked page of that site.
// A viewer that finds a bare domain without a link resolves it against the address the PDF was opened from.
import { describe, expect, it } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";
import { renderIdeaBookPdf } from "@/lib/pdf/ideaBook";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

const SCORES = { relevance: 70, novelty: 60, feasibility: 75, surprise: 50, shareability: 60, effort: 50, cost: 40, social_fit: 60, challenge_level: 50 };
const DEEP = "https://escape-kit.com/en/escape-room-kit/";

const entry = (over: Partial<IdeaBookEntry> = {}): IdeaBookEntry => ({
  title: "Build your own escape box",
  intro: "An evening of riddles.",
  why_it_fits: "You picked puzzling.",
  details: ["Look up a studio nearby.", "Book a trial."],
  first_action: "Open Google Maps and search 'escape room'.",
  practical: { estimated_cost: "€15–25", duration: "2 hours", difficulty: "easy", preparation: "" },
  location: null,
  requirements: [],
  image_suggestion: "",
  photo_category: "social_games",
  door: "natural",
  scores: SCORES,
  ...over,
});

const book = (first: Partial<IdeaBookEntry>): GeneratedIdeaBook => ({
  profile_summary: "Summary.",
  must_haves: [],
  preferences: [],
  ideas: [entry(first), entry({ door: "discovery" }), entry({ door: "discovery" }), entry({ door: "unexpected" })],
  wildcard: entry({ door: "wildcard" }),
  labels: { steps_heading: "", first_action_heading: "", wildcard_heading: "", time_label: "", cost_label: "", location_heading: "", requirements_heading: "" },
});

async function linksOf(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  const out: string[] = [];
  for (const page of doc.getPages()) {
    const annots = page.node.lookup(PDFName.of("Annots"));
    if (!(annots instanceof PDFArray)) continue;
    for (let i = 0; i < annots.size(); i++) {
      const annot = annots.lookup(i);
      if (!(annot instanceof PDFDict)) continue;
      const action = annot.lookup(PDFName.of("A"));
      if (!(action instanceof PDFDict)) continue;
      const uri = action.lookup(PDFName.of("URI"));
      if (uri instanceof PDFString || uri instanceof PDFHexString) out.push(uri.decodeText());
    }
  }
  return out;
}

describe("links in the PDF", () => {
  it("puts an absolute link over every bare domain, to the checked page of that website", async () => {
    const bytes = await renderIdeaBookPdf(
      book({
        details: ["Go to escape-kit.com and buy a printable kit.", "Print the pages tonight."],
        first_action: "Open escape-kit.com now and pick your first case.",
        places: [{ name: "escape-kit.com", city: "Online", url: DEEP, note: "Printable games, instant download" }],
      }),
      "Title",
      "en",
    );
    const links = await linksOf(bytes);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toMatch(/^https:\/\//);
    const toKit = links.filter((l) => l.includes("escape-kit.com"));
    // The step, the "start here" panel, the place's name and its website link.
    expect(toKit.length).toBeGreaterThanOrEqual(4);
    // Never the bare front page (which opens in French): always the page the research checked.
    expect(new Set(toKit)).toEqual(new Set([DEEP]));
  }, 30_000);

  it("makes a domain without a checked page absolute, also with an ending the old pattern missed", async () => {
    const bytes = await renderIdeaBookPdf(book({ first_action: "Check the sky and visit astronomie-basel.ch tonight." }), "Title", "en");
    expect(await linksOf(bytes)).toContain("https://astronomie-basel.ch");
  }, 30_000);

  it("never writes a relative or storage address, whatever the stored place holds", async () => {
    const bytes = await renderIdeaBookPdf(
      book({ places: [{ name: "Bad", city: "Utrecht", url: "https://abc.supabase.co/storage/v1/object/sign/x.pdf", note: "" }] }),
      "Title",
      "en",
    );
    for (const link of await linksOf(bytes)) expect(link).not.toContain("supabase");
  }, 30_000);
});

// Step 250: an address too long for the column of the steps was broken over two lines, and the first line linked to the cut-off half
// ("bartsboekje.com/kat-en-bakkie-utrec").
describe("an address that does not fit on one line", () => {
  const LONG = "bartsboekje.com/kat-en-bakkie-utrecht-en-nog-een-heel-lang-stuk-adres-erachter";
  const PAGE = `https://www.${LONG}/`;

  it("never links to a part of it, whether the place is known or not", async () => {
    for (const places of [[{ name: "Kat & Bakkie", city: "Utrecht", url: PAGE, note: "Koffie tussen katten" }], undefined]) {
      for (const lead of ["", "Reserveer vooraf een plek via ", "Kijk nu even op ", "Loop binnen of reserveer vooraf een tafeltje via de pagina op "]) {
        const links = await linksOf(await renderIdeaBookPdf(book({ details: [`${lead}${LONG}.`, "Ga zitten."], first_action: `Open ${LONG} vandaag.`, places }), "Title", "nl"));
        const own = links.filter((l) => l.includes("bartsboekje.com") && !l.includes("google.com"));
        expect(own.length, `${lead}${places ? " (place)" : ""}`).toBeGreaterThan(0);
        for (const link of own) expect(link.replace(/\/$/, "")).toBe(places ? PAGE.replace(/\/$/, "") : link.includes("www.") ? PAGE.replace(/\/$/, "") : `https://${LONG}`);
      }
    }
  }, 60_000);
});
