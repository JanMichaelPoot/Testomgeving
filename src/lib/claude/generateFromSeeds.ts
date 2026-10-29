import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { WINDOW_VOICE_SYSTEM_PROMPT, extractToolInput } from "@/lib/claude/shared";
import { freeWord, languageLabel, type Locale } from "@/lib/locale";
import type { IntakeAnswers } from "@/app/intake/actions";
import type { CharacterProfile } from "@/lib/characterProfile";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { checkFill, fillConflicts, fillContext, repeatedOpenings, type IdeaFill } from "@/lib/claude/ideaFill";
import { knowledgeRankingV2Enabled, knowledgeWritingV2Enabled } from "@/lib/knowledgeFlags";
import {
  LOCATION_SCHEMA,
  PRACTICAL_SCHEMA,
  formatProfile,
  normalizeLocation,
  normalizePractical,
  toText,
  toTextArray,
} from "@/lib/claude/generateIdeaBook";
import { researchSeeds, type LocalOption, type ResearchStats, type SeedResearch } from "@/lib/claude/localResearch";
import { currentMonth, describeToday, isoDateNL } from "@/lib/discovery/season";
import { engineInputFromIntake, relatedActivities, runEngine } from "@/lib/discovery/engine";
import { WEIGHTS_V2 } from "@/lib/discovery/engine/weights";
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
import { scoresForSeed } from "@/lib/discovery/engine/scores";
import { ALL_ACTIVITIES, TAGS, getActivity } from "@/lib/discovery/library";
import type { Activity } from "@/lib/discovery/types";
import { getAssociation, imagesBehind } from "@/lib/discovery/associations";

// The Idea Book pipeline for people who used the card wizard (phase 4 of the discovery
// upgrade). Four steps, only two of which cost money:
//   1. the selection engine picks seven seeds            (code, free)
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

The person has just paid for their WINDOW Idea Book: seven ideas (six regular ideas plus one wildcard),
printed as a PDF with one page per idea. The ideas have ALREADY BEEN CHOSEN for this person by a selection
step. You receive the seven activities below, each with the door it belongs to, why it was chosen, how the
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
- title (max ~6 words), intro (one sentence, max ~18 words).
- why_it_fits: one sentence (max ~18 words), a direct, personal callback that proves you listened. Follow the
  "Why it was chosen" line of that idea: for something they picked themselves, refer to that pick; for an
  adjacent, unexpected, stretch or wildcard idea, make the connection visible in plain words ("You picked X,
  and this shares the Y with it"). Never invent a connection that is not given.
- details: exactly 2 concrete, sequential steps that read like a ready-made how-to (max ~20 words each): what to
  open, search or click. Name the website/app from the verified local options when there is one. Otherwise name
  a certainly-real platform or search (Google Maps, Meetup, a plain Google search with an exact query). Never
  "consider" or "look online".
- first_action: one instruction the person can complete within 60 seconds of finishing reading, naming an exact
  site/app/search term/button (max ~20 words).
- practical: estimated_cost (short, e.g. "€25–40" or "{{FREE}}"), duration (short), difficulty ("easy",
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
  verified local options. Keep costs approximate and do not mention opening hours.
- Write final text only. Never include a self-correction, hesitation or alternative in a step or action (no "nee,",
  "eigenlijk", "or rather", "..." followed by a better version). Check every website address against that
  idea's verified local options BEFORE you write it, and write it once, correctly.
- Season and date: you are given today's date. Every idea must be realistic on that date and in the weeks after
  it, in the Dutch weather of that season. Never write about what is out of season (open-water swimming or a
  terrace evening in winter, a snow scene in autumn), and never promise a market, festival or event unless it is
  one of that idea's verified local options; use a date only when an option states it. If an option ends soon
  (it has an end date), say so in the steps.

Also write profile_summary (one warm, specific sentence reflecting their situation back), must_haves and
preferences (short cleaned-up phrases echoing what they told you; do not invent new ones).

Write absolutely everything in {{LANGUAGE}}, not English, unless {{LANGUAGE}} is English.`;

// R2.3 "more body per door": the extra layers are written by a SECOND call that runs at the same time
// as the one above, so the book takes about as long as the longer of the two instead of the sum
// (one call with everything took 65 s to write and went over the time limit when it had to retry).
// The layers are optional: if this call fails the book is delivered without them.
const LAYERS_SYSTEM_PROMPT = `${WINDOW_VOICE_SYSTEM_PROMPT}

The person has just paid for their WINDOW Idea Book. Seven ideas (six regular ideas plus one wildcard) have
ALREADY BEEN CHOSEN for them and are being written by someone else. You write ONLY the extra layers of each
idea, in the order given. You receive the profile and the seven activities, each with the door it belongs to,
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
  words), estimated_cost and duration (both short, max ~25 characters).
- next_step: one sentence (max ~18 words): what to do after the first time (a second go, the next level,
  joining something).

Honesty. These matter more than anything above:
- Name a business, club, venue or website ONLY when it appears in THAT idea's verified local options. Otherwise
  stay generic (for example "a local club" or "a workshop nearby", written in {{LANGUAGE}}). Never name an organisation from memory,
  however well known it is.
- Write "{{FREE}}" ONLY when that idea's verified local options or its "Easy way in" line say it is free, or when
  nothing at all has to be bought or booked (sitting still at home, a walk from your own door). Anything that
  depends on somebody else's offer (an open day, a trial class, a rental) gets a rough starting price ("from
  about €10", in {{LANGUAGE}}) and the description says the price varies.
- Keep every cost approximate. Never invent a price list, opening hours or an address.
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
  cash or a bank card; for an indoor activity, never mention rain or sun gear. Vary the openings across all seven
  ideas: no verb may start more than two of the 21 suggestions in the whole book, and a note-taking tip at most
  twice in total. Every suggestion is written entirely in {{LANGUAGE}}, its first word included. Check the 21
  openings before you answer and change any verb that comes up more than twice.
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
export function why(seed: Seed, locale: Locale, fromImages = false, honest = false): string {
  const label = (id: string) => getActivity(id)?.label[locale] ?? id;
  const via = seed.via.map((t) => TAG_LABEL.get(t)?.[locale] ?? t).join(", ");
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
            `    - ${o.name}${o.city ? ` (${o.city})` : ""}: ${o.note}${o.until ? ` (until ${o.until})` : ""}` +
            `${o.rating ? ` [rated ${o.rating.score}/5${o.rating.reviews !== null ? `, ${o.rating.reviews} reviews` : ""}, ${o.rating.source}]` : ""}${o.url ? ` — ${o.url}` : ""}`,
        )
        .join("\n")
    : needsProvider(a)
      ? "    NONE FOUND near this person: do not name, claim or imply that any venue, club, hall or provider exists there. Keep the location null and write the idea as something to find out first (ask whether anyone near them offers it), never as a place to go."
      : "    none verified: keep this idea's location null and its steps generic (Google Maps, Meetup, an exact search)";
  return [
    `Idea ${index + 1} — ${seed.direction === "wildcard" ? "WILDCARD (the separate wildcard slot)" : `door: ${seed.door}`}`,
    `  Activity: ${name}`,
    `  Why it was chosen: ${why(seed, locale, chosenImages.length > 0, honest)}`,
    behind ? `  Image behind it: "${behind}" (the chosen image this idea connects to; name it in why_it_fits)` : null,
    `  How to take part: ${take}`,
    `  Easy way in: ${a.entry ? a.entry[locale] : "not known; suggest a beginner-friendly first step"}`,
    a.safety.tier === 2 && a.safety.note
      ? `  Supervision: only with qualified supervision. ${a.safety.note[locale]}`
      : null,
    seed.verify.includes("cost_unknown")
      ? "  Cost: not known; keep the estimate approximate and say it varies."
      : seed.verify.includes("cost_near_budget")
        ? "  Cost: typically close to or a little above their budget; quote the cheapest way in (a trial class or a single session) and say the price varies."
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
async function writeLayers(system: string, user: string, count: number, v2 = false): Promise<RawLayer[] | null> {
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
 * The ideas call is asked for six ideas plus a separate wildcard. In both test books made for a gift, the first
 * answer was thrown away for having "the wrong number of ideas" and the whole call was paid for again (twice
 * the cost, and 35 s more). The two near misses that cannot be misread are accepted instead:
 *  - seven entries under "ideas" and no wildcard: the last one is the wildcard (it is the last idea we asked for),
 *  - seven entries under "ideas" and a wildcard: the wildcard that was given is used.
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
  related: RelatedActivity[],
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
  return {
    ...(feels_like ? { feels_like } : {}),
    ...(sizes ? { sizes } : {}),
    ...(next_step ? { next_step } : {}),
    // Straight from the research (never written by the model), so each one is a verified place.
    ...(places.length ? { places } : {}),
    ...(related.length ? { related } : {}),
    ...(fill ? { fill } : {}),
    title: toText(e.title),
    intro: toText(e.intro),
    why_it_fits: toText(e.why_it_fits),
    details: toTextArray(e.details),
    first_action: toText(e.first_action),
    practical: normalizePractical(e.practical),
    location: normalizeLocation(e.location),
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
  };
}

/**
 * Seeds that only make sense with someone else's offer (a class, a rental, a club: they cost money or need
 * supervision) and for which a research pass, which really ran, found no verifiable option. A failed research
 * pass is not counted: an outage is not proof that nothing exists.
 */
export function seedsWithoutSupply(seeds: readonly Seed[], byActivity: ReadonlyMap<string, SeedResearch>): Seed[] {
  return seeds.filter((seed) => {
    const a = getActivity(seed.activityId);
    const r = byActivity.get(seed.activityId);
    if (!a || !r || r.source === "none") return false;
    return needsProvider(a) && r.options.length === 0;
  });
}

/**
 * Anything that costs money, needs supervision or is not available everywhere needs a provider in reach (Stap 88:
 * "rare" and "regional" activities such as cave diving or glass blowing are only offered when the research found one).
 */
export function needsProvider(a: Activity): boolean {
  return (a.cost !== null && a.cost >= 1) || a.safety.tier === 2 || a.supply === "rare" || a.supply === "regional";
}

/** Rounds of replacing ideas whose provider could not be found. The last round only allows activities that need none. */
export const SUPPLY_ROUNDS = 2;

const addStats = (a: ResearchStats, b: ResearchStats): ResearchStats => ({
  cached: a.cached + b.cached,
  searched: a.searched + b.searched,
  failed: a.failed + b.failed,
  dropped: a.dropped + b.dropped,
  ms: a.ms + b.ms,
});

export interface SeedPipelineReport {
  seeds: Seed[];
  notes: string[];
  research: { cached: number; searched: number; failed: number; dropped?: number };
  issues: string[];
}

export async function generateIdeaBookFromSeeds(
  intake: IntakeAnswers,
  locale: Locale,
  characterProfile: CharacterProfile,
  opts: {
    sessionId?: string;
    history?: readonly string[];
    /** Called as the pipeline passes its steps, for the honest waiting screen. Never awaited for long. */
    onProgress?: (stage: "selected" | "researched", meta?: { ideas?: number; places?: number }) => Promise<void> | void;
  } = {},
): Promise<{ book: GeneratedIdeaBook; report: SeedPipelineReport }> {
  // KNOWLEDGE_ENGINE_V2 (off by default): B4 ranking weights for the selection, B5 fill lines and honest wording for the writing.
  // Two flags (D9): B4 ranking and B5 writing are switched on separately.
  const ranking = knowledgeRankingV2Enabled();
  const v2 = knowledgeWritingV2Enabled();
  // 1. Select the seeds, for the month the person is asking in (seasonal activities are never suggested out of season).
  const now = new Date();
  const month = currentMonth(now);
  const selectionSeed = opts.sessionId ?? `${Date.now()}`;
  const select = (exclude: readonly string[]) =>
    runEngine(engineInputFromIntake(intake, { seed: selectionSeed, history: opts.history, month, exclude }), ranking ? { weights: WEIGHTS_V2 } : undefined);
  let engine: EngineResult = select([]);
  if (engine.seeds.length < 6) throw new Error("The selection engine could not find enough activities for this profile.");
  await opts.onProgress?.("selected", { ideas: engine.seeds.length });

  // 2. Research, grouped and cached (once, outside the retry loop below).
  const researchFor = (seedList: readonly Seed[], known?: ReadonlyMap<string, SeedResearch>) =>
    researchSeeds({
      activityIds: seedList.map((s) => s.activityId),
      location: intake.location,
      searchDistance: intake.searchDistance,
      locale,
      known,
      now,
    });
  let research = await researchFor(engine.seeds);

  // 2b. An idea that needs somebody's offer (a class, a rental, a club) but for which nothing real could be found near
  // this person is replaced by the next-best activity, once, and only the new ones are researched (the others are
  // passed along). If the replacement does not do better, the first selection stays.
  // Only real offers are shown (Jan: "alleen reële mogelijkheden in de betreffende plek"): a second round replaces what is
  // still without a provider, and in that last round only activities that need nobody's offer are allowed at all.
  const notes = [...engine.notes];
  const tried: string[] = [];
  for (let round = 1; round <= SUPPLY_ROUNDS; round++) {
    const noSupply = seedsWithoutSupply(engine.seeds, research.byActivity);
    if (noSupply.length === 0) break;
    tried.push(...noSupply.map((s) => s.activityId));
    const lastRound = round === SUPPLY_ROUNDS;
    const exclude = lastRound ? [...tried, ...ALL_ACTIVITIES.filter(needsProvider).map((a) => a.id)] : tried;
    const retry = select(exclude);
    if (retry.seeds.length < 6) {
      notes.push(...noSupply.map((s) => `no_local_offer:${s.activityId}`));
      break;
    }
    const retryResearch = await researchFor(retry.seeds, research.byActivity);
    if (seedsWithoutSupply(retry.seeds, retryResearch.byActivity).length < noSupply.length) {
      notes.push(...noSupply.map((s) => `replaced_no_local_offer:${s.activityId}`));
      engine = retry;
      research = { byActivity: retryResearch.byActivity, stats: addStats(research.stats, retryResearch.stats) };
    } else {
      // No better: keep what we have, but still try the last round (only activities that need nobody's offer).
      research = { ...research, stats: addStats(research.stats, retryResearch.stats) };
      if (lastRound) notes.push(...noSupply.map((s) => `no_local_offer:${s.activityId}`));
    }
  }
  const seeds = engine.seeds;
  // Only what was really found: distinct places over all seven ideas (name + city).
  const foundPlaces = new Set<string>();
  for (const r of research.byActivity.values()) for (const o of r.options) foundPlaces.add(`${o.name}|${o.city}`.toLowerCase());
  await opts.onProgress?.("researched", { places: foundPlaces.size });

  // 3. Write the ideas (one retry on a malformed answer, without repeating the research).
  const language = languageLabel(locale);
  // B5 (KNOWLEDGE_ENGINE_V2, off by default): activity-specific fill lines (V1) and honest origin wording (V2).
  const chosenImages = intake.associations ?? [];
  const honestOrigin = v2 && chosenImages.length > 0;
  const baseSystem = v2 ? SYSTEM_PROMPT.replace("For every idea:\n", () => `${ROUTE_CONSISTENCY_RULE}${honestOrigin ? HONEST_ORIGIN_RULE : ""}For every idea:\n`) : SYSTEM_PROMPT;
  const baseLayers = v2 ? LAYERS_SYSTEM_PROMPT.replace("\nHonesty. These matter", () => `${FILL_PROMPT_RULES}\nHonesty. These matter`) : LAYERS_SYSTEM_PROMPT;
  const system = baseSystem.replaceAll("{{LANGUAGE}}", language).replaceAll("{{FREE}}", freeWord(locale));
  const layersSystem = baseLayers.replaceAll("{{LANGUAGE}}", language).replaceAll("{{FREE}}", freeWord(locale));
  const shared = `Today is ${describeToday(now, locale)} (${isoDateNL(now)}).

${formatProfile(intake, characterProfile)}

The seven ideas (in this order; Idea ${seeds.length} is the wildcard):

${seeds.map((s, i) => seedBlock(s, i, research.byActivity.get(s.activityId), locale, chosenImages, honestOrigin)).join("\n\n")}`;
  const user = `${shared}

Call the create_idea_book tool exactly once: ${seeds.length - 1} entries in "ideas" (Ideas 1-${seeds.length - 1}, same order) plus the wildcard entry for Idea ${seeds.length}.`;
  const layersUser = `${shared}

Call the create_layers tool exactly once: ${seeds.length} entries in "ideas", for Ideas 1-${seeds.length} in the order given (Idea ${seeds.length} is the wildcard).`;

  // The layers are written at the same time as the ideas themselves, so they add no waiting time.
  const layersPromise = writeLayers(layersSystem, layersUser, seeds.length, v2);

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
      console.log(`WINDOW: main generation call took ${Date.now() - startedAt}ms, usage=${JSON.stringify(message.usage)}`);
      const candidate = extractToolInput<RawBook>(message, "create_idea_book");
      const split = splitCoreAnswer(candidate, seeds.length);
      if (!split) {
        const n = Array.isArray(candidate.ideas) ? candidate.ideas.length : "no list";
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
  const relatedFor = (seed: Seed): RelatedActivity[] => {
    const found = relatedActivities(seed.activityId, engine.constraints, taken, 3);
    for (const a of found) taken.add(a.id);
    return found.map((a) => ({ id: a.id, label: a.label[locale] }));
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
    const checked = checkEntry(buildEntry(r, seed, research.byActivity.get(seed.activityId), relatedFor(seed), layerFor(seed), fillFor(`idea${i + 1}`, seed)), research.byActivity.get(seed.activityId)?.options ?? [], allHosts);
    issues.push(...checked.issues.map((x) => `idea${i + 1}:${x}`));
    return checked.entry;
  });
  layerIssues("wildcard", wild);
  const wildChecked = checkEntry(
    buildEntry(raw.wildcard, wild, research.byActivity.get(wild.activityId), relatedFor(wild), layerFor(wild), fillFor("wildcard", wild)),
    research.byActivity.get(wild.activityId)?.options ?? [],
    allHosts,
  );
  issues.push(...wildChecked.issues.map((x) => `wildcard:${x}`));
  // Monitoring only (the prompt asks for variety): one opening word on more than three suggestions reads as a template.
  for (const r of repeatedOpenings(keptFills)) issues.push(`fill_repetitive (${r.word} x${r.count})`);
  if (ideas.some((i) => !i.title || !i.why_it_fits || i.details.length === 0) || !wildChecked.entry.title) {
    throw new Error("Claude returned incomplete ideas. Please try again.");
  }

  const list = (v: unknown) => (Array.isArray(v) ? v.map(toText).filter(Boolean) : []);
  const book: GeneratedIdeaBook = {
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

  const report: SeedPipelineReport = { seeds, notes, research: research.stats, issues };
  console.log(
    `WINDOW: seed pipeline: ${seeds.map((s) => `${s.direction}:${s.activityId}`).join(", ")} | issues: ${issues.length ? issues.join("; ") : "none"}`,
  );
  return { book, report };
}
