import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import {
  WINDOW_VOICE_SYSTEM_PROMPT,
  extractToolInput,
} from "@/lib/claude/shared";
import { languageLabel, type Locale } from "@/lib/locale";
import type { IntakeAnswers } from "@/app/intake/actions";
import { PHOTO_CATEGORIES } from "@/lib/claude/ideaBookTypes";

// Re-exported so existing server-side callers (plan/data.ts, pdf/ideaBook.ts,
// email/windowPlan.ts) keep importing from this file — but the type/constant
// definitions themselves live in ideaBookTypes.ts, which client components
// (IdeaDetail, IdeaBookViewer) import directly instead, since importing
// anything from *this* file would drag the Anthropic client above into the
// browser bundle.
export {
  DIFFICULTY_LABELS,
  type IdeaPractical,
  type IdeaLocation,
  type IdeaDoor,
  type IdeaScores,
  type IdeaBookEntry,
  type GeneratedIdeaBook,
  type PhotoCategory,
} from "@/lib/claude/ideaBookTypes";
import type {
  IdeaBookEntry,
  GeneratedIdeaBook,
  IdeaPractical,
  IdeaLocation,
  IdeaDoor,
  IdeaScores,
  PhotoCategory,
} from "@/lib/claude/ideaBookTypes";
import type { CharacterProfile } from "@/lib/characterProfile";
import { describeDiscoveryForPrompt } from "@/lib/discovery/answers";

const SYSTEM_PROMPT = `${WINDOW_VOICE_SYSTEM_PROMPT}

The person has just paid for their WINDOW Idea Book — a personalized set of
exactly 6 possibilities generated directly from their profile, plus one
"wildcard" idea. There is no browsing or narrowing step: everything you
generate here is the final, paid deliverable, so it needs to already feel
considered and worth the money. The book is printed as a PDF with one full
page per idea, so there's real room to breathe — but every field still has
a length guideline below. Stay close to it: concise and specific reads as
considered, padding to fill space reads as filler.

Open Doors — how to structure the 6 ideas:
Each of the 6 regular ideas belongs to exactly one "door" — how far it sits
from what this person already does. Quality comes before quota: don't
force a weak idea into an empty door just to fill it, but aim to spread the
6 across all four doors rather than clustering them in one or two.
- "natural": a confident, well-executed extension of something they
  already clearly enjoy or already do. Low risk, but still needs to feel
  fresh and specific — not a rehash of what they described back to them.
- "discovery": adjacent to their stated interests, something they likely
  haven't tried or framed this way before — it reveals an option they
  didn't know was available to them.
- "unexpected": genuinely surprising given their profile, but you can
  explain in one sentence why it actually fits them — the why_it_fits line
  carries this weight. The reaction this should produce: "oh, that could
  actually work."
- "stretch": meaningfully outside their comfort zone. Bigger than
  "unexpected" — how far to push depends on their comfort-zone-to-wild
  dial and their internal challenge level below. Push harder when that's
  high, stay gentler when it's low — but a stretch idea must stay
  achievable, never reckless.
The separate wildcard keeps its own door, "wildcard" — see below, it's
always its own slot and not counted among the 6.

Combinatorial creativity — avoid generic, single-signal ideas. For every
idea, actively combine at least two distinct signals from the profile (a
stated interest plus their company/context, plus a location, timing, or
personal-reflection signal) into one idea that feels assembled specifically
for this person's combination of answers — not something that could have
been generated for almost anyone who shares just one of their interests.

Internal scoring — for every idea (the 6 plus the wildcard), also return a
"scores" object: your own honest internal estimate, each 0-100, never
shown to the person. relevance (fit with their stated needs/must-haves),
novelty (how new this would likely be to them specifically), feasibility
(how realistic given their time/budget/effort), surprise (how unexpected
it would feel to them), shareability (how likely they'd tell someone about
it), effort (physical/mental/logistical effort required), cost (relative
to their stated budget), social_fit (how well it matches their
company/context), and challenge_level (how far it pushes their comfort
zone). Differentiate honestly — a "natural" idea should score lower on
novelty/surprise/challenge_level than a "stretch" or "wildcard" idea; don't
return near-identical numbers across all 7 ideas.

Rules for using the profile:
- Fields the person marked as MUST-HAVES are hard constraints. Never
  generate an idea that violates one. If a must-have makes most ideas
  impossible, work harder within it rather than ignoring it.
- Fields the person marked as PREFERENCES are directional nudges only —
  lean toward them where it fits naturally, but don't force every idea to
  satisfy every preference, and don't treat them as requirements.
- If the profile lists concrete interests they picked from a card library:
  at least two of the six ideas (the "natural" door) must build directly on
  those interests, the others may reach further and should connect back to
  them where they can. Never conclude anything about a person's sociability,
  shyness or character from their interests. Only the explicit "how they like
  to take part" line says anything about that; when it is present, suggest each
  idea in the way they chose first and mention other ways only as alternatives,
  and always include an easy first way in (a trial class, a beginner evening,
  an open day) where one exists.
- The internal character signals (curiosity, spontaneity,
  need for structure, challenge level) are for calibrating tone and door
  balance only — never reference them, their names, or their numbers in
  anything the person reads.
- If the profile is sparse (short or vague answers), don't over-filter —
  generate a genuinely diverse, exploratory set rather than a narrow,
  timid one.
- The wildcard must be a real, usable idea — not a joke — but framed with
  a knowing "we probably shouldn't suggest this, but that's exactly why
  you'll love it" spirit. It should still respect any must-haves.
- Every idea needs: a title (max ~6 words), a one-sentence intro (max ~18
  words), a one-sentence why_it_fits (max ~18 words) written as a direct,
  personal callback to what THIS person actually told you — start from
  their own words where you can ("You mentioned...", "Since you said...",
  "Because you're looking for...") rather than a generic justification that
  could apply to anyone. It should read like proof you were listening, not
  a marketing blurb.
- details: an array of exactly 2 concrete, sequential steps that read like
  a ready-made how-to, not a vague suggestion — say exactly what to open,
  search, or click. Name the specific website/app/platform from the
  verified research brief below when there is one for this idea (e.g.
  "Open eventbrite.nl, search for '<exact term>' and filter by your
  city."), or a well-known, certainly-real platform/search engine when the
  research didn't verify anything more specific (Google Maps, Marktplaats,
  Meetup, a plain Google search with an exact query) — never a vague
  instruction like "find a suitable place" or "look online". One short
  imperative sentence per step, max ~20 words each, no vague verbs like
  "consider" or "explore".
- first_action: one instruction the person can complete within 60 seconds
  of finishing reading, naming an exact site/app/search term/button — e.g.
  "Open Google Maps and search '<exact term>'" or "Go to meetup.com and
  filter on '<category>' in <city>." (max ~20 words). Never a vague "think
  about" or "consider".
- practical is a small structured object, not free text:
  estimated_cost (short, e.g. "€25–40" or "Gratis"), duration (short,
  e.g. "Een dagdeel"), difficulty (exactly "easy", "moderate", or
  "demanding"), and preparation (one short line on what to arrange
  beforehand, or an empty string if nothing needs preparing).
- location: only fill this in for ideas tied to one specific, findable
  physical place — a named park, museum, trail, neighborhood, or venue.
  Take the name and city from the verified research brief below; only fill
  in "address" when the research brief itself confirms an address for a
  well-known public place. Set location to null entirely for ideas that
  don't happen at one specific findable place (e.g. "cook a new recipe at
  home", "write letters to old friends"), or when the research brief has
  nothing relevant to offer for this idea.
- requirements: up to 4 short items (a few words each) of concrete things
  the person needs to arrange, buy, or bring (tickets, gear, clothing, an
  app, a reservation) — an empty array when the idea genuinely needs
  nothing beyond showing up.
- Never invent a specific business name, exact street address, ticket
  price, opening hours, or direct URL that isn't confirmed in the verified
  research brief below — you have no way to verify those yourself and a
  wrong one actively hurts trust, in a product people already paid for.
  Keep estimated_cost approximate and don't mention opening hours at all.
- image_suggestion is a one-line internal art-direction note for a future
  illustration of this idea — not shown to the user, so it can be terse.
- photo_category: pick exactly one value from this fixed list that best
  matches the idea's actual real-world activity/setting — this drives which
  photo from a small fixed library appears on this idea's page, so pick the
  closest real match rather than defaulting to the same category every time:
  - art_culture: visiting or viewing art/culture (museums, galleries, exhibitions, architecture tours) — the idea is about LOOKING, not making.
  - creative_workshop: hands-on making (pottery, painting, crafts, workshops where the person creates something themselves).
  - food_drink: eating, drinking, cooking, coffee, restaurants, bars.
  - nature_outdoor: walking, parks, forests, gardens, being outside in nature.
  - water_activity: canals, lakes, rivers, paddleboarding, kayaking, boats.
  - active_sport: cycling, climbing, hiking, physically active pursuits.
  - music_nightlife: concerts, live music, clubs, going out at night.
  - wellness_relax: spa, yoga, massage, quiet relaxation.
  - social_games: board games, escape rooms, quizzes, games with others.
  - travel_adventure: day trips, road trips, exploring somewhere new by traveling there.
  - home_cozy: staying in, reading, cozy at-home time.
  - market_shopping: markets, vintage shopping, browsing stalls.
  Choose based on what the person will actually be DOING, not the theme they
  mentioned — e.g. visiting a museum is art_culture even if triggered by a
  love of "creativity"; only use creative_workshop when they make something
  themselves.
- Write the profile_summary as one warm, specific sentence that reflects
  this person's situation back to them — not a generic recap.
- Write must_haves and preferences as short, cleaned-up bullet phrases
  echoing what the person told you (don't invent new ones).
- The "labels" are tiny pieces of UI micro-copy for the printed book
  (section headings like "Steps" or "What you'll need"); keep them short.
- Write absolutely everything (profile_summary, must_haves, preferences,
  all idea fields, all labels) in {{LANGUAGE}}, not English, unless
  {{LANGUAGE}} is English.`;

export function formatProfile(intake: IntakeAnswers, character: CharacterProfile): string {
  // Only present for people who used the visual card wizard.
  const discoveryLines = describeDiscoveryForPrompt(intake);
  return `Situation: ${intake.situation}
Purpose: ${intake.purpose}
Purpose detail: ${intake.purposeFollowUp}
Age bracket: ${intake.ageCategory}
Location: ${intake.location}
Search distance: ${intake.searchDistance}
Comfort-zone-to-wild dial (how safe/predictable vs. surprising/adventurous): ${intake.practicalToWild}
Time available: ${intake.timeAvailable}
Budget: ${intake.budget}
Willingness to put in effort: ${intake.effort}
Open to these kinds of possibilities: ${intake.solutionTypes.join(", ")}
Must-haves (hard constraints): ${intake.mustHaves || "none stated"}
Preferences (soft nudges): ${intake.preferences || "none stated"}
Company: ${intake.company.join(", ") || "not stated"}
Free-time pattern (what they said they'd actually do on a free Saturday): ${intake.freeTimePattern || "not stated"}
Personal reflection (something they'd secretly like to do more): ${intake.personalReflection || "not stated"}${
    discoveryLines ? `
${discoveryLines}` : ""
  }

Internal character signals (derived, 0-100 each, 50 = neutral — for
calibrating tone and door balance only, see the rules below):
Curiosity: ${character.dimensions.curiosity}
Spontaneity: ${character.dimensions.spontaneity}
Need for structure: ${character.dimensions.needForStructure}
Challenge level: ${character.challengeLevel}`;
}

// A slimmer profile view for the research pass below — it only needs the
// signals that narrow down what's worth searching for (where, what kind of
// thing, budget/time), not the full character-scoring context that the
// idea-generation call needs.
function formatProfileForResearch(intake: IntakeAnswers): string {
  return `Location: ${intake.location}
Search distance: ${intake.searchDistance}
Situation: ${intake.situation}
Purpose: ${intake.purpose}
Purpose detail: ${intake.purposeFollowUp}
Time available: ${intake.timeAvailable}
Budget: ${intake.budget}
Open to these kinds of possibilities: ${intake.solutionTypes.join(", ")}
Must-haves (hard constraints): ${intake.mustHaves || "none stated"}
Preferences (soft nudges): ${intake.preferences || "none stated"}
Company: ${intake.company.join(", ") || "not stated"}`;
}

// Runs before idea generation, using Claude's live web-search tool to find
// real, currently-operating businesses/venues/platforms/routes/events that
// match this person's profile — the idea-generation call is then told to
// only name something specific when it's backed by this brief, never from
// its own (unverifiable, potentially outdated) training data. This is what
// makes the "concrete real names" requirement in generateIdeaBook's system
// prompt actually safe rather than an invitation to hallucinate business
// names — see the improvement-plan discussion this replaces (previously
// the prompt only allowed well-known landmarks, precisely because there was
// no grounding source).
// Fails soft: if the search call errors (network, quota, tool
// unavailable), idea generation still proceeds — every idea then simply
// falls back to generic, verifiably-real platforms (Google Maps, Meetup,
// a plain search query) per the system prompt's fallback instruction,
// rather than failing the whole paid generation over a research outage.
async function researchGroundedOptions(intake: IntakeAnswers, locale: Locale): Promise<string> {
  const language = languageLabel(locale);
  const startedAt = Date.now();
  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      // effort: "medium" — this pass is search-and-note-taking, not creative
      // writing, so it doesn't need the default "high" reasoning depth; cuts
      // token spend on what was measured to be the single most expensive
      // step of a generation (~74% of the Claude cost per Idea Book).
      output_config: { effort: "medium" },
      // cache_control on the static system prompt: web_search is a
      // server-side tool, so a single call here can internally run several
      // search round-trips (each round-trip's growing context re-includes
      // this same system prompt) — without a cache breakpoint every one of
      // those re-inclusions is billed at full input price instead of the
      // ~90%-cheaper cache-hit rate. Free win: same output, lower cost, no
      // behavior change.
      system: [
        {
          type: "text",
          text: `You are a meticulous local-options researcher for WINDOW, a
possibility-discovery app. Your only job here is to use web search to find
REAL, CURRENTLY OPERATING businesses, venues, routes, events, or platforms
that concretely match the profile below — always verify with a search,
never rely on memory or a plausible-sounding guess. Write your findings in
${language} as a compact, scannable research brief, not prose.`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `${formatProfileForResearch(intake)}

Search for concrete, real, currently-operating options relevant to this
person's location and search distance, their situation/purpose, budget,
time available, and the kinds of possibilities they're open to. Cover a
spread of different activity types rather than depth on just one. For each
theme you find something for, list 2-3 real named options: the
business/venue/route/event/platform's name, its city, a one-line
description of what it is, and its website URL exactly as it appears in
your search results (only include a URL you actually saw in the results —
never guess one). If you cannot verify anything real for a theme, say so
explicitly rather than inventing a name.`,
        },
      ],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          // Lowered from 8 to 4 — this run's own typical usage was 4, so
          // this caps the worst case (a very open-ended profile triggering
          // many searches) without changing the common case.
          max_uses: 4,
          user_location: {
            type: "approximate",
            city: intake.location || null,
            country: "NL",
          },
        },
      ],
    });

    const searchCalls = message.content.filter(
      (block) => block.type === "server_tool_use" && block.name === "web_search"
    ).length;
    console.log(
      `WINDOW: research pass took ${Date.now() - startedAt}ms, ${searchCalls} web searches, ` +
        `usage=${JSON.stringify(message.usage)}`
    );

    return message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  } catch (err) {
    console.error(
      `WINDOW: grounded-options web search failed after ${Date.now() - startedAt}ms, continuing without it`,
      err
    );
    return "";
  }
}

export const PRACTICAL_SCHEMA = {
  type: "object" as const,
  properties: {
    estimated_cost: { type: "string" },
    duration: { type: "string" },
    difficulty: { type: "string", enum: ["easy", "moderate", "demanding"] },
    preparation: { type: "string" },
  },
  required: ["estimated_cost", "duration", "difficulty", "preparation"],
};

export const LOCATION_SCHEMA = {
  type: ["object", "null"] as const,
  properties: {
    name: { type: "string" },
    address: { type: "string" },
    city: { type: "string" },
  },
  required: ["name", "address", "city"],
};

// Fase 3 (Possibility/Door Engine) — see the master prompt sections 6 and
// 11. Shared between the 6 regular ideas and the wildcard: the wildcard is
// distinguished by always carrying door "wildcard" (enforced defensively in
// normalizeEntry below, not just trusted from the model's output).
const SCORES_SCHEMA = {
  type: "object" as const,
  properties: {
    relevance: { type: "number" },
    novelty: { type: "number" },
    feasibility: { type: "number" },
    surprise: { type: "number" },
    shareability: { type: "number" },
    effort: { type: "number" },
    cost: { type: "number" },
    social_fit: { type: "number" },
    challenge_level: { type: "number" },
  },
  required: [
    "relevance",
    "novelty",
    "feasibility",
    "surprise",
    "shareability",
    "effort",
    "cost",
    "social_fit",
    "challenge_level",
  ],
};

const IDEA_ENTRY_SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string" },
    intro: { type: "string" },
    why_it_fits: { type: "string" },
    details: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: { type: "string" },
    },
    first_action: { type: "string" },
    practical: PRACTICAL_SCHEMA,
    location: LOCATION_SCHEMA,
    requirements: { type: "array", maxItems: 4, items: { type: "string" } },
    image_suggestion: { type: "string" },
    photo_category: { type: "string", enum: [...PHOTO_CATEGORIES] },
    door: {
      type: "string",
      enum: ["natural", "discovery", "unexpected", "stretch", "wildcard"],
    },
    scores: SCORES_SCHEMA,
  },
  required: [
    "title",
    "intro",
    "why_it_fits",
    "details",
    "first_action",
    "practical",
    "location",
    "requirements",
    "image_suggestion",
    "photo_category",
    "door",
    "scores",
  ],
};

const LABELS_SCHEMA = {
  type: "object" as const,
  properties: {
    steps_heading: { type: "string" },
    first_action_heading: { type: "string" },
    wildcard_heading: { type: "string" },
    time_label: { type: "string" },
    cost_label: { type: "string" },
    location_heading: { type: "string" },
    requirements_heading: { type: "string" },
  },
  required: [
    "steps_heading",
    "first_action_heading",
    "wildcard_heading",
    "time_label",
    "cost_label",
    "location_heading",
    "requirements_heading",
  ],
};

async function callClaudeForIdeaBook(
  intake: IntakeAnswers,
  locale: Locale,
  characterProfile: CharacterProfile,
  researchBrief: string
): Promise<GeneratedIdeaBook> {
  const language = languageLabel(locale);
  const system = SYSTEM_PROMPT.replaceAll("{{LANGUAGE}}", language);
  const researchBlock = researchBrief
    ? `Verified live web research (use ONLY these names for anything
specific — never invent a business/venue/platform/route/event name beyond
what's listed here; if a theme below isn't covered, keep that idea's
location null and its steps/first_action generic instead of guessing):
${researchBrief}`
    : `No verified web research came back this time — keep steps/
first_action generic (well-known, certainly-real platform types and search
strategies) rather than inventing a specific unverified business, venue,
or address.`;

  const generationStartedAt = Date.now();
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 12000,
    system,
    messages: [
      {
        role: "user",
        content: `${formatProfile(intake, characterProfile)}

${researchBlock}

Generate the full Idea Book by calling the create_idea_book tool exactly
once, with exactly 6 ideas plus one separate wildcard. Spread the 6 ideas
across the natural/discovery/unexpected/stretch doors (quality over a rigid
quota); the wildcard's door is always "wildcard".`,
      },
    ],
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
            ideas: {
              type: "array",
              minItems: 6,
              maxItems: 6,
              items: IDEA_ENTRY_SCHEMA,
            },
            wildcard: IDEA_ENTRY_SCHEMA,
            labels: LABELS_SCHEMA,
          },
          required: [
            "profile_summary",
            "must_haves",
            "preferences",
            "ideas",
            "wildcard",
            "labels",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: "create_idea_book" },
  });
  console.log(
    `WINDOW: main generation call took ${Date.now() - generationStartedAt}ms, usage=${JSON.stringify(message.usage)}`
  );

  const raw = extractToolInput<GeneratedIdeaBook>(message, "create_idea_book");
  return normalizeIdeaBook(raw);
}

// The Anthropic SDK already retries transient network/5xx errors on its
// own, but that doesn't cover a *successful* response that comes back
// malformed (e.g. an empty ideas array) — normalizeIdeaBook throws in that
// case, and that failure mode is worth one extra full attempt before we
// give up and show the user an error on a purchase they already paid for.
export async function generateIdeaBook(
  intake: IntakeAnswers,
  locale: Locale,
  characterProfile: CharacterProfile
): Promise<GeneratedIdeaBook> {
  const attempts = 2;
  let lastError: unknown;
  // Researched once: a retry after a malformed answer must not pay for the searches again.
  const researchBrief = await researchGroundedOptions(intake, locale);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await callClaudeForIdeaBook(intake, locale, characterProfile, researchBrief);
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError;
}

// Claude's tool schema declares every idea field as a plain string, but
// forced tool-use doesn't guarantee it at runtime — a field described as
// "3-5 steps" sometimes comes back as an array of steps instead of one
// string. Coerce defensively rather than let the PDF renderer's string
// methods (e.g. wrapText's .split) crash on an unexpected array.
export function toText(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => toText(item)).join(" ");
  if (value == null) return "";
  return String(value);
}

export function toTextArray(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  return items.map(toText).filter((item) => item.length > 0);
}

export function normalizePractical(value: unknown): IdeaPractical {
  const p = (value ?? {}) as Partial<IdeaPractical>;
  const difficulty =
    p.difficulty === "easy" || p.difficulty === "moderate" || p.difficulty === "demanding"
      ? p.difficulty
      : "moderate";
  return {
    estimated_cost: toText(p.estimated_cost),
    duration: toText(p.duration),
    difficulty,
    preparation: toText(p.preparation),
  };
}

export function normalizeLocation(value: unknown): IdeaLocation | null {
  if (value == null || typeof value !== "object") return null;
  const l = value as Partial<IdeaLocation>;
  const name = toText(l.name);
  if (!name) return null;
  return { name, address: toText(l.address), city: toText(l.city) };
}

const VALID_DOORS: readonly IdeaDoor[] = [
  "natural",
  "discovery",
  "unexpected",
  "stretch",
  "wildcard",
];

// Falls back to "discovery" — the middle-of-the-road door — rather than
// throwing, on the rare chance the model returns something outside the
// enum despite the forced tool schema declaring it.
function normalizeDoor(value: unknown, fallback: IdeaDoor): IdeaDoor {
  return typeof value === "string" && (VALID_DOORS as string[]).includes(value)
    ? (value as IdeaDoor)
    : fallback;
}

// Falls back to "nature_outdoor" — a broadly applicable, unremarkable
// default — rather than throwing, on the rare chance the model returns
// something outside the enum despite the forced tool schema declaring it.
function normalizePhotoCategory(value: unknown): PhotoCategory {
  return typeof value === "string" && (PHOTO_CATEGORIES as readonly string[]).includes(value)
    ? (value as PhotoCategory)
    : "nature_outdoor";
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeScores(value: unknown): IdeaScores {
  const s = (value ?? {}) as Partial<IdeaScores>;
  return {
    relevance: clampScore(s.relevance),
    novelty: clampScore(s.novelty),
    feasibility: clampScore(s.feasibility),
    surprise: clampScore(s.surprise),
    shareability: clampScore(s.shareability),
    effort: clampScore(s.effort),
    cost: clampScore(s.cost),
    social_fit: clampScore(s.social_fit),
    challenge_level: clampScore(s.challenge_level),
  };
}

// forceDoor overrides whatever the model returned — used for the wildcard
// slot, which must always be door "wildcard" regardless of model output,
// rather than merely falling back to it when missing/invalid.
function normalizeEntry(entry: unknown, opts: { forceDoor?: IdeaDoor } = {}): IdeaBookEntry {
  const e = (entry ?? {}) as Partial<IdeaBookEntry>;
  return {
    title: toText(e.title),
    intro: toText(e.intro),
    why_it_fits: toText(e.why_it_fits),
    details: toTextArray(e.details),
    first_action: toText(e.first_action),
    practical: normalizePractical(e.practical),
    location: normalizeLocation(e.location),
    requirements: toTextArray(e.requirements),
    image_suggestion: toText(e.image_suggestion),
    photo_category: normalizePhotoCategory(e.photo_category),
    door: opts.forceDoor ?? normalizeDoor(e.door, "discovery"),
    scores: normalizeScores(e.scores),
  };
}

function toTextList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(toText) : [];
}

function normalizeIdeaBook(book: GeneratedIdeaBook): GeneratedIdeaBook {
  const ideas = Array.isArray(book.ideas)
    ? book.ideas.map((idea) => normalizeEntry(idea))
    : [];

  if (ideas.length === 0) {
    throw new Error(
      "Claude did not return any ideas in the expected format. Please try again."
    );
  }

  return {
    profile_summary: toText(book.profile_summary),
    must_haves: toTextList(book.must_haves),
    preferences: toTextList(book.preferences),
    ideas,
    wildcard: normalizeEntry(book.wildcard, { forceDoor: "wildcard" }),
    labels: {
      steps_heading: toText(book.labels?.steps_heading),
      first_action_heading: toText(book.labels?.first_action_heading),
      wildcard_heading: toText(book.labels?.wildcard_heading),
      time_label: toText(book.labels?.time_label),
      cost_label: toText(book.labels?.cost_label),
      location_heading: toText(book.labels?.location_heading),
      requirements_heading: toText(book.labels?.requirements_heading),
    },
  };
}
