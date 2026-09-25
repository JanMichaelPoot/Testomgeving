import type { IdeaBookEntry, IdeaDoor, PhotoCategory } from "@/lib/claude/ideaBookTypes";
import type { Locale } from "@/lib/locale";

// Rule-based editorial micro-content for the Idea Book PDF's idea pages: the
// experience profile, "a possible schedule", takeaways, "make it yours"
// suggestions, the small editorial detail, budget status and the URL pull-out.
//
// Deliberately NOT generated: none of this adds an AI call or a single output
// token to a purchase. Everything is derived from data the book already holds
// (photo category, door, the 0-100 scores, cost/duration strings, the profile)
// plus the small content libraries below. It is meant as a useful editorial
// typing of the experience, not as scientific accuracy.
//
// Self-contained on purpose (own nl/en tables instead of dictionaries.ts):
// this is PDF-only content, and keeping it here means the site's UI
// dictionaries are untouched by the PDF upgrade.

export type ActivityKind =
  | "creative"
  | "cultural"
  | "outdoor"
  | "active"
  | "water"
  | "food"
  | "social"
  | "restful"
  | "adventure"
  | "market";

// The idea's own photo category is Claude's classification of what the idea
// actually is (see the category descriptions in generateIdeaBook.ts), so it is
// the most reliable handle for typing the experience.
const KIND_BY_CATEGORY: Record<PhotoCategory, ActivityKind> = {
  art_culture: "cultural",
  creative_workshop: "creative",
  food_drink: "food",
  nature_outdoor: "outdoor",
  water_activity: "water",
  active_sport: "active",
  music_nightlife: "social",
  wellness_relax: "restful",
  social_games: "social",
  travel_adventure: "adventure",
  home_cozy: "restful",
  market_shopping: "market",
};

export function activityKindFor(idea: Pick<IdeaBookEntry, "photo_category">): ActivityKind {
  return KIND_BY_CATEGORY[idea.photo_category] ?? "outdoor";
}

// --- Experience profile ------------------------------------------------------

export type ExperienceDimension = "creativity" | "calm" | "discovery" | "social" | "comfortZone";
export type ExperienceProfile = Record<ExperienceDimension, number>;

export const EXPERIENCE_DIMENSIONS: readonly ExperienceDimension[] = [
  "creativity",
  "calm",
  "discovery",
  "social",
  "comfortZone",
];

// Centrally configurable starting points (1-5) per kind of activity; the
// idea's own scores and door then nudge them (see experienceProfileFor).
export const EXPERIENCE_BASELINES: Record<ActivityKind, ExperienceProfile> = {
  creative: { creativity: 5, calm: 4, discovery: 3, social: 2, comfortZone: 2 },
  cultural: { creativity: 3, calm: 4, discovery: 4, social: 2, comfortZone: 2 },
  outdoor: { creativity: 2, calm: 4, discovery: 3, social: 2, comfortZone: 2 },
  active: { creativity: 1, calm: 2, discovery: 3, social: 3, comfortZone: 3 },
  water: { creativity: 1, calm: 3, discovery: 4, social: 2, comfortZone: 3 },
  food: { creativity: 2, calm: 4, discovery: 3, social: 3, comfortZone: 1 },
  social: { creativity: 2, calm: 1, discovery: 3, social: 5, comfortZone: 3 },
  restful: { creativity: 2, calm: 5, discovery: 2, social: 1, comfortZone: 1 },
  adventure: { creativity: 2, calm: 1, discovery: 5, social: 3, comfortZone: 4 },
  market: { creativity: 2, calm: 2, discovery: 4, social: 4, comfortZone: 2 },
};

const DOOR_COMFORT: Record<IdeaDoor, number> = {
  natural: 1,
  discovery: 2,
  unexpected: 3,
  stretch: 4,
  wildcard: 5,
};

const clamp5 = (n: number) => Math.min(5, Math.max(1, Math.round(n)));
// 0-100 (50 = neutral) -> 1-5 (0 -> 1, 50 -> 3, 100 -> 5).
const score5 = (v: number) => clamp5(1 + v / 25);

export interface ExperienceContext {
  // Stored intake `company` values ("alone", "partner", ...). When the only
  // company is the person themselves, the social stimulus is capped.
  company?: string[];
}

export function experienceProfileFor(
  idea: Pick<IdeaBookEntry, "photo_category" | "door" | "scores">,
  context: ExperienceContext = {}
): ExperienceProfile {
  const base = EXPERIENCE_BASELINES[activityKindFor(idea)];
  const { novelty, effort, challenge_level } = idea.scores;

  let social = base.social;
  if (context.company && context.company.length > 0 && context.company.every((c) => c === "alone")) {
    social = Math.min(social, 2);
  }

  return {
    creativity: base.creativity,
    // A more demanding idea is less of a "rest".
    calm: clamp5(base.calm - (effort - 50) / 40),
    discovery: clamp5((base.discovery + score5(novelty)) / 2),
    social: clamp5(social),
    // Where the idea sits relative to the person's comfort zone: the door says
    // it structurally, the model's own challenge estimate refines it.
    comfortZone: clamp5((DOOR_COMFORT[idea.door] + score5(challenge_level)) / 2),
  };
}

// --- Budget status -----------------------------------------------------------

const BUDGET_CAP: Record<string, number> = { free: 0, "25": 25, "100": 100, allin: Infinity };

export type BudgetStatus = "within" | "slightlyAbove" | "above";

// Highest euro amount in a free-text cost like "€35–50 p.p." — 0 for
// "Gratis"/"Free", null when no amount can be read.
export function parseMaxCost(text: string): number | null {
  if (/\b(gratis|free)\b/i.test(text)) return 0;
  const numbers = (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => parseFloat(n.replace(",", ".")));
  if (numbers.length === 0) return null;
  return Math.max(...numbers);
}

export function budgetStatusFor(costText: string, budgetValue: string | undefined): BudgetStatus | null {
  if (!budgetValue || !(budgetValue in BUDGET_CAP)) return null;
  const cap = BUDGET_CAP[budgetValue];
  const max = parseMaxCost(costText);
  if (max === null) return null;
  if (max <= cap) return "within";
  if (max <= cap * 1.5) return "slightlyAbove";
  return "above";
}

// --- Duration ----------------------------------------------------------------

// Rough length of the idea in hours, or null when the text doesn't say.
export function parseDurationHours(text: string): number | null {
  const t = text.toLowerCase();
  if (/weekend/.test(t)) return 24;
  if (/(halve dag|half a day|dagdeel|half-day)/.test(t)) return 4;
  if (/(hele dag|full day|whole day|all day)/.test(t)) return 8;
  const range = t.match(/(\d+(?:[.,]\d+)?)\s*(?:[-–]|tot|to)\s*(\d+(?:[.,]\d+)?)\s*(?:uur|uren|hours?|hrs?|u)\b/);
  if (range) return parseFloat(range[2].replace(",", "."));
  const single = t.match(/(\d+(?:[.,]\d+)?)\s*(?:uur|uren|hours?|hrs?|u)\b/);
  if (single) return parseFloat(single[1].replace(",", "."));
  if (/(minuten|minutes|min\b)/.test(t)) return 1;
  return null;
}

// --- URL pull-out ------------------------------------------------------------

const URL_PATTERN =
  /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:nl|com|org|net|eu|be|de|fr|io|co|app|info|art|studio|amsterdam)(?:\/[^\s,;)"']*)?/i;

// The first web address in a text ("Open steckutrecht.nl and book …"), split
// into what to show, where to link, and the sentence without it.
export function extractUrl(text: string): { display: string; href: string } | null {
  const match = text.match(URL_PATTERN);
  if (!match) return null;
  const raw = match[0].replace(/[.]+$/, "");
  const display = raw.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return { display, href };
}

// --- Stable choice -----------------------------------------------------------

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

// Picks `count` distinct entries, varying with the seed (an idea's title) but
// always the same for the same seed — a book regenerated from the same data
// reads the same, while two ideas of the same kind don't share a checklist.
export function pickStable<T>(items: readonly T[], count: number, seed: string): T[] {
  if (items.length <= count) return [...items];
  const start = hash(seed) % items.length;
  return Array.from({ length: count }, (_, i) => items[(start + i) % items.length]);
}

// --- Copy --------------------------------------------------------------------

export interface KindCopy {
  label: string;
  // Start / during / finish / afterwards — relative, never clock times: this
  // is one possible shape of the moment, not the provider's own schedule.
  timeline: [string, string, string, string];
  takeaways: string[];
  suggestions: string[];
}

const NL_KINDS: Record<ActivityKind, KindCopy> = {
  creative: {
    label: "Creatief",
    timeline: [
      "Rustig uitzoeken wat je wilt maken",
      "Aan de slag, zonder haast",
      "Je werk laten afwerken of inpakken",
      "Nog even wandelen of een koffie",
    ],
    takeaways: [
      "Iets dat je zelf hebt gemaakt",
      "Een paar uur volledig voor jezelf",
      "Een ervaring die niet draait om presteren",
      "Handen die weer iets anders deden dan scrollen",
    ],
    suggestions: [
      "Zet je telefoon op stil",
      "Kies bewust één ontwerp en werk dat rustig uit",
      "Maak na afloop een foto van het resultaat",
      "Neem een klein notitieboek mee",
      "Geef het resultaat een plek in huis",
    ],
  },
  cultural: {
    label: "Cultuur",
    timeline: [
      "Aankomen en rondkijken",
      "Kijken, lezen, laten inwerken",
      "Kiezen wat je het meest bijblijft",
      "Napraten bij een koffie of thee",
    ],
    takeaways: [
      "Iets gezien dat je niet meer kwijtraakt",
      "Een nieuwe blik op iets bekends",
      "Een verhaal om later te vertellen",
      "Inspiratie zonder dat het moest",
    ],
    suggestions: [
      "Kies één werk of plek die je bijblijft",
      "Neem een klein notitieboek mee",
      "Maak één foto van wat je raakt",
      "Lees eerst niet alle uitleg — kijk eerst",
      "Schrijf thuis één zin op over je ervaring",
    ],
  },
  outdoor: {
    label: "Buiten",
    timeline: [
      "Op pad, zonder haast",
      "Loop of kijk waar je zin in hebt",
      "Een rustpunt om even te zitten",
      "Rustig terug of nog een stukje verder",
    ],
    takeaways: [
      "Frisse lucht en een rustiger hoofd",
      "Een plek ontdekt die je nog niet kende",
      "Beweging zonder dat het aanvoelt als sport",
      "Een paar uur zonder scherm",
    ],
    suggestions: [
      "Zet je telefoon op stil of vliegtuigmodus",
      "Kleed je op het weer, niet op het plan",
      "Neem iets te drinken mee",
      "Maak onderweg één foto",
      "Kies bewust een rustig moment",
    ],
  },
  active: {
    label: "Actief",
    timeline: [
      "Warmlopen en de omgeving verkennen",
      "Het echte werk, op je eigen tempo",
      "Uitrusten en even bijkomen",
      "Iets te eten of te drinken",
    ],
    takeaways: [
      "Energie die je na afloop nog voelt",
      "Bewegen dat vooral leuk was",
      "Een prestatie waar je zelf over beslist",
      "Een goed gevoel in je lijf",
    ],
    suggestions: [
      "Leg vooraf vast hoe je het wilt doen: op tempo of gewoon voor de lol",
      "Neem water mee",
      "Kies kleding waarin je durft te zweten",
      "Vier het met iets lekkers achteraf",
      "Noteer hoe je je voelt na afloop",
    ],
  },
  water: {
    label: "Op het water",
    timeline: [
      "Uitleg en materiaal regelen",
      "Het water op, met tijd om te wennen",
      "Aanleggen en even bijkomen",
      "Droge kleren aan en iets warms",
    ],
    takeaways: [
      "Je omgeving vanaf een ander perspectief",
      "Een stukje avontuur dicht bij huis",
      "Even helemaal in het moment",
      "Een verhaal om na te vertellen",
    ],
    suggestions: [
      "Neem droge kleren en een handdoek mee",
      "Laat je telefoon veilig achter of in een waterdichte hoes",
      "Kijk vooraf even naar het weer",
      "Kies een tijdstip met rustig water",
      "Maak vanaf de kant een foto van waar je was",
    ],
  },
  food: {
    label: "Eten & drinken",
    timeline: [
      "Aankomen en een plek uitzoeken",
      "Bestellen of proeven, zonder haast",
      "Nog een tweede ronde of iets zoets",
      "Een blokje om of naar huis",
    ],
    takeaways: [
      "Iets lekkers dat je bewust hebt genomen",
      "Een uurtje waarin niets hoeft",
      "Een nieuwe plek om terug te komen",
      "Aandacht voor smaak in plaats van haast",
    ],
    suggestions: [
      "Zet je telefoon op stil",
      "Kies iets wat je nog nooit hebt besteld",
      "Neem de tijd voor je eerste slok of hap",
      "Noteer de plek voor een volgende keer",
      "Neem een boek of notitieboek mee",
    ],
  },
  social: {
    label: "Sociaal",
    timeline: [
      "Aankomen en sfeer proeven",
      "Meedoen, luisteren, kijken",
      "Een hoogtepunt uitkiezen",
      "Uitwaaien of nog één laatste drankje",
    ],
    takeaways: [
      "Een avond of middag met energie",
      "Nieuwe gezichten of een nieuw gesprek",
      "Iets waar je later over praat",
      "Een reden om weer eens de deur uit te gaan",
    ],
    suggestions: [
      "Spreek vooraf af hoe laat je weggaat",
      "Neem contant geld of een pinpas mee",
      "Zeg één keer ja tegen iets wat je niet had gepland",
      "Neem iemand mee die je goed vindt",
      "Zet je telefoon een tijdje weg",
    ],
  },
  restful: {
    label: "Rust",
    timeline: [
      "Vertragen en je plek inrichten",
      "Doen wat je goed voelt, in je eigen tempo",
      "Een rustig moment om af te ronden",
      "Nog even nagenieten zonder plan",
    ],
    takeaways: [
      "Een hoofd dat weer wat leger is",
      "Tijd die echt van jou was",
      "Iets kleins waar je op terug kunt vallen",
      "Rust zonder schuldgevoel",
    ],
    suggestions: [
      "Zet je telefoon op stil",
      "Kies bewust een rustig moment",
      "Zorg dat je niet gestoord kunt worden",
      "Maak het gezellig: licht, geluid, warmte",
      "Schrijf na afloop één zin op over hoe je je voelt",
    ],
  },
  adventure: {
    label: "Avontuur",
    timeline: [
      "Alles regelen en vertrekken",
      "Onderweg zijn en het nieuwe opnemen",
      "Het moment waar je voor kwam",
      "Bijkomen en terugkijken",
    ],
    takeaways: [
      "Een verhaal dat je zelf hebt geschreven",
      "Een grens die een stukje is opgeschoven",
      "Een plek die je nu echt kent",
      "Het gevoel dat je iets durfde",
    ],
    suggestions: [
      "Regel vooraf de praktische dingen, dan kun je onderweg loslaten",
      "Zeg iemand waar je heen gaat",
      "Laat één ding bewust ongepland",
      "Maak onderweg één foto of aantekening",
      "Kijk terug: wat wil je hier volgende keer mee?",
    ],
  },
  market: {
    label: "Markt & winkelen",
    timeline: [
      "Aankomen en een eerste ronde lopen",
      "Kijken, proeven, praten met de standhouders",
      "Iets uitkiezen dat bij je past",
      "Een koffie met je vondst",
    ],
    takeaways: [
      "Iets moois dat je zelf hebt uitgezocht",
      "Nieuwe plekken en gezichten",
      "Een middag waarin toeval mocht meebeslissen",
      "Een verhaal bij je aankoop",
    ],
    suggestions: [
      "Neem een tas en contant geld mee",
      "Spreek met jezelf een maximum af",
      "Proef iets wat je niet kent",
      "Loop eerst één ronde voor je iets koopt",
      "Vraag één standhouder naar zijn verhaal",
    ],
  },
};

const EN_KINDS: Record<ActivityKind, KindCopy> = {
  creative: {
    label: "Creative",
    timeline: [
      "Calmly choosing what you want to make",
      "Getting started, no rush",
      "Having your work finished or wrapped",
      "A short walk or a coffee afterwards",
    ],
    takeaways: [
      "Something you made yourself",
      "A few hours entirely for yourself",
      "An experience that isn't about performing",
      "Hands that did something other than scroll",
    ],
    suggestions: [
      "Put your phone on silent",
      "Choose one design on purpose and take it slowly",
      "Take a photo of the result afterwards",
      "Bring a small notebook",
      "Give the result a place at home",
    ],
  },
  cultural: {
    label: "Culture",
    timeline: [
      "Arriving and looking around",
      "Looking, reading, letting it sink in",
      "Picking what stays with you most",
      "Talking it over with a coffee or tea",
    ],
    takeaways: [
      "Something you saw that stays with you",
      "A fresh look at something familiar",
      "A story to tell later",
      "Inspiration without it being an obligation",
    ],
    suggestions: [
      "Pick one work or place that stays with you",
      "Bring a small notebook",
      "Take one photo of what moves you",
      "Don't read all the explanations first — look first",
      "Write down one sentence about it when you're home",
    ],
  },
  outdoor: {
    label: "Outdoors",
    timeline: [
      "Setting off, no rush",
      "Walking or looking wherever you feel like",
      "A resting spot to sit for a while",
      "Heading back or going a bit further",
    ],
    takeaways: [
      "Fresh air and a calmer head",
      "A place you didn't know yet",
      "Movement that doesn't feel like sport",
      "A few hours without a screen",
    ],
    suggestions: [
      "Put your phone on silent or airplane mode",
      "Dress for the weather, not for the plan",
      "Bring something to drink",
      "Take one photo along the way",
      "Choose a quiet moment on purpose",
    ],
  },
  active: {
    label: "Active",
    timeline: [
      "Warming up and getting a feel for the place",
      "The real thing, at your own pace",
      "Resting and catching your breath",
      "Something to eat or drink",
    ],
    takeaways: [
      "Energy you can still feel afterwards",
      "Exercise that was mostly fun",
      "An achievement you decide on yourself",
      "A good feeling in your body",
    ],
    suggestions: [
      "Decide beforehand: for speed, or just for fun",
      "Bring water",
      "Wear something you don't mind sweating in",
      "Celebrate with something tasty afterwards",
      "Note how you feel when you're done",
    ],
  },
  water: {
    label: "On the water",
    timeline: [
      "Briefing and getting your gear",
      "Out on the water, with time to get used to it",
      "Coming ashore and catching your breath",
      "Dry clothes and something warm",
    ],
    takeaways: [
      "Your surroundings from a different angle",
      "A bit of adventure close to home",
      "Being completely in the moment",
      "A story to retell",
    ],
    suggestions: [
      "Bring dry clothes and a towel",
      "Leave your phone safe or use a waterproof pouch",
      "Check the weather beforehand",
      "Pick a time with calm water",
      "Take a photo from the shore of where you were",
    ],
  },
  food: {
    label: "Food & drink",
    timeline: [
      "Arriving and picking a spot",
      "Ordering or tasting, no rush",
      "A second round or something sweet",
      "A short walk or home",
    ],
    takeaways: [
      "Something delicious you chose deliberately",
      "An hour in which nothing has to happen",
      "A new place to come back to",
      "Attention to flavour instead of hurry",
    ],
    suggestions: [
      "Put your phone on silent",
      "Order something you've never had",
      "Take your time with your first sip or bite",
      "Note the place for next time",
      "Bring a book or notebook",
    ],
  },
  social: {
    label: "Social",
    timeline: [
      "Arriving and soaking up the atmosphere",
      "Joining in, listening, watching",
      "Picking a highlight",
      "Some fresh air or one last drink",
    ],
    takeaways: [
      "An evening or afternoon with energy",
      "New faces or a new conversation",
      "Something to talk about later",
      "A reason to go out again",
    ],
    suggestions: [
      "Agree with yourself when you'll leave",
      "Bring some cash or a bank card",
      "Say yes once to something you hadn't planned",
      "Bring someone you enjoy",
      "Put your phone away for a while",
    ],
  },
  restful: {
    label: "Rest",
    timeline: [
      "Slowing down and setting up your spot",
      "Doing what feels good, at your own pace",
      "A quiet moment to wrap up",
      "Lingering a while, no plan",
    ],
    takeaways: [
      "A head that's a little emptier",
      "Time that was truly yours",
      "Something small you can return to",
      "Rest without guilt",
    ],
    suggestions: [
      "Put your phone on silent",
      "Choose a quiet moment on purpose",
      "Make sure you won't be disturbed",
      "Make it cosy: light, sound, warmth",
      "Write down one sentence about how you feel afterwards",
    ],
  },
  adventure: {
    label: "Adventure",
    timeline: [
      "Sorting everything out and setting off",
      "On the way, taking in the new",
      "The moment you came for",
      "Catching your breath and looking back",
    ],
    takeaways: [
      "A story you wrote yourself",
      "A limit that moved a little",
      "A place you now really know",
      "The feeling that you dared",
    ],
    suggestions: [
      "Arrange the practical things beforehand so you can let go on the way",
      "Tell someone where you're going",
      "Leave one thing deliberately unplanned",
      "Take one photo or note along the way",
      "Look back: what do you want to do with this next time?",
    ],
  },
  market: {
    label: "Markets & shopping",
    timeline: [
      "Arriving and walking a first lap",
      "Looking, tasting, chatting with the stallholders",
      "Choosing something that suits you",
      "A coffee with your find",
    ],
    takeaways: [
      "Something lovely you chose yourself",
      "New places and faces",
      "An afternoon where chance got a say",
      "A story to go with your purchase",
    ],
    suggestions: [
      "Bring a bag and some cash",
      "Set yourself a maximum",
      "Taste something you don't know",
      "Walk one lap before you buy anything",
      "Ask one stallholder for their story",
    ],
  },
};

export type EditorialDoor = "natural" | "discovery" | "unexpected" | "stretch" | "wildcard";

const NL_EDITORIAL: Record<EditorialDoor, { label: string; texts: string[] }> = {
  natural: {
    label: "Klein detail",
    texts: [
      "Je hoeft hier niets te presteren. Dat je het doet, is al het punt.",
      "Vertrouwd betekent niet saai. Soms is het net de plek waar je eindelijk rust vindt.",
    ],
  },
  discovery: {
    label: "Ontdek",
    texts: [
      "Je hoeft niet ver weg om iets nieuws te ervaren. Soms begint het om de hoek.",
      "Een bekende omgeving wordt verrassend zodra je haar als bezoeker bekijkt.",
    ],
  },
  unexpected: {
    label: "Een andere kijk",
    texts: [
      "Het voelt misschien vreemd op papier. Juist daarom blijft het achteraf hangen.",
      "Wie iets onverwachts doet, ziet ineens ook het bekende met andere ogen.",
    ],
  },
  stretch: {
    label: "Durf",
    texts: [
      "Het mag spannend zijn. Je doet dit in je eigen tempo en je mag altijd bijsturen.",
      "Net buiten je comfortzone gebeurt het meeste. Je hoeft er niet groot in te zijn.",
    ],
  },
  wildcard: {
    label: "Een uitschieter",
    texts: [
      "Dit stellen we normaal niet voor. Daarom vonden we dat je het moest weten.",
      "Niet elk idee hoeft logisch te zijn. Soms is dit precies de reden om het toch te doen.",
    ],
  },
};

const EN_EDITORIAL: Record<EditorialDoor, { label: string; texts: string[] }> = {
  natural: {
    label: "Small detail",
    texts: [
      "You don't have to perform here. The fact that you do it is already the point.",
      "Familiar doesn't mean dull. Sometimes it's exactly where you finally find rest.",
    ],
  },
  discovery: {
    label: "Discover",
    texts: [
      "You don't have to go far to experience something new. Sometimes it starts around the corner.",
      "A familiar place turns surprising the moment you look at it as a visitor.",
    ],
  },
  unexpected: {
    label: "A different view",
    texts: [
      "It may sound odd on paper. That's exactly why it tends to stay with you afterwards.",
      "Do something unexpected and suddenly the familiar looks different too.",
    ],
  },
  stretch: {
    label: "Dare",
    texts: [
      "It's allowed to be a little exciting. You do this at your own pace and can always adjust.",
      "Most happens just outside your comfort zone. You don't have to be good at it.",
    ],
  },
  wildcard: {
    label: "An outlier",
    texts: [
      "We wouldn't normally suggest this. That's why we thought you should know about it.",
      "Not every idea has to be logical. Sometimes that's exactly the reason to do it anyway.",
    ],
  },
};

export interface IdeaPageLabels {
  glance: string;
  time: string;
  level: string;
  company: string;
  place: string;
  type: string;
  match: string;
  experience: string;
  dimensions: Record<ExperienceDimension, string>;
  schedule: string;
  scheduleStart: string;
  scheduleDuring: string;
  scheduleFinish: string;
  scheduleAfter: string;
  takeaways: string;
  personalise: string;
  steps: string;
  bring: string; // prefix of the derived "what to bring" step
  invest: string;
  investIndication: string;
  where: string;
  startHere: string;
  budgetWithin: string;
  budgetSlightlyAbove: string;
  budgetAbove: string;
  matchTime: string; // {time}
  matchTimeBudget: string; // {time}, {budget}
}

const NL_LABELS: IdeaPageLabels = {
  glance: "In één oogopslag",
  time: "Tijd",
  level: "Niveau",
  company: "Gezelschap",
  place: "Plaats",
  type: "Type",
  match: "Waarom dit bij jou past",
  experience: "Jouw ervaring",
  dimensions: {
    creativity: "Creativiteit",
    calm: "Rust",
    discovery: "Ontdekking",
    social: "Sociale prikkel",
    comfortZone: "Comfortzone",
  },
  schedule: "Een mogelijke invulling",
  scheduleStart: "Start",
  scheduleDuring: "Tijdens",
  scheduleFinish: "Afronden",
  scheduleAfter: "Daarna",
  takeaways: "Wat je eraan overhoudt",
  personalise: "Maak het van jou",
  steps: "Praktisch",
  bring: "Nodig",
  invest: "Jouw investering",
  investIndication: "Indicatie kosten",
  where: "Waar?",
  startHere: "Begin hier",
  budgetWithin: "Binnen je oorspronkelijke budget.",
  budgetSlightlyAbove: "Iets boven je budget — maar mogelijk interessant als uitzondering.",
  budgetAbove: "Boven je budget — bekijk of dit de uitzondering waard is.",
  matchTime: "Het past bij de tijd die je hebt ({time}).",
  matchTimeBudget: "Het past bij de tijd ({time}) en het budget ({budget}) dat je opgaf.",
};

const EN_LABELS: IdeaPageLabels = {
  glance: "At a glance",
  time: "Time",
  level: "Level",
  company: "Company",
  place: "Place",
  type: "Type",
  match: "Why this fits you",
  experience: "Your experience",
  dimensions: {
    creativity: "Creativity",
    calm: "Calm",
    discovery: "Discovery",
    social: "Social stimulus",
    comfortZone: "Comfort zone",
  },
  schedule: "One possible shape",
  scheduleStart: "Start",
  scheduleDuring: "During",
  scheduleFinish: "Wrap-up",
  scheduleAfter: "Afterwards",
  takeaways: "What you take away",
  personalise: "Make it yours",
  steps: "Practical",
  bring: "You'll need",
  invest: "Your investment",
  investIndication: "Estimated cost",
  where: "Where?",
  startHere: "Start here",
  budgetWithin: "Within your original budget.",
  budgetSlightlyAbove: "Slightly over budget — but possibly worth it as an exception.",
  budgetAbove: "Over budget — see whether it's worth the exception.",
  matchTime: "It fits the time you have ({time}).",
  matchTimeBudget: "It fits the time ({time}) and the budget ({budget}) you gave.",
};

export function ideaPageLabels(locale: Locale): IdeaPageLabels {
  return locale === "en" ? EN_LABELS : NL_LABELS;
}

export function kindCopy(kind: ActivityKind, locale: Locale): KindCopy {
  return (locale === "en" ? EN_KINDS : NL_KINDS)[kind];
}

export function editorialFor(door: IdeaDoor, seed: string, locale: Locale): { label: string; text: string } {
  const entry = (locale === "en" ? EN_EDITORIAL : NL_EDITORIAL)[door as EditorialDoor] ??
    (locale === "en" ? EN_EDITORIAL : NL_EDITORIAL).discovery;
  return { label: entry.label, text: pickStable(entry.texts, 1, seed)[0] };
}

export interface ScheduleStep {
  label: string;
  text: string;
}

// Three steps for a short idea (an hour or so has no real "afterwards"),
// otherwise four.
export function scheduleFor(kind: ActivityKind, durationText: string, locale: Locale): ScheduleStep[] {
  const labels = ideaPageLabels(locale);
  const copy = kindCopy(kind, locale);
  const hours = parseDurationHours(durationText);
  const all: ScheduleStep[] = [
    { label: labels.scheduleStart, text: copy.timeline[0] },
    { label: labels.scheduleDuring, text: copy.timeline[1] },
    { label: labels.scheduleFinish, text: copy.timeline[2] },
    { label: labels.scheduleAfter, text: copy.timeline[3] },
  ];
  return hours !== null && hours <= 1.5 ? all.slice(0, 3) : all;
}

// Fills "{name}" placeholders.
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

// Whether an idea's duration fits inside the time the person said they have
// ("hour" | "halfday" | "fullday" | "weekend"). False when it clearly doesn't
// and also when either side can't be read — the caller then just leaves the
// "it fits" sentence out rather than claiming something it can't back up.
const AVAILABLE_HOURS: Record<string, number> = { hour: 2, halfday: 4, fullday: 8, weekend: 48 };

export function timeFits(durationText: string, timeValue: string | undefined): boolean {
  if (!timeValue || !(timeValue in AVAILABLE_HOURS)) return false;
  const needed = parseDurationHours(durationText);
  return needed !== null && needed <= AVAILABLE_HOURS[timeValue];
}
