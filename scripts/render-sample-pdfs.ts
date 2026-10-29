// Renders three sample Idea Books with the real PDF renderer, without any API call or cost,
// so the PDF layout can be checked after a change ("Het venster" fase 6):
//   associations  a book from the image intake: the person's window on the cover
//   cards         a book from the card wizard (activity photos, classic cover)
//   legacy        an old-style book (category photos, classic cover)
//
//   npx tsx scripts/render-sample-pdfs.ts            writes scratch/sample-<kind>.pdf
//
// The text is sample content written for this script, not generated.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderIdeaBookPdf, type IdeaBookPdfContext } from "../src/lib/pdf/ideaBook";
import type { GeneratedIdeaBook, IdeaBookEntry } from "../src/lib/claude/ideaBookTypes";
import { buildAssociationLibrary, buildAssociationSources } from "../src/lib/discovery/associations";
import { buildIdeaThreads, threadSentence } from "../src/lib/ideaThread";
import { ideaKey, WILDCARD_KEY } from "../src/lib/ideaKeys";
import { DOMAINS } from "../src/lib/discovery/library";
import { getDictionary } from "../src/lib/i18n/dictionaries";
import { buildSill, buildWindowItems } from "../src/lib/vensterPanes";

const SCORES = { relevance: 70, novelty: 60, feasibility: 75, surprise: 50, shareability: 60, effort: 50, cost: 40, social_fit: 60, challenge_level: 50 };

function idea(p: Partial<IdeaBookEntry> & Pick<IdeaBookEntry, "title" | "door">): IdeaBookEntry {
  return {
    intro: "Een middag waarin je handen het denkwerk overnemen.",
    why_it_fits: "Je koos de werkplaats met zaagsel: hier maak je iets met je handen, in stilte.",
    details: [
      "Zoek op Google Maps naar 'open atelier keramiek' rond je woonplaats en kies er één met een proefles.",
      "Boek een proefles van twee uur en neem oude kleren mee.",
    ],
    first_action: "Open Google Maps en zoek 'proefles pottenbakken Laren'.",
    practical: { estimated_cost: "€35–50", duration: "2 uur", difficulty: "easy", preparation: "Oude kleren aan" },
    location: { name: "Keramiekatelier De Draaischijf", address: "", city: "Hilversum" },
    requirements: ["Oude kleren", "Handdoek"],
    image_suggestion: "",
    photo_category: "creative_workshop",
    scores: SCORES,
    ...p,
  };
}


// R2.3: sample layers (how it feels, three sizes, places, related, what next) for the books that
// come from the selection engine. `long` fills every field up to its limit to prove one page holds it.
function layers(n: number, long = false): Partial<IdeaBookEntry> {
  const pad = (text: string, max: number) => (long ? (text + " " + text + " " + text).slice(0, max).replace(/\s+\S*$/, "") : text);
  return {
    feels_like: pad("Je voelt de koele klei onder je duimen. Het draaien zoemt zacht, de rest van de wereld wordt klein.", 318),
    sizes: [
      { kind: "taste", title: pad("Een uurtje proberen", 46), description: pad("Eén korte proefles, je handen in de klei en meer niet.", 168), estimated_cost: "vanaf ±€15", duration: "1 uur" },
      { kind: "do", title: pad("Een middag draaien", 46), description: pad("Een hele middag werken aan een kom die je mee naar huis neemt.", 168), estimated_cost: "±€45", duration: "3 uur" },
      { kind: "deepen", title: pad("Een cursus van zes weken", 46), description: pad("Elke week een avond, met ruimte om je eigen stijl te vinden.", 168), estimated_cost: "±€180", duration: "6 weken" },
    ],
    next_step: pad("Vond je het fijn? Boek dan de middag erna, of vraag naar de cursus.", 168),
    places: [
      { name: `Keramiekatelier De Draaischijf ${n}`, city: "Hilversum", url: "https://example.org/draaischijf", note: "Proefles voor beginners op zaterdagochtend." },
      { name: "Atelier Aan de Vecht", city: "Maarssen", url: null, note: "Open atelier met een kleine cursus." },
      { name: "Klei & Co", city: "Utrecht", url: "https://example.org/klei", note: "" },
    ],
    related: [
      { id: "beeldhouwen", label: "Beeldhouwen" },
      { id: "houtbewerking", label: "Houtbewerking" },
      { id: "tekenen", label: "Tekenen buiten" },
    ],
  };
}

function book(withActivities: boolean): GeneratedIdeaBook {
  let n = 0;
  // Engine books (with activity ids) carry the R2.3 layers; the classic book does not, like an old one.
  const a = (id: string) => (withActivities ? { activity_id: id, ...layers(++n, n === 2) } : {});
  return {
    profile_summary: "Je zoekt iets voor je handen en je hoofd: rustig, buiten waar het kan, samen met je partner.",
    must_haves: ["Geen alcohol"],
    preferences: ["Gezelligheid"],
    ideas: [
      idea({ title: "Pottenbakken zoals je stiekem wilde", door: "natural", ...a("pottenbakken") }),
      idea({ title: "Een snijplank uit één stuk eiken", door: "natural", photo_category: "creative_workshop", ...a("houtbewerking") }),
      idea({ title: "Zonsopgang op het stille water", door: "discovery", photo_category: "water_activity", location: null, ...a("open-water") }),
      idea({ title: "Een nacht onder de sterren", door: "discovery", photo_category: "nature_outdoor", ...a("sterrenkijken") }),
      idea({ title: "Een moestuinbak voor twee", door: "unexpected", photo_category: "nature_outdoor", ...a("tuinieren") }),
      idea({ title: "Leesclub in stilte", door: "stretch", photo_category: "home_cozy", location: null, ...a("lezen") }),
    ],
    wildcard: idea({ title: "Een hele dag zonder woorden", door: "wildcard", photo_category: "wellness_relax", ...a("meditatie") }),
    labels: { steps_heading: "", first_action_heading: "", wildcard_heading: "", time_label: "", cost_label: "", location_heading: "", requirements_heading: "" },
  };
}

async function main() {
  const locale = "nl" as const;
  const dict = getDictionary(locale);
  const intake = {
    interestDomains: ["creative", "nature"],
    associations: ["place-forest-edge", "place-workshop", "place-rain-window", "moment-clay", "moment-stillness", "sense-wood"],
    location: "Laren, Gooise Meren",
    timeAvailable: "halfday",
    budget: "100",
    company: ["partner"],
  };
  const items = buildWindowItems(
    intake,
    { cards: buildAssociationLibrary(locale).cards, domains: DOMAINS.map((d) => ({ id: d.id, label: d.short[locale] })) },
    dict.venster,
  );
  const windowContext: IdeaBookPdfContext["window"] = {
    items,
    sill: buildSill(intake, dict.intake, dict.venster),
    dateLabel: "5 oktober 2026",
  };
  // The thread per door (R2.2): the line each idea page of an image-intake book gets.
  const sample = book(true);
  const all = [...sample.ideas, sample.wildcard];
  const threads = buildIdeaThreads(sample.ideas, sample.wildcard, buildAssociationSources(all, intake.associations), locale);
  const threadLines: Record<string, string> = {};
  all.forEach((idea, i) => {
    const line = threadSentence(threads[i < sample.ideas.length ? ideaKey(i) : WILDCARD_KEY], dict.venster.thread, dict.venster.profile.and);
    if (line && idea.activity_id) threadLines[idea.activity_id] = line;
  });
  const base: IdeaBookPdfContext = { company: ["partner"], budget: "100", timeAvailable: "halfday" };
  const out = path.join(process.cwd(), "scratch");
  await mkdir(out, { recursive: true });
  const jobs = [
    ["associations", book(true), { ...base, window: windowContext, threadLines }],
    ["cards", book(true), base],
    ["legacy", book(false), base],
  ] as const;
  for (const [kind, b, ctx] of jobs) {
    const bytes = await renderIdeaBookPdf(b, dict.plan.eyebrow, locale, ctx);
    const file = path.join(out, `sample-${kind}.pdf`);
    await writeFile(file, bytes);
    console.log(`${file}  ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);
  }
}

main();
