import { priorSkillOf } from "@/lib/discovery/priorSkill";
import { HOME_COUNTRY, countryName } from "@/lib/countries";
import type { RejectedLink } from "@/lib/claude/localResearch";
import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { runQualityGate } from "@/lib/claude/qualityRepair";
import type { QaIssue } from "@/lib/claude/qualityGate";
import { WINDOW_VOICE_SYSTEM_PROMPT, extractToolInput } from "@/lib/claude/shared";
import { freeWord, languageLabel, type Locale } from "@/lib/locale";
import type { IntakeAnswers } from "@/app/intake/actions";
import type { CharacterProfile } from "@/lib/characterProfile";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { checkFill, fillConflicts, fillContext, repeatedOpenings, type IdeaFill } from "@/lib/claude/ideaFill";
import { concreteOptionsRequired, coverageEnabled, knowledgeAnchorEnabled, knowledgeIndirectEnabled, knowledgeRankingV2Enabled, knowledgeWritingV2Enabled, searchV2Enabled } from "@/lib/knowledgeFlags";
import { fillFromReserve, reserveDepth, reserveExclusions, reserveFrom } from "@/lib/claude/searchPlan";
import {
  LOCATION_SCHEMA,
  PRACTICAL_SCHEMA,
  formatProfile,
  normalizeLocation,
  normalizePractical,
  toText,
  toTextArray,
} from "@/lib/claude/generateIdeaBook";
import { bookCostMeta, createCostLedger, type CostLedger, type RoundKind } from "@/lib/claude/costLedger";
import { loadSupplyEvidence } from "@/lib/claude/supplyIndex";
import { relevantOptions } from "@/lib/claude/optionRelevance";
import type { BookCostMeta } from "@/types/database";
import { PLACES_LIST_PRICE_USD, createRatingEnricher } from "@/lib/claude/placesRatings";
import { adjustedScore, researchNeedsFrom, researchSeeds, type LocalOption, type ResearchNeed, type ResearchStats, type SeedResearch } from "@/lib/claude/localResearch";
import { currentMonth, describeToday, inSeason, isoDateNL } from "@/lib/discovery/season";
import { editionDate, type Season } from "@/lib/seasonEdition";
import { engineInputFromIntake, relatedActivities, runEngine } from "@/lib/discovery/engine";
import { companionLine, companionsOf, directionLabel } from "@/lib/claude/optionLines";
import { modeOfActivity } from "@/lib/discovery/activityKind";
import { bookCriteria, criteriaSummary, type CriteriaReport } from "@/lib/claude/bookCriteria";
import { passesConstraints } from "@/lib/discovery/engine/constraints";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { WEIGHTS_ANCHOR, WEIGHTS_V2 } from "@/lib/discovery/engine/weights";
import {
  normalizeFeelsLike,
  normalizeNextStep,
  normalizePlaces,
  checkSizes,
  normalizeSizes,
  type RelatedActivity,
} from "@/lib/claude/ideaLayers";
import type { EngineResult, Seed } from "@/lib/discovery/engine";
import { photoCategoryFor } from "@/lib/discovery/engine/photo";
import { askPrice } from "@/lib/links/priceClaims";
import { addPrices, createPriceMemo, priceCheckEnabled, splitByBudget } from "@/lib/claude/priceResearch";
import { factCheck, factCheckEnabled } from "@/lib/claude/factCheck";
import { CHECK_TIMES, timeFor } from "@/lib/claude/checkTime";
import { scoresForSeed } from "@/lib/discovery/engine/scores";
import { ALL_ACTIVITIES, TAGS, getActivity } from "@/lib/discovery/library";
import type { Activity } from "@/lib/discovery/types";
import { getAssociation, imagesBehind, themeShortLabel } from "@/lib/discovery/associations";
import { BOOK_COUNT, IDEA_COUNT } from "@/lib/productStructure";
import { overlappingSeeds } from "@/lib/discovery/engine/overlap";
import { everywhereCandidates } from "@/lib/claude/everywhere";

// The Idea Book pipeline for people who used the card wizard (phase 4 of the discovery
// upgrade). Four steps, only two of which cost money:
//   1. the selection engine picks five seeds             (code, free)
//   2. local research for those seeds, grouped + cached   (one small-model call, often none)
//   3. Claude writes the ideas around the seeds           (one call)
//   4. checks against the research and the seeds          (code, free)
// Claude no longer chooses the ideas, the door, the photo category or the scores, and
// the UI labels come from the dictionaries: less to write, so a cheaper, steadier call.
// See docs/discovery-api-costs.md for the measured numbers.

/** Who goes through the seed pipeline: anyone who used the card wizard's interest step. */
export function shouldUseEngine(intake: Pick<IntakeAnswers, "interests" | "interestDomains" | "surpriseMe" | "intakeVariant">): boolean {
  return (
    intake.intakeVariant === "associations" ||
    (intake.interests?.length ?? 0) > 0 ||
    (intake.interestDomains?.length ?? 0) > 0 ||
    intake.surpriseMe === true
  );
}

const SYSTEM_PROMPT = `${WINDOW_VOICE_SYSTEM_PROMPT}

The person has just paid for their WindowInto Idea Book: five ideas (four regular ideas plus one wildcard),
printed as a PDF with a page or two per idea. The ideas have ALREADY BEEN CHOSEN for this person by a selection
step. You receive the five activities below, each with the door it belongs to, why it was chosen, how the
person wants to take part, an easy way in, and real local options found by research. Your job is to write
each idea well, in the order given.

Do not swap, add, drop or rename the activities and do not change their order. Where an idea is a "combination"
the idea IS that combination. Every field has a length guideline: concise and specific reads as considered,
padding reads as filler.

Rules for using the profile:
- Fields marked as MUST-HAVES are hard constraints. Never write an idea that violates one. If one cannot be met
  by the given activity, keep the idea but make it satisfiable (a different variant, place or time), and never
  ignore the must-have.
- PREFERENCES are soft nudges only.
- The internal character signals are for tone only. Never name them or their numbers, and never conclude
  anything about the person's sociability, shyness or character from their interests.
- The wildcard must be a real, usable idea (never a joke), framed with a knowing "we probably shouldn't suggest
  this, but that's exactly why you'll love it" spirit, and it still respects the must-haves.

For every idea:
- title (max ~6 words), intro (one sentence, max ~18 words). The title says what the person will do and it must be TRUE OF THE FIRST verified
  local option of that idea: take the setting from that option's "is" line (what the place really is) and its note, never from the "Easy way in"
  line, which is only a general hint (a country house, a studio, a rooftop or a beach in it is not a fact about the options). When the first
  option is a café on the heath, the title is a high tea at a café on the heath, or simply a high tea, never a high tea in a country house.
  Never put a setting, a building or a kind of place in the title (or anywhere in the idea) that none of the verified options shows. When no
  option was found, keep the title to the plain activity.
- why_it_fits: one sentence (max ~18 words), a direct, personal callback that proves you listened. Follow the
  "Why it was chosen" line of that idea: for something they picked themselves, refer to that pick; for an
  adjacent, unexpected, stretch or wildcard idea, make the connection visible in plain words ("You picked X,
  and this shares the Y with it"). Never invent a connection that is not given.
- details: exactly 2 concrete, sequential steps that read like a ready-made how-to (max ~20 words each). A physical
  place comes first: when the verified local options of the idea include a place in a town (a workshop, studio, club
  or venue), step 1 is to contact or visit that place (book, call, check the opening times or the trial class) and
  step 2 is what happens or what to bring there; name the place and its city, and use its website only to book or
  check times. Only when the verified options of the idea are online providers (marked "Online") is the way in an
  online course, an app or a webshop: then name that provider and its website. Never prefer an online provider over
  a physical place that is listed. When no verified option was found, say plainly to look up the activity with the
  person's place on Google Maps and to call the nearest one. Never "consider" or "look online".
- first_action: one instruction the person can complete within 60 seconds of finishing reading: with a physical
  place listed, call or message it, open its booking page or check its opening times (name the place); with only an
  online provider listed, open its website or start there (max ~20 words).
- practical: estimated_cost (exactly one of three: the price a verified local option of this idea states, copied exactly, e.g. "€19,50";
  "{{FREE}}" when that option says it is free or nothing at all has to be bought or booked; otherwise exactly "{{ASK}}"), duration (short), difficulty ("easy",
  "moderate" or "demanding") and preparation (one short line, or empty).
- location: only when the idea happens at one specific, findable place taken from the verified local options of
  THAT idea (name and city; the address only when the research gives it). Otherwise null. The options are listed
  best rated first: when you name one, take the first that fits, and never a lower rated one without a reason from
  the person's profile. Never state a rating yourself; it is shown separately.
- requirements: up to 4 short items (a few words each) to arrange, buy or bring; empty when nothing is needed.
- Follow the "How to take part" line: open with the form the person chose and mention other forms only as
  alternatives. Use the "Easy way in" as the starting point, adapted to the local option where there is one.
- If an idea says it may only be suggested with qualified supervision, say so in its steps and only offer the
  supervised, legal way in.
- Never invent a business name, street address, ticket price, opening hours or website that is not in that idea's
  verified local options. Never say anything about a venue itself (a room, a cellar, a garden, a view, its history, a special seating, a menu) that
  its verified note does not state. For an idea that is a combination of two activities and has places for one half only, the other half is
  something the person can add or look for (a historic setting, a second activity), never a claim about the venue. Do not mention opening hours.
- Write final text only. Never include a self-correction, hesitation or alternative in a step or action (no "nee,",
  "eigenlijk", "or rather", "..." followed by a better version). Check every website address against that
  idea's verified local options BEFORE you write it, and write it once, correctly.
- No assumed skill: the person has NO specialist skill unless their profile says so. The first step and the first_action must be doable today by
  a complete beginner. Never ask them to read or change program code, to use GitHub or open a pull request, to bring a certificate or licence, or to
  already know a tool or technique. For an idea built on a skill, the first step is the beginner's way in (a trial lesson, a starter kit, a first
  guided exercise).
- Country, language and audience: the profile says their country and the book's language. Name only providers and websites that serve people in
  that country and offer the book's language or English (a venue in their own town may use the local language). Never send them to a provider or
  shop of another country. The person is an adult unless children go with them: no children's products or children's parties for an adult.
- Web addresses: write an address in a step only when it is the website of one of that idea's verified local options, exactly as given there.
- Prices: never estimate, guess, round or give a range of your own, in any field. Write an amount only when a verified local option of
  that idea states it, copied exactly. Never say or suggest that an idea is cheap or fits their budget unless such a stated price shows it.
  A course or a series usually costs far more than one visit, so one lesson's price says nothing about it.
- Season and date: you are given today's date. Every idea must be realistic on that date and in the weeks after
  it, in the Dutch weather of that season. Never write about what is out of season (open-water swimming or a
  terrace evening in winter, a snow scene in autumn), and never promise a market, festival or event unless it is
  one of that idea's verified local options; use a date only when an option states it. If an option ends soon
  (it has an end date), say so in the steps.

- Use what the person gave (the profile lists their time, budget, company and distance). Across the five ideas: at
  least one idea must fill the time they have (say its real duration honestly). Their budget is a limit: when a
  verified option states a price above it, prefer an option that does not, and otherwise say plainly that it costs
  more. Never write a price to make an idea fit. Respect the company (alone, partner, friends, family), the distance
  and every hard limit in every idea.
- Every idea has its own wording. Never reuse a sentence, or the same sentence frame, across ideas (not even "this
  fits your time and budget"): say what makes THIS idea suit THIS person.
- Never show the machinery: no arrows, no talk about images, choices, how the idea was found or what "we derived".
  Plain, finished sentences; no colons chaining several clauses together.

Also write profile_summary (one warm, specific sentence reflecting their situation back), must_haves and
preferences (short cleaned-up phrases echoing what they told you; do not invent new ones).

Write absolutely everything in {{LANGUAGE}}, not English, unless {{LANGUAGE}} is English.`;

// R2.3 "more body per door": the extra layers are written by a SECOND call that runs at the same time
// as the one above, so the book takes about as long as the longer of the two instead of the sum
// (one call with everything took 65 s to write and went over the time limit when it had to retry).
// The layers are optional: if this call fails the book is delivered without them.
const LAYERS_SYSTEM_PROMPT = `${WINDOW_VOICE_SYSTEM_PROMPT}

The person has just paid for their WindowInto Idea Book. Five ideas (four regular ideas plus one wildcard) have
ALREADY BEEN CHOSEN for them and are being written by someone else. You write ONLY the extra layers of each
idea, in the order given. You receive the profile and the five activities, each with the door it belongs to,
how the person wants to take part, an easy way in, and real local options found by research.

Do not swap, add, drop or rename the activities and do not change their order. Every field has a length limit:
concise and specific reads as considered, padding reads as filler.

Rules for using the profile:
- Fields marked as MUST-HAVES are hard constraints: no size or step may violate one.
- If the profile says the book is a GIFT, write to the recipient ("you"), never about "the buyer".
- The internal character signals are for tone only; never name them or conclude anything about the person's
  character from their interests.

For every idea:
- feels_like: exactly two short sentences (max ~30 words in all), present tense, second person: a sensory scene
  of what it is like to be there (what you see, hear, smell, touch). Only what is true of this kind of activity
  in general: no named place, no price, no promise. If the person's chosen sense images fit the idea you may let
  one of them colour the scene, never forced and never named literally.
- sizes: exactly three, in this order: (1) a taste: the cheapest real way to try it, about one hour and never
  more than ninety minutes; (2) a day: about half a day, the proper first experience; (3) further: a weekend, a
  course or a series, for when they love it. Each has a title (max ~4 words), description (one sentence, max ~16
  words), estimated_cost and duration (both short: at most 25 characters each, count them; estimated_cost follows the price rules below).
- next_step: one sentence (max ~18 words): what to do after the first time (a second go, the next level,
  joining something).

Honesty. These matter more than anything above:
- Name a business, club, venue or website ONLY when it appears in THAT idea's verified local options. Otherwise
  stay generic (for example "a local club" or "a workshop nearby", written in {{LANGUAGE}}). Never name an organisation from memory,
  however well known it is.
- Write "{{FREE}}" ONLY when that idea's verified local options or its "Easy way in" line say it is free, or when
  nothing at all has to be bought or booked (sitting still at home, a walk from your own door).
- Prices: write an amount only when a verified local option of that idea states it, copied exactly and for the same
  thing (one lesson's price is not the price of a course). Everything else is exactly "{{ASK}}". Never estimate or
  guess a price, in a cost field or in a sentence.
- Never invent a price list, opening hours or an address.
- You are given today's date. The taste, the day and the "further" size must all be realistic in this season and
  in the weeks after it; never describe something that is out of season or an event that is not one of that
  idea's verified local options.
- If an idea says it may only be done with qualified supervision, its taste is the supervised, legal first
  step.

Write absolutely everything in {{LANGUAGE}}, not English, unless {{LANGUAGE}} is English.`;

// B5 / V1, only with KNOWLEDGE_ENGINE_V2 on. The PDF's "possible way to spend it", "what you take away" and
// "make it yours" blocks were taken from ten fixed templates per kind of activity and sometimes contradicted the
// idea. These lines are inserted into the layers prompt (before its "Honesty" part) and the three fields are
// added to the layers schema; the book is checked against them afterwards (src/lib/claude/ideaFill.ts).
export const FILL_PROMPT_RULES = `- timeline: exactly four short lines (max ~12 words each) describing ONE possible way a first real session could
  go, in this order: arriving or starting; the main part; finishing; afterwards. Specific to THIS activity (say
  what is actually being done: the clay, the route, the board), present tense, no clock times, no claim about
  any provider's schedule, no named business unless it is one of that idea's verified local options. Follow the
  route of that idea's "Easy way in" line and its verified local options; never switch the medium or the route
  (for example from building a physical thing to using software, or from a class to doing it at home).
- takeaways: exactly three short lines (max ~10 words each): what this person is likely to take home from THIS
  activity (a skill, something made, a feeling, a story). Nothing that every activity could say.
- suggestions: exactly three short lines (max ~12 words each): small, concrete ways to make THIS activity theirs
  (what to bring, what to try, what to note down). They must fit the "How to take part" line: for something done
  alone, never suggest bringing or meeting other people; for an online activity, never mention travelling, parking,
  cash or a bank card; for an indoor activity, never mention rain or sun gear. Vary the openings across all the
  ideas: no verb may start more than two of the suggestions in the whole book (three per idea), and a note-taking tip at most
  twice in total. Every suggestion is written entirely in {{LANGUAGE}}, its first word included. Check the
  openings of all the suggestions before you answer and change any verb that comes up more than twice.
`;

// B5 / V1 (KNOWLEDGE_ENGINE_V2): the separately written fill lines (timeline, takeaways, suggestions) follow the route of
// each idea's "Easy way in" line. The ideas call must follow the same route, or the page contradicts itself (a timeline
// that solders while the first action downloads software, seen in the first paid comparison). Inserted before "For every idea:".
export const ROUTE_CONSISTENCY_RULE = `Route. The "Easy way in" line of an idea is the route its steps and first action follow. Choose another route
only when that idea's verified local options clearly offer it, and never switch the medium (for example from building
a physical thing to downloading software, or from a class to something at home): the page also shows a timeline of
that same route, written separately.

`;

// B5 / V2, only with KNOWLEDGE_ENGINE_V2 on and only for the image intake: the person chose pictures, never
// activities. The activities the selection derived from those pictures were presented to the writer as things
// they "picked" ("Related to something they picked"), and the text followed. Inserted before "For every idea:".
const NEED_RULES: Record<ResearchNeed, string> = {
  evening: "They want to go in the evening. Say so in the first step (check that it runs in the evening) and name the evening time only when the verified options show it. Never suggest being somewhere remote or unlit after dark: where an activity is normally outdoors, write the version in a busy, lit place, or say plainly that it is better by day.",
  transport: "They have no car. Never assume parking. Say how to get there without one only when the verified option shows the station or stop; otherwise tell them to check the route on 9292 before booking.",
  accessibility: "They need step-free access. Never claim a place is accessible unless the verified option says so; in the first step tell them to ask about step-free access when booking.",
  children: "They go with children. Write the idea as something to do with children, say in the first step to check the minimum age when booking, and never suggest anything for adults only.",
  young_children: "They go with young children (toddlers and pre-schoolers). Write every idea so it works with children of that age: short, close by, room to move, no long waiting. In the first step say to check the minimum age and whether a parent may join, and never suggest anything with a minimum age above six.",
  no_alcohol: "They do not want alcohol. Never plan an idea around drinking. Where a place is a bar, café or brewery, write the version that works without a drink and say that in the first step.",
  quiet: "They want quiet and predictable. Write every idea with a fixed time, a clear structure and little noise: say what happens, how long it takes and how many people are likely to be there, and never suggest anything improvised, loud or crowded.",
  no_dutch: "They do not speak Dutch. Say in the first step that no Dutch is needed or that they should ask whether the host speaks English, and never rely on them reading Dutch signs, forms or websites; give the English name of a place or event when there is one.",
  meet_people: "They want to meet new people. Write every idea so that meeting others is part of it: say in the first step how to join (an open evening, a regular group, a course), that coming alone is fine, and never rely on them bringing friends.",
  calm_pace: "They want a calm pace. Write every idea as something unhurried: no rush, no competition, no long exertion. Offer the quiet version of an activity and name when a place is likely to be busy.",
};

/** Practical wishes as writing rules, or an empty string. The engine can only flag these (no data to filter on), so the writer must carry them. */
export function practicalNeedsPrompt(needs: readonly ResearchNeed[]): string {
  if (needs.length === 0) return "";
  const lines = needs.map((n) => `- ${NEED_RULES[n]}`);
  return ["Practical needs the person stated (these apply to every idea; never invent a fact to satisfy them):", ...lines, "", ""].join("\n");
}

export const HONEST_ORIGIN_RULE = `The person chose IMAGES, not activities. An activity that is not marked as "chosen" was reached by us from
their images. Never write that they picked, chose or selected an activity, and never claim an interest they did
not state. Say what their images pointed to ("the image of candlelight pointed towards quiet, and this shares
that quiet") and, where an idea has an "Image behind it" line, you may name that image once.

`;

const FILL_SCHEMA_FIELDS = {
  timeline: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
  takeaways: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
  suggestions: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
};

const TAG_LABEL = new Map(TAGS.map((t) => [t.id, t.label]));

const FORMAT_TEXT: Record<string, string> = {
  solo: "alone",
  drop_in_alone: "coming alone and doing it together with others (everyone is new)",
  duo: "with one other person",
  small_group: "in a small group",
  large_group: "in a larger group",
  with_known: "with people they already know",
  online: "online",
};

/**
 * The "Why it was chosen" line of one seed. `honest` (KNOWLEDGE_ENGINE_V2 and the image intake) never calls a
 * derived activity "picked": the person chose images, and the activities in between are what we read from them.
 */
/** C2: what the writer must know about how an idea can be done, so the first step matches (nobody is told to book a trial class for something they do at home). */
const MODE_FOR_PROMPT = {
  self: "by themselves, starting with what is at hand; the first step is something they can do today, and they do not need a provider",
  provider: "it needs a provider, a class, a club or a venue; the first step is to find or book one (the verified options below are the ones to use)",
  organise: "it has to be organised first (a trip, an event, something to set up); the first step is to plan it: who, when and where",
} as const;

export function why(seed: Seed, locale: Locale, fromImages = false, honest = false): string {
  const label = (id: string) => getActivity(id)?.label[locale] ?? id;
  const via = seed.via.map((t) => TAG_LABEL.get(t)?.[locale] ?? t).join(", ");
  // Theme tiles (E4): an idea at the meeting point of two areas the person chose that lie far apart. They chose both areas, not this mix.
  if (seed.themeCombo && !seed.hybrid) {
    const [x, y] = seed.themeCombo.map((t) => themeShortLabel(t, locale));
    return `An unexpected meeting of two areas the person chose, "${x}" and "${y}": the combination is ours, the two areas are theirs. Let the idea show how both come together${via ? ` (shared: ${via})` : ""}.`;
  }
  if (honest && fromImages) {
    const sharing = via ? ` (shared: ${via})` : "";
    if (seed.hybrid) {
      return `A combination the person did not ask for but that grows out of what their chosen images point to (${label(seed.hybrid.partnerId)}): "${seed.hybrid.label[locale]}".`;
    }
    switch (seed.direction) {
      case "adjacent":
        return `Reached from their images, not picked by them: their images point towards ${seed.chain.map(label).join(" → ")}${sharing}.`;
      case "unexpected":
        return `Far from what their images point to, reached by a path that starts at what the images suggest: ${seed.chain.map(label).join(" → ")}${sharing}. They did not pick any of it.`;
      case "stretch":
        return `A step beyond their comfort zone, starting from what their images point to (${label(seed.chain[0])})${via ? `, still sharing: ${via}` : ""}.`;
      case "wildcard":
        return seed.chain.length > 1
          ? `A random prompt from a direction their images did not point to, loosely tied to ${label(seed.chain[0])}.`
          : "A random prompt from a direction their images did not point to.";
      default:
    }
  }
  if (seed.hybrid) {
    return `A combination the person did not ask for but that grows out of what they picked (${label(seed.hybrid.partnerId)}): "${seed.hybrid.label[locale]}".`;
  }
  switch (seed.direction) {
    case "familiar":
      if (fromImages) {
        return seed.chain.length > 1
          ? `Close to an activity their chosen images point to (${label(seed.chain[0])}).`
          : "One of the activities their chosen images point to most directly.";
      }
      return seed.chain.length > 1 ? `Close to something they picked (${label(seed.chain[0])}).` : "They picked this themselves on the cards.";
    case "adjacent":
      return `Related to something they picked: ${seed.chain.map(label).join(" → ")}${via ? ` (shared: ${via})` : ""}.`;
    case "unexpected":
      return `Far from what they picked, reached by a path: ${seed.chain.map(label).join(" → ")}${via ? ` (shared: ${via})` : ""}.`;
    case "stretch":
      return `A step beyond their comfort zone from ${label(seed.chain[0])}${via ? `, still sharing: ${via}` : ""}.`;
    case "wildcard":
      return seed.chain.length > 1
        ? `A random prompt from a world they did not pick, loosely tied to ${label(seed.chain[0])}.`
        : "A random prompt from a world they did not pick.";
    default:
      return "Chosen to give a broad first taste, since they picked nothing specific.";
  }
}

function seedBlock(
  seed: Seed,
  index: number,
  research: SeedResearch | undefined,
  locale: Locale,
  chosenImages: readonly string[] = [],
  honest = false,
  explicitPicks = false,
  ownPick = false,
  /** The label of the activity the person chose themselves that this idea replaces (nothing real was found for it near them). */
  replaces?: string,
): string {
  const a = getActivity(seed.activityId)!;
  // Image intake: the chosen image that lies behind this idea, for "Omdat je X koos".
  const behind = imagesBehind(a.tags, chosenImages, 1).map((id) => getAssociation(id)?.label.en).filter(Boolean)[0];
  const name = seed.hybrid ? seed.hybrid.label[locale] : a.label[locale];
  const forms = [seed.lead, ...seed.alsoFormats].filter((f): f is NonNullable<typeof f> => !!f).map((f) => FORMAT_TEXT[f]);
  const take = seed.lead
    ? `lead with "${FORMAT_TEXT[seed.lead]}"${forms.length > 1 ? `; also possible: ${forms.slice(1).join(", ")}` : ""}`
    : forms.length
      ? `no stated preference; it can be done ${forms.join(", ")}`
      : "no stated preference";
  const options = research?.options.length
    ? research.options
        .map(
          (o) =>
            `    - ${o.name}${o.city ? ` (${o.city})` : ""}${o.kind ? ` — is: ${o.kind}` : ""}${o.match === "close" ? " [another form than the usual way in]" : ""}: ${o.note}${o.until ? ` (until ${o.until})` : ""}` +
            `${o.rating ? ` [rated ${o.rating.score}/5${o.rating.reviews !== null ? `, ${o.rating.reviews} reviews` : ""}, ${o.rating.source}]` : ""}` +
            `${o.price ? ` [price on its own website: ${o.price.text}${o.price.label ? `, ${o.price.label}` : ""}]` : ""}${o.url ? ` — ${o.url}` : ""}`,
        )
        .join("\n")
    : ownPick && needsProvider(a)
      ? "    NONE FOUND near this person, but the person chose this activity themselves, so it stays. Say so plainly in one sentence (no provider could be verified near them) and do not name, claim or imply any venue, club or provider; keep the location null. Make the idea doable anyway: the easy way in above, the exact words to search for or the question to ask, and where it makes sense a version they can do themselves or a free first taste."
    : needsProvider(a)
      ? "    NONE FOUND near this person: do not name, claim or imply that any venue, club, hall or provider exists there. Keep the location null and write the idea as something to find out first (ask whether anyone near them offers it), never as a place to go."
      : "    none verified: keep this idea's location null and its steps generic (Google Maps, Meetup, an exact search)";
  return [
    `Idea ${index + 1} — ${seed.direction === "wildcard" ? "WILDCARD (the separate wildcard slot)" : `door: ${seed.door}`}`,
    `  Activity: ${name}`,
    `  Why it was chosen: ${why(seed, locale, chosenImages.length > 0 && !explicitPicks, honest)}`,
    replaces
      ? `  Replaces their own choice: the person chose "${replaces}" themselves, but nothing real could be found for it near them. Say so in one short, warm sentence in why_it_fits (for example "Je koos ${replaces}; in jouw buurt vonden we daar niets dat nu past, dus dit verwante idee."), then write this idea fully on its own.`
      : null,
    behind ? `  Image behind it: "${behind}" (the chosen image this idea connects to; name it in why_it_fits)` : null,
    `  How to take part: ${take}`,
    `  How it can be done: ${MODE_FOR_PROMPT[modeOfActivity(a)]}`,
    `  Easy way in (a general hint, not a fact about the options below): ${a.entry ? a.entry[locale] : "not known; suggest a beginner-friendly first step"}`,
    a.safety.tier === 2 && a.safety.note
      ? `  Supervision: only with qualified supervision. ${a.safety.note[locale]}`
      : a.safety.note
        ? `  Permit or rule to mention in the first step: ${a.safety.note[locale]}`
        : null,
    seed.verify.includes("cost_unknown")
      ? "  Cost: not known; name no amount unless a verified option below states it."
      : seed.verify.includes("cost_near_budget")
        ? "  Cost: this kind of activity is often close to or above their budget; start with the cheapest way in (a trial class or a single session), tell them to ask its price, and name no amount the options below do not state."
        : null,
    `  Verified local options:\n${options}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const ENTRY_SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string" },
    intro: { type: "string" },
    why_it_fits: { type: "string" },
    details: { type: "array", minItems: 2, maxItems: 2, items: { type: "string" } },
    first_action: { type: "string" },
    practical: PRACTICAL_SCHEMA,
    location: LOCATION_SCHEMA,
    requirements: { type: "array", maxItems: 4, items: { type: "string" } },
  },
  required: ["title", "intro", "why_it_fits", "details", "first_action", "practical", "location", "requirements"],
};

// The layers of one idea (written by the second call). With KNOWLEDGE_ENGINE_V2 the three "fill" lists are added.
function layerEntrySchema(v2: boolean) {
  return {
    type: "object" as const,
    properties: {
      feels_like: { type: "string" },
      sizes: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object" as const,
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            estimated_cost: { type: "string" },
            duration: { type: "string" },
          },
          required: ["title", "description", "estimated_cost", "duration"],
        },
      },
      next_step: { type: "string" },
      ...(v2 ? FILL_SCHEMA_FIELDS : {}),
    },
    required: ["feels_like", "sizes", "next_step", ...(v2 ? ["timeline", "takeaways", "suggestions"] : [])],
  };
}

interface RawLayer {
  feels_like?: unknown;
  sizes?: unknown;
  next_step?: unknown;
  timeline?: unknown;
  takeaways?: unknown;
  suggestions?: unknown;
}

/**
 * The second call: the layers of all ideas, in the order of the seeds. Never throws and is not retried:
 * the layers are optional, so a failure just means a book without them (and it is logged).
 */
async function writeLayers(system: string, user: string, count: number, v2 = false, ledger?: CostLedger): Promise<RawLayer[] | null> {
  try {
    const startedAt = Date.now();
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 6000,
      system,
      messages: [{ role: "user", content: user }],
      tools: [
        {
          name: "create_layers",
          description: "Return the extra layers of every idea.",
          input_schema: {
            type: "object",
            properties: { ideas: { type: "array", minItems: count, maxItems: count, items: layerEntrySchema(v2) } },
            required: ["ideas"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "create_layers" },
    });
    ledger?.add("writing", message.usage, CLAUDE_MODEL);
    console.log(`WINDOW: layers call took ${Date.now() - startedAt}ms, usage=${JSON.stringify(message.usage)}`);
    const input = extractToolInput<{ ideas?: unknown }>(message, "create_layers");
    if (!Array.isArray(input.ideas) || input.ideas.length !== count) {
      throw new Error(`expected ${count} entries, got ${Array.isArray(input.ideas) ? input.ideas.length : "none"}`);
    }
    return input.ideas as RawLayer[];
  } catch (err) {
    console.warn(`WINDOW: layers call failed, the book goes without them: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

interface RawBook {
  profile_summary?: unknown;
  must_haves?: unknown;
  preferences?: unknown;
  ideas?: unknown;
  wildcard?: unknown;
}

/**
 * The ideas call is asked for four ideas plus a separate wildcard. In both test books made for a gift, the first
 * answer was thrown away for having "the wrong number of ideas" and the whole call was paid for again (twice
 * the cost, and 35 s more). The two near misses that cannot be misread are accepted instead:
 *  - five entries under "ideas" and no wildcard: the last one is the wildcard (it is the last idea we asked for),
 *  - five entries under "ideas" and a wildcard: the wildcard that was given is used.
 * Anything else is still an unusable answer (null) and goes to the retry.
 */
export function splitCoreAnswer(candidate: RawBook, count: number): { ideas: unknown[]; wildcard: unknown } | null {
  if (!Array.isArray(candidate.ideas)) return null;
  const list = candidate.ideas as unknown[];
  if (list.length === count - 1 && candidate.wildcard) return { ideas: list, wildcard: candidate.wildcard };
  if (list.length === count) return { ideas: list.slice(0, count - 1), wildcard: candidate.wildcard || list[count - 1] };
  return null;
}

// --- checks against the research ------------------------------------------------------------

// Platforms that are certainly real and may be named without research.
const ALWAYS_OK = new Set([
  "google.com", "google.nl", "maps.google.com", "meetup.com", "marktplaats.nl", "facebook.com", "instagram.com",
  "youtube.com", "wikipedia.org", "eventbrite.nl", "eventbrite.com", "tripadvisor.nl", "tripadvisor.com", "bibliotheek.nl",
  "buurtwerk.nl", "nlactief.nl", "natuurmonumenten.nl", "staatsbosbeheer.nl", "wandelnet.nl", "fietsersbond.nl",
]);

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

const DOMAIN_RE = /\b((?:[a-z0-9-]+\.)+(?:nl|com|org|eu|net|be|de|io|app|co\.uk))\b/gi;

/**
 * Anything specific that the model wrote must trace back to the research for THAT idea:
 * a location that is not one of its options is dropped, and websites it mentions that
 * appear nowhere in the research are reported (they are not removed: cutting words out of a
 * sentence would break it, and the report is what tells us how often it happens).
 */
export function checkEntry(entry: IdeaBookEntry, options: LocalOption[], allResearchHosts: ReadonlySet<string>): { entry: IdeaBookEntry; issues: string[] } {
  const issues: string[] = [];
  let out = entry;

  if (entry.location) {
    const wanted = entry.location.name.toLowerCase();
    const known = options.some((o) => {
      const n = o.name.toLowerCase();
      return n.includes(wanted) || wanted.includes(n);
    });
    if (!known) {
      issues.push(`location_not_in_research:${entry.location.name}`);
      out = { ...entry, location: null };
    }
  }

  const ownHosts = new Set(options.map((o) => (o.url ? hostOf(o.url) : "")).filter(Boolean));
  for (const text of [...entry.details, entry.first_action]) {
    for (const match of text.matchAll(DOMAIN_RE)) {
      const host = match[1].toLowerCase().replace(/^www\./, "");
      const ok = ALWAYS_OK.has(host) || [...ALWAYS_OK].some((d) => host.endsWith(`.${d}`)) || ownHosts.has(host) || allResearchHosts.has(host);
      if (!ok) issues.push(`unverified_website:${host}`);
    }
  }
  return { entry: out, issues };
}

function buildEntry(
  raw: unknown,
  seed: Seed,
  research: SeedResearch | undefined,
  option: { related: RelatedActivity[]; direction?: string },
  layer: RawLayer | undefined,
  fill?: IdeaFill,
): IdeaBookEntry {
  const e = (raw ?? {}) as Record<string, unknown>;
  const a = getActivity(seed.activityId)!;
  // R2.3 layers: each one is kept only when valid, so a layer can never fail the book.
  const feels_like = normalizeFeelsLike(layer?.feels_like);
  const sizes = normalizeSizes(layer?.sizes);
  const next_step = normalizeNextStep(layer?.next_step);
  const places = normalizePlaces(research?.options);
  const { related, direction } = option;
  const location = normalizeLocation(e.location);
  const practical = normalizePractical(e.practical);
  // The price of the place the idea names (else of its first one) is the idea's price: copied by code, not by the writer.
  const named = (location && places.find((p) => p.name.toLowerCase().includes(location.name.toLowerCase()) || location.name.toLowerCase().includes(p.name.toLowerCase()))) || places[0];
  return {
    ...(feels_like ? { feels_like } : {}),
    ...(sizes ? { sizes } : {}),
    ...(next_step ? { next_step } : {}),
    // Straight from the research (never written by the model), so each one is a verified place.
    ...(places.length ? { places } : {}),
    ...(related.length ? { related } : {}),
    ...(direction ? { direction } : {}),
    mode: modeOfActivity(a),
    ...(fill ? { fill } : {}),
    title: toText(e.title),
    intro: toText(e.intro),
    why_it_fits: toText(e.why_it_fits),
    details: toTextArray(e.details),
    first_action: toText(e.first_action),
    practical: named?.price ? { ...practical, estimated_cost: named.price.text } : practical,
    location,
    requirements: toTextArray(e.requirements),
    image_suggestion: a.scene,
    photo_category: photoCategoryFor(a),
    door: seed.door,
    ...(seed.level ? { level: seed.level } : {}),
    scores: scoresForSeed(seed, a),
    ...(seed.fit !== undefined ? { fit: Math.round(seed.fit * 100) } : {}),
    ...(seed.reasons ? { reasons: seed.reasons } : {}),
    activity_id: a.id,
    chain: seed.chain,
    requires_prior_skill: priorSkillOf(a),
  };
}

/** The ideas are for adults, unless the search is for a child or children go along (then a page aimed at children is fine). */
export function readerIsAdult(intake: Pick<IntakeAnswers, "company" | "searchContext">, verify: readonly string[]): boolean {
  if (intake.searchContext === "child" || (intake.company ?? []).includes("family")) return false;
  return !verify.includes("children") && !verify.includes("young_children");
}

/** The activities to research for these seeds: each seed's own and, for a curated combination, the other half too (Stap 125). */
export function researchIds(seeds: readonly Seed[]): string[] {
  const ids = new Set<string>();
  for (const s of seeds) {
    ids.add(s.activityId);
    if (s.hybrid && getActivity(s.hybrid.partnerId)) ids.add(s.hybrid.partnerId);
  }
  return [...ids];
}

/**
 * What the research found for one seed. A curated combination ("high tea at a country estate") is offered by the providers of
 * BOTH halves, so the options of its partner activity count too; before, only the seed's own half was looked at and the other
 * half's providers were lost (the Laren test book, 31 Oct 2026).
 */
export function seedResearch(seed: Seed, byActivity: ReadonlyMap<string, SeedResearch>): SeedResearch | undefined {
  const own = byActivity.get(seed.activityId);
  const partnerId = seed.hybrid && seed.hybrid.partnerId !== seed.activityId ? seed.hybrid.partnerId : undefined;
  const partner = partnerId ? byActivity.get(partnerId) : undefined;
  // The last guard before an option reaches the book or the count of what is still missing: it must be about this idea's activity (or its partner's). The research
  // refuses what is not already (optionRelevance.ts); this also covers answers that came from anywhere else, so a place that does not fit can never be shown.
  const fitting = (r: SeedResearch | undefined): SeedResearch | undefined => {
    if (!r || r.options.length === 0) return r;
    const options = relevantOptions(r.options, seed.activityId, { partnerId });
    return options.length === r.options.length ? r : { ...r, options };
  };
  const mine = fitting(own);
  if (own?.partnerMerged || !partner || partner.options.length === 0) return mine;
  const key = (o: LocalOption) => `${o.name}|${o.city}`.toLowerCase();
  const seen = new Set((mine?.options ?? []).map(key));
  const options = [...(mine?.options ?? []), ...(fitting(partner)?.options ?? []).filter((o) => !seen.has(key(o)))];
  return { activityId: seed.activityId, options, source: own?.source === "search" || partner.source === "search" ? "search" : (own?.source ?? partner.source) };
}

/**
 * Seeds that only make sense with someone else's offer (a class, a rental, a club: they cost money or need
 * supervision) and for which a research pass, which really ran, found no verifiable option. A failed research
 * pass is not counted: an outage is not proof that nothing exists.
 */
export function seedsWithoutSupply(seeds: readonly Seed[], byActivity: ReadonlyMap<string, SeedResearch>, requireAll = false): Seed[] {
  return seeds.filter((seed) => {
    const a = getActivity(seed.activityId);
    const r = seedResearch(seed, byActivity);
    if (!a || !r || r.source === "none") return false;
    return (requireAll || needsProvider(a)) && r.options.length === 0;
  });
}

/**
 * Anything that costs money, needs supervision or is not available everywhere needs a provider in reach (Stap 88:
 * "rare" and "regional" activities such as cave diving or glass blowing are only offered when the research found one).
 */
export function needsProvider(a: Activity): boolean {
  return (a.cost !== null && a.cost >= 1) || a.safety.tier === 2 || a.supply === "rare" || a.supply === "regional";
}

/**
 * The distance to search over for an idea with nothing near the person: twice the chosen one, at most 150 km. Null when they already search 100 km or more,
 * or all of the Netherlands (there is nothing wider to try). `searchDistance` is the older three-way class, `km` the start page's slider.
 */
export function widerRadiusKm(searchDistance: string | undefined, km: number | undefined): number | null {
  const base = km ?? (searchDistance === "hour" ? 60 : searchDistance === "anywhere" ? null : 15);
  if (base === null || base >= 100) return null;
  return Math.min(150, base * 2);
}

/** What a second place is worth when the reserve ideas are compared (the unit is a rating point: a venue with 4.5 against one with 4.0 and two places). */
export const SECOND_PLACE_BONUS = 0.3;

/** Rounds of replacing ideas whose provider could not be found. The last round only allows activities that need none. */
export const SUPPLY_ROUNDS = 2;

/**
 * How long the research of one book may keep starting new search rounds (ms). Every round takes about 15 s; the whole function may run 300 s and
 * the writing needs about 100 s of that. After this, what is still without an option is settled from what the earlier rounds already found.
 */
export const RESEARCH_BUDGET_MS = 150_000;

/** Rounds that replace ideas without a real place (the coverage stage), and how many candidates each lacking idea gets per round. */
export const COVERAGE_ROUNDS = 3;
export const COVERAGE_CANDIDATES_PER_SEED = 5;
/** Of those, how many are "everywhere" activities (everywhere.ts) from the second coverage round on. */
export const EVERYWHERE_PER_SEED = 3;
/**
 * The fewest ideas (the wildcard included) a book is left with. It is the whole book (Jan, 16 Nov 2026: a book with four instead of five is wrong): an idea
 * without a real place is no longer left out, it is replaced (the reserve, the coverage rounds, the "everywhere" activities) and, when nothing at all can be
 * found, kept and written honestly as something to find out first (coverage_incomplete).
 */
export const MIN_SEEDS = BOOK_COUNT;

/** An activity that is online by nature (a writing course, a language app): its option is an online provider from the start, not a place. */
export function isOnlineByNature(a: Activity | undefined): boolean {
  return !!a && !!a.formats && a.formats.includes("online") && a.formats.every((f) => f === "online" || f === "solo");
}

/**
 * One place, one idea: an option (name + city) that an earlier idea already has is taken away from a later one. The person's own choices
 * come first, so a place they asked for is never lost to an idea the engine added. A later idea whose every option was already taken is left
 * with none, and so counts as lacking an option (it is replaced, never written around a place that is already used).
 * A curated combination also reads its partner activity's options (seedResearch); those count too, and are merged into the combination's own entry
 * here (partnerMerged), so the partner's place cannot reach the book a second time through the combination (the Laren book of 14 Nov 2026: a pen shop
 * for "fountain pens" and, through the combination "letters with a fountain pen", the same shop again).
 */
export function dedupePlaces(seeds: readonly Seed[], byActivity: ReadonlyMap<string, SeedResearch>, ownPicks: ReadonlySet<string> = new Set()): Map<string, SeedResearch> {
  const out = new Map(byActivity);
  const used = new Set<string>();
  const key = (o: LocalOption) => `${o.name}|${o.city}`.toLowerCase();
  const ordered = [...seeds.filter((s) => ownPicks.has(s.activityId)), ...seeds.filter((s) => !ownPicks.has(s.activityId))];
  for (const s of ordered) {
    const r = s.hybrid && s.hybrid.partnerId !== s.activityId ? seedResearch(s, out) : out.get(s.activityId);
    if (!r || r.options.length === 0) continue;
    const kept = r.options.filter((o) => !used.has(key(o)));
    if (s.hybrid && s.hybrid.partnerId !== s.activityId) out.set(s.activityId, { ...r, options: kept, partnerMerged: true });
    else if (kept.length !== r.options.length) out.set(s.activityId, { ...r, options: kept });
    // only the first option is "the" place of the idea; the others are alternatives and may be shared
    if (kept[0]) used.add(key(kept[0]));
  }
  return out;
}

/**
 * The activities the person chose themselves (page 2 of the two-page intake, or the cards of the card wizard). Never swapped
 * for something else because no provider was found: they stay in the book, honestly described. In the image intake of the
 * older kind the interests are only derived from images, so nothing is protected there.
 */
export function explicitPickIds(intake: Pick<IntakeAnswers, "interests" | "intakeFlow" | "intakeVariant">): string[] {
  const own = intake.intakeFlow === "images2" || !intake.intakeVariant;
  return own ? [...new Set(intake.interests ?? [])].filter((id) => !!getActivity(id)) : [];
}

const addStats = (a: ResearchStats, b: ResearchStats): ResearchStats => ({
  cached: a.cached + b.cached,
  searched: a.searched + b.searched,
  failed: a.failed + b.failed,
  dropped: a.dropped + b.dropped,
  checked: (a.checked ?? 0) + (b.checked ?? 0),
  ms: a.ms + b.ms,
});

export interface SeedPipelineReport {
  seeds: Seed[];
  /** How many of the ideas carry at least one concrete, verified option (a place or an online provider), and how many a rating. */
  options?: { ideas: number; withOption: number; withRating: number };
  notes: string[];
  research: { cached: number; searched: number; failed: number; dropped?: number };
  issues: string[];
  /** The quality gate: what it found before repairing and what was still wrong afterwards. */
  qa?: { found: QaIssue[]; remaining: QaIssue[] };
  /** C1: the six criteria of the reference's 4.4 on the finished book (bookCriteria.ts): how many checks applied, how many passed, and what failed. */
  criteria?: CriteriaReport;
  /** Only for a research-only run (the comparison script): the options found per idea, so the quality of the search can be read next to its cost. */
  placesPerIdea?: { activityId: string; options: { name: string; city: string; url: string | null; rating: number | null }[] }[];
  /** What the model calls of this book cost (USD), against the cap, and which optional rounds were skipped to stay under it; kept with the book (progress_meta.cost). */
  cost?: BookCostMeta;
}

export async function generateIdeaBookFromSeeds(
  intake: IntakeAnswers,
  locale: Locale,
  characterProfile: CharacterProfile,
  opts: {
    sessionId?: string;
    history?: readonly string[];
    /** A seasonal edition (off by default, see seasonEdition.ts): write for this season instead of the month of asking. */
    season?: Season | null;
    /** Called as the pipeline passes its steps, for the honest waiting screen. Never awaited for long. */
    onProgress?: (stage: "selected" | "researched", meta?: { ideas?: number; places?: number }) => Promise<void> | void;
    /**
     * Stop after the research (selection, local and online search, replacement rounds): nothing is written and `book` is null. Used to warm the
     * research cache while the buyer is still paying (prewarmResearch.ts), so the real generation finds every answer waiting.
     */
    researchOnly?: boolean;
    /** The cost ledger of the book. The caller makes it when it wants to read what a failed attempt had spent; without one the pipeline makes its own. */
    ledger?: CostLedger;
    /** Activities that earlier research near the person's place found nothing for (supplyIndex.ts). Without it they are read from the research cache. */
    quietSupply?: readonly string[];
    /** Activities that earlier research found a real option for near the person's place: tried first when an idea has to be replaced. */
    foundSupply?: readonly string[];
  } = {},
): Promise<{ book: GeneratedIdeaBook; report: SeedPipelineReport }> {
  // KNOWLEDGE_ENGINE_V2 (off by default): B4 ranking weights for the selection, B5 fill lines and honest wording for the writing.
  // Two flags (D9): B4 ranking and B5 writing are switched on separately.
  const anchor = knowledgeAnchorEnabled();
  const ranking = knowledgeRankingV2Enabled() || anchor;
  const v2 = knowledgeWritingV2Enabled();
  // 1. Select the seeds, for the month the person is asking in (seasonal activities are never suggested out of season).
  // A seasonal edition shifts "today" to a date in that season, so the selection, the research, the prompt and the quality gate all agree.
  const now = opts.season ? editionDate(opts.season, new Date()) : new Date();
  const month = currentMonth(now);
  const selectionSeed = opts.sessionId ?? `${Date.now()}`;
  // What earlier books already learned about this place: activities nothing was found for, twice. A soft penalty in the selection, so fewer ideas
  // need a broad, an online or a replacement round afterwards (the person's own picks are never touched). Fails soft: without it the selection is the old one.
  const evidence = opts.quietSupply || opts.foundSupply
    ? { quiet: [...(opts.quietSupply ?? [])], found: [...(opts.foundSupply ?? [])] }
    : await loadSupplyEvidence({ location: intake.location, searchDistance: intake.searchDistance, searchDistanceKm: intake.searchDistanceKm, country: intake.country });
  const quietSupply = evidence.quiet;
  const foundSupply = new Set(evidence.found);
  const select = (exclude: readonly string[]) =>
    runEngine(engineInputFromIntake(intake, { seed: selectionSeed, history: opts.history, month, exclude, quietSupply }), anchor ? { weights: knowledgeIndirectEnabled() ? WEIGHTS_ANCHOR : { ...WEIGHTS_ANCHOR, anchor: { ...WEIGHTS_ANCHOR.anchor, indirect: false } } } : ranking ? { weights: WEIGHTS_V2 } : undefined);
  let engine: EngineResult = select([]);
  if (engine.seeds.length < IDEA_COUNT) throw new Error("The selection engine could not find enough activities for this profile.");
  await opts.onProgress?.("selected", { ideas: engine.seeds.length });

  // 2. Research, grouped and cached (once, outside the retry loop below).
  const ownPicks = new Set(explicitPickIds(intake));
  const researchStartedAt = Date.now();
  // One enricher for the whole book: the Google scores of its places, within its own cap and the month's free allowance (placesRatings.ts).
  const ratings = createRatingEnricher();
  // What this book has cost so far (src/lib/claude/costLedger.ts): the optional rounds below stop when the next one would pass the cap (default USD 0.40).
  const ledger = opts.ledger ?? createCostLedger();
  // No further search round starts after the budget (RESEARCH_BUDGET_MS); what is still empty is then settled from what earlier rounds found.
  const overBudget = () => Date.now() - researchStartedAt > RESEARCH_BUDGET_MS;
  // The cost version: an optional round of this kind is skipped (and said so in the report) when it would take the book past its cap.
  // Once the book is in its coverage stage (below), a round is held to the hard ceiling instead: every idea must have a real place, so those rounds are not optional.
  let coverageStage = false;
  const costBlocks = (kind: RoundKind) => {
    if (coverageStage ? ledger.canAffordCoverage(kind) : ledger.canAfford(kind)) return false;
    ledger.skip(kind);
    return true;
  };
  // Search Engine 2.0 (Stap 200, WINDOW_SEARCH_V2): the book's ideas AND a reserve are researched in one go; an idea without a real place is then swapped for the
  // reserve idea of its direction that has one, instead of a new search round per replacement (src/lib/claude/searchPlan.ts).
  const poolSearch = searchV2Enabled() && concreteOptionsRequired();
  let reserve: Seed[] = [];
  if (poolSearch) {
    try {
      // Each further selection leaves out the book and everything already in the reserve, so every one adds new ideas.
      for (let level = 0; level < reserveDepth(); level++) {
        const left = [...engine.seeds, ...reserve];
        reserve = [...reserve, ...reserveFrom(left, select(reserveExclusions(left)).seeds)];
      }
    } catch (err) {
      console.warn("WindowInto: the reserve selection failed, the book is searched without a reserve", err instanceof Error ? err.message : err);
    }
  }
  const notes = [...engine.notes];
  const replacedPicks = new Map<string, string>(); // replacement activity id -> the label of the choice it replaces
  const researchedIds = new Set<string>();
  // Who the book is for decides which pages fit (links/pageFit.ts); what is refused is passed to the later search rounds so they find other places.
  const adultsOnly = readerIsAdult(intake, engine.constraints.verify);
  const rejectedLinks: RejectedLink[] = [];
  // Step 249: after every search the places' own sites are read for what a beginner pays (priceResearch.ts). A place far above the budget no
  // longer counts, so the replacing below treats an idea with only such places like one without a place. What the person chose stays.
  const pricing = priceCheckEnabled() && !opts.researchOnly;
  const priceMemo = createPriceMemo();
  const tooDearPlaces = new Map<string, LocalOption[]>();
  // Its own time per book and a latest moment in the book (checkTime.ts): slow sites may not cost the buyer the book.
  let priceMsUsed = 0;
  const priced = async <R extends { byActivity: ReadonlyMap<string, SeedResearch> }>(found: R): Promise<R> => {
    if (!pricing) return found;
    const asked = Date.now();
    const timeMs = timeFor(researchStartedAt, asked, CHECK_TIMES.priceTotalMs - priceMsUsed, CHECK_TIMES.priceLatestEndMs);
    if (timeMs === 0 && !notes.includes("price_check_stopped:no_time")) notes.push("price_check_stopped:no_time");
    const checked = await addPrices(found.byActivity, { locale, memo: priceMemo, ledger, timeMs });
    priceMsUsed += Date.now() - asked;
    const split = splitByBudget(checked, intake.budget, ownPicks);
    for (const [id, options] of split.dear) if (!tooDearPlaces.has(id)) tooDearPlaces.set(id, options);
    return { ...found, byActivity: split.byActivity };
  };
  const researchFor = async (seedList: readonly Seed[], known?: ReadonlyMap<string, SeedResearch>) => {
    for (const id of researchIds(seedList)) researchedIds.add(id);
    return priced(await researchSeeds({
      ratings,
      activityIds: researchIds(seedList),
      location: intake.location,
      searchDistance: intake.searchDistance,
      searchDistanceKm: intake.searchDistanceKm,
      locale,
      known,
      now,
      priorityIds: [...ownPicks],
      needs: researchNeedsFrom(engine.constraints.verify),
      country: intake.country,
      ledger,
      adultsOnly,
      rejected: rejectedLinks,
    }));
  };
  let research = await researchFor([...engine.seeds, ...reserve]);
  // The rounds after this one are the fallback; this many paid calls were the first round (own choices and the rest side by side).
  const initialResearchCalls = ledger.calls().filter((c) => ["standard", "own", "broad", "online"].includes(c.kind)).length;
  // Every answer of every round, also of selections that were not kept: the last safety net swaps an idea without an option for one of these.
  const everything = new Map<string, SeedResearch>(research.byActivity);
  const everSeen = new Map<string, Seed>([...engine.seeds, ...reserve].map((s) => [s.activityId, s]));
  // The reserve swap: what has no real place is replaced by the reserve idea of its direction that has one. Free: the reserve was researched with the book.
  const reserveSwaps: { out: string; in: string }[] = [];
  if (poolSearch && reserve.length > 0) {
    const placed = (s: Seed, book: readonly Seed[]) => (seedResearch(s, dedupePlaces(book, research.byActivity, ownPicks))?.options.length ?? 0) > 0;
    const filled = fillFromReserve({
      seeds: engine.seeds,
      reserve,
      hasOption: placed,
      ownPicks,
      domainOf: (id) => getActivity(id)?.domain,
      quality: (s) => {
        const options = seedResearch(s, research.byActivity)?.options ?? [];
        // The best rating first; a second place with a link (every place has one, see withLinks) is worth a little more: the book should show two where it can (Jan, 22 Nov 2026).
        return (options[0]?.rating ? adjustedScore(options[0].rating) : 0) + (options.length >= 2 ? SECOND_PLACE_BONUS : 0);
      },
    });
    if (filled.swaps.length > 0) {
      engine = { ...engine, seeds: filled.seeds };
      for (const w of filled.swaps) {
        reserveSwaps.push(w);
        notes.push(`reserve_swapped:${w.out}>${w.in}`);
        if (ownPicks.has(w.out) && !ownPicks.has(w.in)) replacedPicks.set(w.in, getActivity(w.out)?.label[locale] ?? w.out);
      }
    }
  }
  const remember = (seedList: readonly Seed[], byActivity: ReadonlyMap<string, SeedResearch>) => {
    for (const s of seedList) everSeen.set(s.activityId, s);
    for (const [id, r] of byActivity) if (r.options.length > 0 || !everything.has(id)) everything.set(id, r);
  };

  // Every idea needs a concrete, real option (Jan, 31 Oct 2026). An idea with nothing near the person gets one second chance: a
  // provider that serves anyone in the Netherlands from a website (an online course, a webshop with a kit, a national club, an app).
  const requireOptions = concreteOptionsRequired();
  // No idea without a real place (coverageEnabled): replaces the separate replacing of the person's own choices below (2c) by the coverage stage (2c'), which covers every idea.
  const coverage = requireOptions && coverageEnabled();
  const onlineTried = new Set<string>();
  const widerKm = widerRadiusKm(intake.searchDistance, intake.searchDistanceKm);
  const broadTried = new Set<string>();
  const widened = new Set<string>();
  const broadened = new Set<string>();
  // The activities of a list that still have no option at all (a curated combination counts the options of both halves).
  const lackingOf = (seedList: readonly Seed[], base: typeof research) => [...new Set(seedList.filter((s) => (seedResearch(s, base.byActivity)?.options.length ?? 0) === 0).map((s) => s.activityId))];
  // A physical search makes no sense for what is online by nature (a writing course, a language app): that goes to the online providers at once.
  const physicalLacking = (seedList: readonly Seed[], base: typeof research) => lackingOf(seedList, base).filter((id) => !isOnlineByNature(getActivity(id)));
  /**
   * The second search, for the ideas the standard one found nothing for: one broad pass (other kinds of provider: clubs, community centres, libraries, repair cafes ...)
   * over twice the chosen distance, nearest first. One round instead of two (a broad one at the same distance and a wider one): every round reads 35-55k tokens of
   * search results back, and the two together made a book cost four times as much (measured 14 Nov 2026). Where the distance cannot be widened it stays as chosen.
   */
  const withBroad = async (seedList: readonly Seed[], base: typeof research): Promise<typeof research> => {
    if (!requireOptions || overBudget()) return base;
    const lacking = physicalLacking(seedList, base).filter((id) => !broadTried.has(id));
    if (lacking.length === 0 || costBlocks("broad")) return base;
    for (const id of lacking) broadTried.add(id);
    const broad = await priced(await researchSeeds({
      ratings,
      activityIds: lacking,
      location: intake.location,
      searchDistance: intake.searchDistance,
      searchDistanceKm: widerKm ?? intake.searchDistanceKm,
      locale,
      now,
      pass: "broad",
      priorityIds: lacking.filter((id) => ownPicks.has(id)),
      needs: researchNeedsFrom(engine.constraints.verify),
      country: intake.country,
      ledger,
      adultsOnly,
      rejected: rejectedLinks,
    }));
    const merged = new Map(base.byActivity);
    for (const id of lacking) {
      const found = broad.byActivity.get(id);
      if (found && found.options.length > 0) {
        merged.set(id, { activityId: id, options: found.options, source: "search" });
        broadened.add(id);
        if (widerKm !== null) widened.add(id);
      }
    }
    return { byActivity: merged, stats: addStats(base.stats, broad.stats) };
  };
  /** Physical options near the person: the standard search, then one broad search over twice the distance for what still lacks an option. */
  const settle = async (seedList: readonly Seed[], base: typeof research) => withBroad(seedList, base);
  /** The online providers: "nature" for what is online by its own nature, "all" as the very last resort for everything that still has no option. */
  const withOnline = async (seedList: readonly Seed[], base: typeof research, which: "nature" | "all"): Promise<typeof research> => {
    if (!requireOptions) return base;
    const lacking = lackingOf(seedList, base).filter((id) => !onlineTried.has(id) && (which === "all" || isOnlineByNature(getActivity(id))));
    if (lacking.length === 0 || costBlocks("online")) return base;
    for (const id of lacking) onlineTried.add(id);
    const online = await priced(await researchSeeds({
      activityIds: lacking, location: intake.location, searchDistance: intake.searchDistance, locale, now, mode: "online", country: intake.country, ledger, adultsOnly, rejected: rejectedLinks }));
    const merged = new Map(base.byActivity);
    for (const id of lacking) {
      const found = online.byActivity.get(id);
      if (found && found.options.length > 0) merged.set(id, { activityId: id, options: found.options, source: "search" });
    }
    return { byActivity: merged, stats: addStats(base.stats, online.stats) };
  };
  // Physical first (Jan, 13 Nov 2026): the local search asks for workshops, studios, clubs, outings and venues only. An idea with nothing near the
  // person gets a second, broader search (other kinds of provider), then one over twice the distance, then another idea instead (below), and only as
  // the very last resort the online providers: online is not an equal. (Jan, 14 Nov 2026: no idea goes into the book without an option.)
  research = await settle(engine.seeds, research);
  research = await withOnline(engine.seeds, research, "nature");
  remember(engine.seeds, research.byActivity);

  // 2b. An idea that needs somebody's offer (a class, a rental, a club) but for which nothing real could be found near
  // this person is replaced by the next-best activity, once, and only the new ones are researched (the others are
  // passed along). If the replacement does not do better, the first selection stays.
  // Only real offers are shown (Jan: "alleen reële mogelijkheden in de betreffende plek"): a second round replaces what is
  // still without a provider, and in that last round only activities that need nobody's offer are allowed at all.
  // What the person chose themselves is never swapped out (Stap 124): without a provider it stays, described honestly. Only the
  // ideas the engine added on its own are replaced, and the engine keeps every pick it had selected (a replacement that loses one is refused).
  const tried: string[] = [];
  // One place, one idea: a place that an earlier idea already has does not count for a later one.
  const unsupported = (seeds: readonly Seed[], byActivity: ReadonlyMap<string, SeedResearch>) =>
    seedsWithoutSupply(seeds, dedupePlaces(seeds, byActivity, ownPicks), requireOptions).filter((s) => !ownPicks.has(s.activityId));
  // With the pool search the reserve swap above has replaced what it could; the rest goes to the coverage stage, so these whole-selection retries are not run.
  const supplyRounds = poolSearch ? 0 : SUPPLY_ROUNDS;
  for (let round = 1; round <= supplyRounds; round++) {
    const noSupply = unsupported(engine.seeds, research.byActivity);
    if (noSupply.length === 0 || overBudget() || costBlocks("standard")) break;
    tried.push(...noSupply.map((s) => s.activityId));
    const lastRound = round === supplyRounds;
    // The last round only allows activities that need nobody's offer. It must not throw out what already has an offer or was chosen:
    // those stay eligible, so the rest of the selection hardly moves.
    const keep = new Set([...ownPicks, ...engine.seeds.filter((s) => !noSupply.includes(s)).map((s) => s.activityId)]);
    // The last round still only takes activities that need nobody's offer (a walk, a park, a market): a place to go to without a provider.
    const exclude = lastRound ? [...tried, ...ALL_ACTIVITIES.filter((a) => needsProvider(a) && !keep.has(a.id)).map((a) => a.id)] : tried;
    const retry = select(exclude);
    if (retry.seeds.length < IDEA_COUNT) {
      notes.push(...noSupply.map((s) => `no_local_offer:${s.activityId}`));
      break;
    }
    const retryResearch = await withOnline(retry.seeds, await settle(retry.seeds, await researchFor(retry.seeds, research.byActivity)), "nature");
    remember(retry.seeds, retryResearch.byActivity);
    // A replacement may swap one of the person's picks for another one (a pick without a provider for a pick with one), but it may
    // never leave the book with fewer of their picks than it had.
    const picksIn = (seeds: readonly Seed[]) => seeds.filter((s) => ownPicks.has(s.activityId)).length;
    const lostPick = picksIn(retry.seeds) < picksIn(engine.seeds);
    if (!lostPick && unsupported(retry.seeds, retryResearch.byActivity).length < noSupply.length) {
      notes.push(...noSupply.map((s) => `replaced_no_local_offer:${s.activityId}`));
      engine = retry;
      research = { byActivity: retryResearch.byActivity, stats: addStats(research.stats, retryResearch.stats) };
    } else {
      // No better (or it would cost the person one of their own choices): keep what we have and try the last round.
      research = { ...research, stats: addStats(research.stats, retryResearch.stats) };
      if (lostPick) notes.push(`replacement_refused_would_lose_pick`);
      if (lastRound) notes.push(...noSupply.map((s) => `no_local_offer:${s.activityId}`));
    }
  }
  // 2c. A choice of the person's own for which nothing real was found near them, not even by the broader and the wider search, is replaced by a
  // related activity that does have a real option (Jan, 14 Nov 2026: the book is about good, useful options; an idea without one is not worth a place).
  // The replacement comes from the relation graph, with the same hard filters as the selection, and the book says in one sentence that it replaces the choice.
  const lackingPicks = () => seedsWithoutSupply(engine.seeds, dedupePlaces(engine.seeds, research.byActivity, ownPicks), requireOptions).filter((s) => ownPicks.has(s.activityId));
  const toReplace = requireOptions && !coverage && !overBudget() && !(lackingPicks().length > 0 && costBlocks("standard")) ? lackingPicks() : [];
  if (toReplace.length > 0) {
    const used = new Set<string>([...engine.seeds.flatMap((s) => [s.activityId, s.hybrid?.partnerId ?? ""]), ...tried, ...(opts.history ?? [])].filter(Boolean));
    const proposals = new Map<string, Seed[]>();
    for (const s of toReplace) {
      const related = relatedActivities(s.activityId, engine.constraints, [...used], 6)
        .filter((a) => inSeason(a, month))
        .slice(0, 4);
      for (const a of related) used.add(a.id);
      proposals.set(
        s.activityId,
        related.map((a): Seed => {
          const lead = s.lead && a.formats?.includes(s.lead) ? s.lead : null;
          return {
            ...s,
            activityId: a.id,
            direction: "adjacent",
            chain: [s.activityId, a.id],
            via: [],
            hybrid: undefined,
            lead,
            alsoFormats: (a.formats ?? []).filter((f) => f !== lead && f !== "online"),
            verify: s.verify.filter((v) => !v.startsWith("cost_")),
            reasons: [...(s.reasons ?? []), `replaces:${s.activityId}`],
          };
        }),
      );
    }
    const candidates = [...proposals.values()].flat();
    if (candidates.length > 0) {
      const found = await withOnline(candidates, await settle(candidates, await researchFor(candidates, research.byActivity)), "nature");
      remember(candidates, found.byActivity);
      // `found` only holds the candidates: what the book already has stays.
      research = { byActivity: new Map([...research.byActivity, ...found.byActivity]), stats: addStats(research.stats, found.stats) };
      const taken = new Set<string>();
      for (const s of toReplace) {
        const choice = (proposals.get(s.activityId) ?? []).find((c) => !taken.has(c.activityId) && (seedResearch(c, research.byActivity)?.options.length ?? 0) > 0);
        if (!choice) continue;
        taken.add(choice.activityId);
        engine = { ...engine, seeds: engine.seeds.map((x) => (x === s ? choice : x)) };
        replacedPicks.set(choice.activityId, getActivity(s.activityId)?.label[locale] ?? s.activityId);
        notes.push(`replaced_pick:${s.activityId}>${choice.activityId}`);
      }
    }
  }
  // 2c'. Coverage (Jan, 14 Nov 2026: "all options in the book must have real, fitting, concrete places; if not, the option may not be shown, find another one that does,
  // even in a somewhat wider area"). Every idea that still has no real place, a choice of the person's own included, is replaced by a related activity that has one.
  // Up to COVERAGE_ROUNDS rounds: each researches the candidates of all lacking ideas in one grouped call (the standard search, then the broad one over a wider
  // area, then the online providers only for what is online by nature) and takes the first candidate per idea that has a place. These rounds are held to the hard
  // ceiling (WINDOW_BOOK_HARD_CAP), not the soft cap, and to the research time budget. Candidates that earlier research found nothing for near this place are left
  // out, and the ones it found something for come first (their answers are often in the cache already, which costs nothing).
  const coverageTried = new Set<string>();
  const lackingNow = () => seedsWithoutSupply(engine.seeds, dedupePlaces(engine.seeds, research.byActivity, ownPicks), true);
  if (coverage && lackingNow().length > 0) coverageStage = true;
  for (let round = 1; coverageStage && round <= COVERAGE_ROUNDS; round++) {
    const lacking = lackingNow();
    if (lacking.length === 0 || overBudget() || !ledger.canAffordCoverage("standard")) break;
    const taken = new Set<string>([...engine.seeds.flatMap((s) => [s.activityId, s.hybrid?.partnerId ?? ""]), ...tried, ...coverageTried, ...(opts.history ?? [])].filter(Boolean));
    const quiet = new Set(quietSupply);
    const proposals = new Map<Seed, Seed[]>();
    for (const s of lacking) {
      let related = relatedActivities(s.activityId, engine.constraints, [...taken], 10)
        .filter((a) => inSeason(a, month) && !quiet.has(a.id))
        .sort((a, b) => Number(foundSupply.has(b.id)) - Number(foundSupply.has(a.id)))
        .slice(0, COVERAGE_CANDIDATES_PER_SEED);
      // The last candidates: what almost every town has (everywhere.ts). From the second round three of the five places are for these, and in any round when
      // nothing related is left: a small town, or a person whose own choices have no venue, would otherwise end with fewer than five ideas.
      const everywhereRoom = round >= 2 ? EVERYWHERE_PER_SEED : related.length === 0 ? COVERAGE_CANDIDATES_PER_SEED : 0;
      if (everywhereRoom > 0) {
        const extra = everywhereCandidates({ constraints: engine.constraints, month, exclude: new Set([...taken, ...related.map((a) => a.id)]), quiet, max: everywhereRoom });
        related = [...related.slice(0, COVERAGE_CANDIDATES_PER_SEED - extra.length), ...extra];
      }
      for (const a of related) taken.add(a.id);
      proposals.set(
        s,
        related.map((a): Seed => {
          const lead = s.lead && a.formats?.includes(s.lead) ? s.lead : null;
          return {
            ...s,
            activityId: a.id,
            // A wildcard stays a wildcard (the writer treats the last idea as the wildcard); anything else is a neighbour of what it replaces.
            direction: s.direction === "wildcard" ? "wildcard" : "adjacent",
            chain: [s.activityId, a.id],
            via: [],
            hybrid: undefined,
            lead,
            alsoFormats: (a.formats ?? []).filter((f) => f !== lead && f !== "online"),
            verify: s.verify.filter((v) => !v.startsWith("cost_")),
            reasons: [...(s.reasons ?? []), `replaces:${s.activityId}`],
          };
        }),
      );
    }
    const candidates = [...proposals.values()].flat();
    if (candidates.length === 0) break;
    for (const c of candidates) coverageTried.add(c.activityId);
    const found = await withOnline(candidates, await settle(candidates, await researchFor(candidates, research.byActivity)), "nature");
    remember(candidates, found.byActivity);
    research = { byActivity: new Map([...research.byActivity, ...found.byActivity]), stats: addStats(research.stats, found.stats) };
    const taking = new Set<string>();
    // One place, one idea (dedupePlaces): a candidate whose only places are already the places of other ideas of the book would lose them again and leave the idea
    // without one (Wernigerode, 16 Nov 2026: a replacement with a place that the "old map walk" already had), so it is chosen only when it has a place of its own.
    const placeKey = (o: LocalOption) => `${o.name}|${o.city}`.toLowerCase();
    const usedPlaces = new Set<string>();
    {
      const deduped = dedupePlaces(engine.seeds, research.byActivity, ownPicks);
      for (const x of engine.seeds) if (!lacking.includes(x)) for (const o of seedResearch(x, deduped)?.options ?? []) usedPlaces.add(placeKey(o));
    }
    for (const s of lacking) {
      const choice = (proposals.get(s) ?? []).find((c) => !taking.has(c.activityId) && (seedResearch(c, research.byActivity)?.options ?? []).some((o) => !usedPlaces.has(placeKey(o))));
      if (!choice) continue;
      taking.add(choice.activityId);
      for (const o of seedResearch(choice, research.byActivity)?.options ?? []) usedPlaces.add(placeKey(o));
      engine = { ...engine, seeds: engine.seeds.map((x) => (x === s ? { ...choice, level: s.level } : x)) };
      if (ownPicks.has(s.activityId)) replacedPicks.set(choice.activityId, getActivity(s.activityId)?.label[locale] ?? s.activityId);
      notes.push(`coverage_replaced:${s.activityId}>${choice.activityId}`);
    }
  }
  // 2d. The very last resort for what still has no option: the online providers (a physical option, another idea, and only then this).
  research = await withOnline(engine.seeds, research, "all");
  remember(engine.seeds, research.byActivity);
  // 2e. Never an idea without an option: what still has none is swapped for an idea that an earlier round researched and that does have one.
  research = { ...research, byActivity: dedupePlaces(engine.seeds, research.byActivity, ownPicks) };
  if (requireOptions) {
    for (const s of seedsWithoutSupply(engine.seeds, research.byActivity, true)) {
      const inBook = new Set(engine.seeds.flatMap((x) => [x.activityId, x.hybrid?.partnerId ?? ""]));
      // A combination whose partner is already an idea of the book would be the same idea twice (Stap 199).
      const fits = (c: Seed) => !inBook.has(c.activityId) && !inBook.has(c.hybrid?.partnerId ?? "") && (seedResearch(c, everything)?.options.length ?? 0) > 0 && (c.direction === "wildcard") === (s.direction === "wildcard");
      const pool = [...everSeen.values()].filter(fits);
      const swap = pool.find((c) => c.direction === s.direction) ?? pool[0];
      if (!swap) continue;
      const merged = new Map(research.byActivity);
      for (const id of [swap.activityId, swap.hybrid?.partnerId ?? ""]) if (id && everything.has(id)) merged.set(id, everything.get(id)!);
      research = { ...research, byActivity: dedupePlaces(engine.seeds.map((x) => (x === s ? swap : x)), merged, ownPicks) };
      engine = { ...engine, seeds: engine.seeds.map((x) => (x === s ? { ...swap, level: s.level } : x)) };
      if (ownPicks.has(s.activityId)) replacedPicks.set(swap.activityId, getActivity(s.activityId)?.label[locale] ?? s.activityId);
      notes.push(`swapped_no_option:${s.activityId}>${swap.activityId}`);
    }
  }
  // 2f. An idea whose only places were far above the budget and that nothing could replace keeps its cheapest one, with the real price: the
  // page then says it is above the budget. Better that than a shorter book, or a text that says nothing was found.
  for (const s of seedsWithoutSupply(engine.seeds, research.byActivity, true)) {
    const dear = tooDearPlaces.get(s.activityId);
    if (!dear?.length) continue;
    research = { ...research, byActivity: new Map([...research.byActivity, [s.activityId, { activityId: s.activityId, options: dear.slice(0, 1), source: "search" as const }]]) };
    notes.push(`kept_above_budget:${s.activityId}`);
  }
  for (const [id, options] of tooDearPlaces) notes.push(`over_budget_place:${id} (${options.map((o) => o.price?.text).join(", ")})`);
  // 2g. What still has no real place after all of that is not shown (Jan, 14 Nov 2026): the idea is left out of the book, as long as at least MIN_SEEDS remain.
  // The wildcard stays (the writer treats the last idea as the wildcard) and so do the ideas that have a place; the ones of the engine's own go before the person's
  // own choices. What cannot be left out is reported (coverage_incomplete) and written honestly, as before.
  if (coverage) {
    const lackingFinal = seedsWithoutSupply(engine.seeds, research.byActivity, true).filter((s) => s.direction !== "wildcard");
    const droppable = [...lackingFinal.filter((s) => !ownPicks.has(s.activityId)), ...lackingFinal.filter((s) => ownPicks.has(s.activityId))].slice(0, Math.max(0, engine.seeds.length - MIN_SEEDS));
    if (droppable.length > 0) {
      for (const s of droppable) notes.push(`dropped_no_option:${s.activityId}`);
      engine = { ...engine, seeds: engine.seeds.filter((x) => !droppable.includes(x)) };
    }
    if (seedsWithoutSupply(engine.seeds, research.byActivity, true).length > 0) notes.push("coverage_incomplete");
  }
  // The same idea twice (a combination next to its own pick) is never built by the selection; if something ever does, it is said here.
  for (const [x, y] of overlappingSeeds(engine.seeds)) notes.push(`overlapping_ideas:${x}+${y}`);
  for (const id of broadened) notes.push(`broadened_search:${id}`);
  for (const id of widened) notes.push(`widened_radius:${id}`);
  // The picks that stay without a provider: said plainly in the book (see seedBlock), noted here for the log and the harness.
  for (const s of seedsWithoutSupply(engine.seeds, research.byActivity)) if (ownPicks.has(s.activityId)) notes.push(`pick_without_provider:${s.activityId}`);
  // What still has no option at all, after the local and the online pass: said, never hidden.
  for (const s of engine.seeds) if ((seedResearch(s, research.byActivity)?.options.length ?? 0) === 0) notes.push(`no_option:${s.activityId}`);
  const seeds = engine.seeds;
  // Only what was really found: distinct places over all the ideas (name + city).
  const foundPlaces = new Set<string>();
  for (const s of seeds) for (const o of seedResearch(s, research.byActivity)?.options ?? []) foundPlaces.add(`${o.name}|${o.city}`.toLowerCase());
  await opts.onProgress?.("researched", { places: foundPlaces.size });
  // What the book cost, in the shape that is kept with it. `quiet` says how many activities this place has a history of silence for, and how many of them
  // still ended up in the book: the measurable effect of the supply index.
  const costOf = () => {
    const quiet = new Set(quietSupply);
    return bookCostMeta(ledger, {
      placesLookups: ratings.stats().lookups,
      placesListPriceUsd: PLACES_LIST_PRICE_USD,
      research: research.stats,
      quiet: { known: quiet.size, inBook: seeds.filter((s) => quiet.has(s.activityId)).length },
      search: (() => {
        const optionsPerIdea = seeds.map((s) => seedResearch(s, research.byActivity)?.options.length ?? 0);
        const researchCalls = ledger.calls().filter((c) => ["standard", "own", "broad", "online"].includes(c.kind)).length;
        return {
          engine: poolSearch ? ("v2" as const) : ("v1" as const),
          candidates: researchedIds.size,
          candidatesWithOption: [...researchedIds].filter((id) => (everything.get(id)?.options.length ?? 0) > 0 || (research.byActivity.get(id)?.options.length ?? 0) > 0).length,
          reserve: { researched: new Set(reserve.map((s) => s.activityId)).size, used: reserveSwaps.length },
          fallbackRounds: Math.max(0, researchCalls - initialResearchCalls),
          sitesChecked: research.stats.checked ?? 0,
          optionsPerIdea,
          presentedOptions: optionsPerIdea.reduce((a, b) => a + b, 0),
        };
      })(),
      ...(coverage
        ? { coverage: { replaced: notes.filter((n) => n.startsWith("coverage_replaced:")).length, dropped: notes.filter((n) => n.startsWith("dropped_no_option:")).length, incomplete: notes.includes("coverage_incomplete") } }
        : {}),
    });
  };
  if (opts.researchOnly) {
    // Nothing is written. The caller asked for the research only; `book` is never read in that case.
    for (const kind of ledger.skipped()) notes.push(`cost_cap_skipped:${kind}`);
    return { book: null as unknown as GeneratedIdeaBook, report: { seeds, notes, research: { ...research.stats }, issues: [], cost: costOf(), placesPerIdea: seeds.map((s) => ({ activityId: s.activityId, options: (seedResearch(s, research.byActivity)?.options ?? []).map((o) => ({ name: o.name, city: o.city, url: o.url, rating: o.rating?.score ?? null })) })) } };
  }

  // 3. Write the ideas (one retry on a malformed answer, without repeating the research).
  const language = languageLabel(locale);
  // B5 (KNOWLEDGE_ENGINE_V2, off by default): activity-specific fill lines (V1) and honest origin wording (V2).
  const chosenImages = intake.associations ?? [];
  // Two-page intake: the person chose the activities themselves (page 2), so they may be called picked; the images only explain taste.
  const explicitPicks = intake.intakeFlow === "images2";
  const honestOrigin = v2 && chosenImages.length > 0 && !explicitPicks;
  const baseSystem = v2 ? SYSTEM_PROMPT.replace("For every idea:\n", () => `${ROUTE_CONSISTENCY_RULE}${honestOrigin ? HONEST_ORIGIN_RULE : ""}For every idea:\n`) : SYSTEM_PROMPT;
  const baseLayers = v2 ? LAYERS_SYSTEM_PROMPT.replace("\nHonesty. These matter", () => `${FILL_PROMPT_RULES}\nHonesty. These matter`) : LAYERS_SYSTEM_PROMPT;
  const system = baseSystem.replaceAll("{{LANGUAGE}}", language).replaceAll("{{FREE}}", freeWord(locale)).replaceAll("{{ASK}}", askPrice(locale));
  const layersSystem = baseLayers.replaceAll("{{LANGUAGE}}", language).replaceAll("{{FREE}}", freeWord(locale)).replaceAll("{{ASK}}", askPrice(locale));
  const shared = `Today is ${describeToday(now, locale)} (${isoDateNL(now)}).
Hard constraints: the person lives in ${countryName(intake.country || HOME_COUNTRY, "en")}. The book is written in ${language}.${adultsOnly ? " The ideas are for adults." : ""}

${formatProfile(intake, characterProfile)}

${practicalNeedsPrompt(researchNeedsFrom(engine.constraints.verify))}The ideas (in this order; Idea ${seeds.length} is the wildcard):

${seeds.map((s, i) => seedBlock(s, i, seedResearch(s, research.byActivity), locale, chosenImages, honestOrigin, explicitPicks, ownPicks.has(s.activityId), replacedPicks.get(s.activityId))).join("\n\n")}`;
  const user = `${shared}

Call the create_idea_book tool exactly once: ${seeds.length - 1} entries in "ideas" (Ideas 1-${seeds.length - 1}, same order) plus the wildcard entry for Idea ${seeds.length}.`;
  const layersUser = `${shared}

Call the create_layers tool exactly once: ${seeds.length} entries in "ideas", for Ideas 1-${seeds.length} in the order given (Idea ${seeds.length} is the wildcard).`;

  // The layers are written at the same time as the ideas themselves, so they add no waiting time.
  const layersPromise = writeLayers(layersSystem, layersUser, seeds.length, v2, ledger);

  let raw: RawBook | null = null;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2 && !raw; attempt++) {
    try {
      const startedAt = Date.now();
      const message = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 9000,
        system,
        messages: [{ role: "user", content: user }],
        tools: [
          {
            name: "create_idea_book",
            description: "Return the finished Idea Book.",
            input_schema: {
              type: "object",
              properties: {
                profile_summary: { type: "string" },
                must_haves: { type: "array", items: { type: "string" } },
                preferences: { type: "array", items: { type: "string" } },
                ideas: { type: "array", minItems: seeds.length - 1, maxItems: seeds.length - 1, items: ENTRY_SCHEMA },
                wildcard: ENTRY_SCHEMA,
              },
              required: ["profile_summary", "must_haves", "preferences", "ideas", "wildcard"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "create_idea_book" },
      });
      ledger.add("writing", message.usage, CLAUDE_MODEL);
      console.log(`WINDOW: main generation call took ${Date.now() - startedAt}ms, usage=${JSON.stringify(message.usage)}`);
      const candidate = extractToolInput<RawBook>(message, "create_idea_book");
      const split = splitCoreAnswer(candidate, seeds.length);
      if (!split) {
        const n = Array.isArray(candidate.ideas) ? candidate.ideas.length : "no list";
        // Say what the field actually was: this has cost whole retries before and the shape is the only clue to why.
        if (!Array.isArray(candidate.ideas)) {
          const shape = candidate.ideas === undefined ? "missing" : typeof candidate.ideas === "string" ? `string "${candidate.ideas.slice(0, 160)}"` : `${typeof candidate.ideas} with keys ${Object.keys(candidate.ideas as object).slice(0, 8).join(",")}`;
          console.warn(`WINDOW: ideas field was not a list: ${shape}`);
        }
        throw new Error(`Claude did not return the expected number of ideas (ideas: ${n}, wildcard: ${candidate.wildcard ? "yes" : "no"}). Please try again.`);
      }
      if ((candidate.ideas as unknown[]).length !== seeds.length - 1 || !candidate.wildcard) {
        console.warn(`WINDOW: the ideas call listed ${(candidate.ideas as unknown[]).length} ideas and ${candidate.wildcard ? "a" : "no"} wildcard; split it as asked instead of paying for a second call`);
      }
      raw = { ...candidate, ideas: split.ideas, wildcard: split.wildcard };
    } catch (err) {
      lastError = err;
      // A failed attempt costs a full writing call again: say why, so it can be seen in the logs.
      console.warn(`WINDOW: writing attempt ${attempt} failed: ${err instanceof Error ? err.message : String(err)}`);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  if (!raw) throw lastError ?? new Error("Idea generation failed.");
  const layers = await layersPromise;

  // 4. Assemble and check.
  const allHosts = new Set<string>();
  for (const r of research.byActivity.values()) for (const o of r.options) if (o.url) allHosts.add(hostOf(o.url));
  const issues: string[] = [];
  const regular = seeds.filter((s) => s.direction !== "wildcard");
  const wild = seeds.find((s) => s.direction === "wildcard") ?? seeds[seeds.length - 1];
  // "Also in this direction": by code, from the relation graph, with the same hard filters as the
  // selection. The doors of the book are never listed, and one activity is shown at most once.
  const taken = new Set(seeds.map((s) => s.activityId));
  // R1: every idea heads an option of three, the idea and two companions chosen by the engine for the idea's direction (a chosen theme, or the
  // idea's own neighbourhood when it fits none). A companion that the book uses in the meantime (a replacement idea) is skipped and the option
  // is filled up from the relation graph, so an option stays three. Each companion carries one short facts line made from the library.
  const optionCopy = getDictionary(locale).venster.more.option;
  const optionFor = (seed: Seed): { related: RelatedActivity[]; direction?: string } => {
    // The option was built for the idea the engine chose; a replacement idea (copied from it) has its companions looked up again.
    const own = seed.option && seed.option.for === seed.activityId ? seed : { ...seed, option: undefined };
    const suits = (id: string) => {
      const x = getActivity(id);
      return !!x && passesConstraints(x, engine.constraints).ok;
    };
    const companions = companionsOf(own, locale, optionCopy).filter((c) => !taken.has(c.id) && suits(c.id)).slice(0, 2);
    for (const c of companions) taken.add(c.id);
    const wanted = own.option ? 2 : 3;
    if (companions.length < wanted) {
      for (const a of relatedActivities(seed.activityId, engine.constraints, taken, wanted - companions.length)) {
        taken.add(a.id);
        companions.push(companionLine(a.id, locale, optionCopy) ?? { id: a.id, label: a.label[locale] });
      }
    }
    const direction = directionLabel(own.option?.themes ?? [], locale, optionCopy);
    return { related: companions, ...(direction ? { direction } : {}) };
  };
  // A layer the model wrote but that did not pass validation is left out; say so, so it shows in the log.
  const layerFor = (seed: Seed): RawLayer | undefined => layers?.[seeds.indexOf(seed)];
  const layerIssues = (label: string, seed: Seed) => {
    if (!layers) return;
    const sizes = checkSizes(layerFor(seed)?.sizes);
    if (sizes.problem) issues.push(`${label}:sizes_dropped (${sizes.problem})`);
  };
  // V1: the fill lines are kept only when complete and when none of them contradicts what is known about the idea
  // (done alone, online only, indoors). Otherwise the PDF falls back to its templates, which are filtered the same way.
  const keptFills: IdeaFill[] = [];
  const fillFor = (label: string, seed: Seed): IdeaFill | undefined => {
    if (!v2 || !layers) return undefined;
    const layer = layerFor(seed);
    const { fill, problem } = checkFill({ timeline: layer?.timeline, takeaways: layer?.takeaways, suggestions: layer?.suggestions });
    if (!fill) {
      issues.push(`${label}:fill_dropped (${problem})`);
      return undefined;
    }
    const activity = getActivity(seed.activityId);
    const conflicts = activity ? fillConflicts(fill, fillContext(activity, seed.lead, intake.company)) : [];
    if (conflicts.length > 0) {
      issues.push(`${label}:fill_conflict (${conflicts.join(", ")})`);
      return undefined;
    }
    keptFills.push(fill);
    return fill;
  };
  const ideas = (raw.ideas as unknown[]).map((r, i) => {
    const seed = regular[i];
    layerIssues(`idea${i + 1}`, seed);
    const checked = checkEntry(buildEntry(r, seed, seedResearch(seed, research.byActivity), optionFor(seed), layerFor(seed), fillFor(`idea${i + 1}`, seed)), seedResearch(seed, research.byActivity)?.options ?? [], allHosts);
    issues.push(...checked.issues.map((x) => `idea${i + 1}:${x}`));
    return checked.entry;
  });
  layerIssues("wildcard", wild);
  const wildChecked = checkEntry(
    buildEntry(raw.wildcard, wild, seedResearch(wild, research.byActivity), optionFor(wild), layerFor(wild), fillFor("wildcard", wild)),
    seedResearch(wild, research.byActivity)?.options ?? [],
    allHosts,
  );
  issues.push(...wildChecked.issues.map((x) => `wildcard:${x}`));
  // Monitoring only (the prompt asks for variety): one opening word on more than three suggestions reads as a template.
  for (const r of repeatedOpenings(keptFills)) issues.push(`fill_repetitive (${r.word} x${r.count})`);
  if (ideas.some((i) => !i.title || !i.why_it_fits || i.details.length === 0) || !wildChecked.entry.title) {
    throw new Error("Claude returned incomplete ideas. Please try again.");
  }

  const list = (v: unknown) => (Array.isArray(v) ? v.map(toText).filter(Boolean) : []);
  const assembled: GeneratedIdeaBook = {
    profile_summary: toText(raw.profile_summary),
    must_haves: list(raw.must_haves),
    preferences: list(raw.preferences),
    ideas,
    wildcard: wildChecked.entry,
    // Empty on purpose: the plan page, the PDF and the e-mail all fall back to the
    // dictionary wording, which is exactly what these labels used to duplicate.
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

  // 5. The quality gate (Fase 3): takes the machinery out of the text, fixes chips that contradict the activity, rewrites only the
  // ideas that repeat a sentence or name something out of season (at most twice each) and runs one grammar pass. Fails soft.
  const gate = await runQualityGate(assembled, { locale, month, budget: intake.budget, timeAvailable: intake.timeAvailable }, { ledger });
  issues.push(...gate.log.map((l) => `qa:${l}`), ...gate.remaining.map((r) => `qa_remaining:${r.code}@${r.where}`));
  // Step 250: what an idea claims about its provider is held against the provider's own site; what the site does not carry is taken out
  // (factCheck.ts). After the gate, so a rewrite of the gate is checked too. Fails soft.
  let book = gate.book;
  const factMs = timeFor(researchStartedAt, Date.now(), CHECK_TIMES.factTotalMs, CHECK_TIMES.factLatestEndMs);
  if (factCheckEnabled() && factMs === 0) notes.push("fact_check_skipped:no_time");
  if (factCheckEnabled() && factMs > 0) {
    const facts = await factCheck(book, { locale, ledger, timeMs: factMs });
    book = facts.book;
    issues.push(...facts.report.removed.map((r) => `fact_removed:${r}`));
    notes.push(...facts.report.notOffered.map((x) => `fact_not_offered:${x}`), ...facts.report.unjudged.map((x) => `fact_unjudged:${x}`));
    if (facts.report.checked > 0) notes.push(`fact_checked:${facts.report.checked}${facts.report.fallbacks ? `,fallbacks:${facts.report.fallbacks}` : ""}`);
  }
  // C1: the six criteria on the finished book. What can be repaired was repaired above; what is left is recorded here, per criterion, so it shows in the log
  // and can be read per book. The structural ones were already enforced where the book was assembled (the replacement rounds, the companions' own check).
  const criteria = bookCriteria(book, { constraints: engine.constraints, budget: intake.budget, ownPicks, knownHosts: allHosts });
  notes.push(criteriaSummary(criteria));
  for (const fail of criteria.failures) issues.push(`criteria:${fail.criterion}@${fail.where}:${fail.activityId}`);

  const optionsOf = (s: Seed) => seedResearch(s, research.byActivity)?.options ?? [];
  const optionsCoverage = { ideas: seeds.length, withOption: seeds.filter((s) => optionsOf(s).length > 0).length, withRating: seeds.filter((s) => optionsOf(s).some((o) => o.rating)).length };
  const placesLine = ratings.summary();
  if (placesLine) console.log(placesLine);
  console.log(`WINDOW: options per idea: ${optionsCoverage.withOption}/${optionsCoverage.ideas} with a concrete option, ${optionsCoverage.withRating} with a rating`);
  for (const kind of ledger.skipped()) notes.push(`cost_cap_skipped:${kind}`);
  const cost = costOf();
  // One line for the logs (the cost meters read the lines with "took ... usage", not this one): the book against its cap, and what was left out for it.
  console.log(`WindowInto: book cost so far ${cost.usd.toFixed(3)} of a cap of ${cost.capUsd === null ? "none" : "$" + cost.capUsd.toFixed(2)} (${JSON.stringify(cost.breakdown)})${cost.skipped.length ? `, rounds skipped for cost: ${cost.skipped.join(", ")}` : ""}`);
  const report: SeedPipelineReport = { seeds, notes, research: research.stats, options: optionsCoverage, issues, qa: { found: gate.foundBefore, remaining: gate.remaining }, criteria, cost };
  console.log(
    `WindowInto: seed pipeline: ${seeds.map((s) => `${s.direction}:${s.activityId}`).join(", ")} | issues: ${issues.length ? issues.join("; ") : "none"}`,
  );
  return { book, report };
}
