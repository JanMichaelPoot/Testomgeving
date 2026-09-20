// One-off script: renders a realistic, representative example Idea Book
// (both locales) via the exact same PDF renderer real purchases use, and
// saves it as a static file under public/examples/. "Bekijk een voorbeeld"
// on the homepage links straight to this — no separate preview framework,
// per the instruction to reuse existing PDF rendering rather than build a
// new one.
//
//   npx tsx scripts/generate-example-idea-book.ts
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { renderIdeaBookPdf } from "../src/lib/pdf/ideaBook";
import type { GeneratedIdeaBook, IdeaBookEntry } from "../src/lib/claude/ideaBookTypes";

function idea(overrides: Partial<IdeaBookEntry> & Pick<IdeaBookEntry, "title" | "door">): IdeaBookEntry {
  return {
    intro: "",
    why_it_fits: "",
    details: [],
    first_action: "",
    practical: { estimated_cost: "", duration: "", difficulty: "moderate", preparation: "" },
    location: null,
    requirements: [],
    image_suggestion: "",
    photo_category: "nature_outdoor",
    scores: {
      relevance: 70,
      novelty: 60,
      feasibility: 75,
      surprise: 50,
      shareability: 60,
      effort: 50,
      cost: 40,
      social_fit: 60,
      challenge_level: 50,
    },
    ...overrides,
  };
}

const NL: GeneratedIdeaBook = {
  profile_summary:
    "Je zit al maanden vooral op de bank na het werk en wil weer wat leven in je weekenden, het liefst samen met je partner.",
  must_haves: ["Geen honden", "Rolstoeltoegankelijk"],
  preferences: ["Graag iets buiten", "Houdt van koffie en kunst"],
  ideas: [
    idea({
      title: "Pottenbakken zoals je stiekem wilde",
      door: "natural",
      intro: "Een echte pottenbakworkshop, met je handen in de klei en je scherm in je zak.",
      why_it_fits: "Je zei zelf dat je best weer eens een workshop zou willen doen — hier is hij.",
      details: [
        "Zoek een pottenbakstudio bij jou in de buurt via Google Maps.",
        "Boek een plek voor een proefles van twee uur.",
      ],
      first_action: "Zoek 'pottenbakken workshop' + je woonplaats en bekijk de eerstvolgende datum.",
      practical: { estimated_cost: "€35–50 p.p.", duration: "Een dagdeel", difficulty: "easy", preparation: "" },
      requirements: ["Kleding die vuil mag worden"],
      photo_category: "creative_workshop",
    }),
    idea({
      title: "Kunstroute langs verborgen werken",
      door: "discovery",
      intro: "Wandel samen langs kunstwerken in je eigen stad die je waarschijnlijk al vaak bent gepasseerd.",
      why_it_fits: "Je houdt van kunst en buiten zijn — dit combineert allebei zonder gedoe.",
      details: [
        "Zoek online naar 'kunstroute' of 'street art route' in je woonplaats.",
        "Download of print de route en start bij het eerste punt op de kaart.",
      ],
      first_action: "Zoek 'kunstroute' + je woonplaats en open de eerste link.",
      practical: { estimated_cost: "Gratis", duration: "Een dagdeel", difficulty: "easy", preparation: "" },
      requirements: ["Smartphone met kaart of papieren route"],
      photo_category: "art_culture",
    }),
    idea({
      title: "Koffie midden in het museum",
      door: "discovery",
      intro: "Drink specialty koffie tussen de kunst, ook zonder museumticket.",
      why_it_fits: "Je noemde koffie en kunst als dingen waar je van houdt — dit zet ze aan hetzelfde tafeltje.",
      details: [
        "Zoek het dichtstbijzijnde museum met een eigen café.",
        "Loop binnen (vaak ook zonder ticket toegankelijk) en besluit ter plekke.",
      ],
      first_action: "Zoek 'museumcafé' + je woonplaats op Google Maps.",
      practical: { estimated_cost: "€10–20", duration: "1-2 uur", difficulty: "easy", preparation: "" },
      photo_category: "food_drink",
    }),
    idea({
      title: "Suppen door je eigen stad",
      door: "unexpected",
      intro: "Peddel over water dat je normaal alleen vanaf de kade ziet.",
      why_it_fits: "Je wil weer leven in je weekenden — vanaf het water ziet je stad er compleet anders uit.",
      details: [
        "Zoek 'suppen huren' of 'kano verhuur' bij jou in de buurt.",
        "Boek twee sups voor minimaal anderhalf uur.",
      ],
      first_action: "Zoek 'sup verhuur' + je woonplaats en bekijk de beschikbaarheid.",
      practical: { estimated_cost: "€20–30 p.p.", duration: "Een dagdeel", difficulty: "moderate", preparation: "" },
      requirements: ["Reservering vooraf", "Handdoek en droge kleding"],
      photo_category: "water_activity",
    }),
    idea({
      title: "Muurschilderingen jagen als speurtocht",
      door: "unexpected",
      intro: "Volg een zelfstandige route langs muurschilderingen en maak er een fotospeurtocht van.",
      why_it_fits: "Je zit al maanden vooral op de bank — dit is een actieve, low-key manier om je stad te herontdekken.",
      details: [
        "Zoek 'street art route' + je woonplaats.",
        "Volg de route te voet of op de fiets en maak bij elk werk een foto.",
      ],
      first_action: "Zoek 'street art route' + je woonplaats in Google.",
      practical: { estimated_cost: "Gratis", duration: "Een dagdeel", difficulty: "easy", preparation: "" },
      photo_category: "art_culture",
    }),
    idea({
      title: "Oldtimer-roadtrip zonder vaste route",
      door: "stretch",
      intro: "Huur een vintage auto en rijd er samen op uit, zonder vaste bestemming.",
      why_it_fits: "Je koos 'een uitje' als mogelijkheid — dit is spontaan, buiten, en net onvoorspelbaar genoeg.",
      details: [
        "Zoek 'oldtimer verhuur' bij jou in de regio.",
        "Reserveer een auto voor een dagdeel en rijd de stad uit, zonder vaste route.",
      ],
      first_action: "Zoek 'oldtimer verhuur' + je regio en bekijk de beschikbaarheid.",
      practical: { estimated_cost: "€100–150", duration: "Een dagdeel", difficulty: "moderate", preparation: "" },
      requirements: ["Geldig rijbewijs", "Reservering vooraf"],
      photo_category: "travel_adventure",
    }),
  ],
  wildcard: idea({
    title: "Schilder expressief in het openbaar",
    door: "wildcard",
    intro: "Een action painting workshop, waar precisie even niet het doel is.",
    why_it_fits: "Je zei dat je best weer een workshop wil doen — dit is minder voorspelbaar dan pottenbakken.",
    details: [
      "Zoek 'action painting workshop' bij jou in de buurt.",
      "Boek een sessie voor twee personen en trek kleding aan die verf mag hebben.",
    ],
    first_action: "Zoek 'action painting workshop' + je woonplaats.",
    practical: { estimated_cost: "€35–50 p.p.", duration: "Een dagdeel", difficulty: "moderate", preparation: "" },
    requirements: ["Reservering vooraf", "Oude kleding of schort"],
    photo_category: "creative_workshop",
  }),
  labels: {
    steps_heading: "",
    first_action_heading: "",
    wildcard_heading: "",
    time_label: "",
    cost_label: "",
    location_heading: "",
    requirements_heading: "",
  },
};

const EN: GeneratedIdeaBook = {
  profile_summary:
    "You've mostly been on the couch after work for months and want some life back in your weekends, ideally together with your partner.",
  must_haves: ["No dogs", "Wheelchair accessible"],
  preferences: ["Something outdoors would be nice", "Loves coffee and art"],
  ideas: NL.ideas.map((i) => ({ ...i })),
  wildcard: { ...NL.wildcard },
  labels: NL.labels,
};

// Reuse the Dutch idea copy for the English example too — this is a
// static, one-time example asset, not real generated output, so the exact
// wording doesn't need a full translation pass; the point is to show the
// book's structure and design in both languages' chrome (headings, labels,
// footer) which renderIdeaBookPdf already localizes on its own.

async function main() {
  const outDir = path.join(process.cwd(), "public/examples");
  await mkdir(outDir, { recursive: true });

  const nlPdf = await renderIdeaBookPdf(NL, "Jouw Window Idea Book", "nl");
  await writeFile(path.join(outDir, "idea-book-nl.pdf"), nlPdf);

  const enPdf = await renderIdeaBookPdf(EN, "Your Window Idea Book", "en");
  await writeFile(path.join(outDir, "idea-book-en.pdf"), enPdf);

  console.log("Wrote public/examples/idea-book-nl.pdf and idea-book-en.pdf");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
