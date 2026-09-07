import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import {
  WINDOW_VOICE_SYSTEM_PROMPT,
  extractToolInput,
} from "@/lib/claude/shared";
import { languageLabel, type Locale } from "@/lib/language";
import type { IntakeAnswers } from "@/app/intake/actions";

export interface IdeaPractical {
  estimated_cost: string;
  duration: string;
  difficulty: "easy" | "moderate" | "demanding";
  preparation: string;
}

// Shared between the PDF renderer and the /plan page so both ever show the
// exact same wording for a given difficulty value, in either locale.
export const DIFFICULTY_LABELS: Record<Locale, Record<IdeaPractical["difficulty"], string>> = {
  nl: { easy: "Makkelijk", moderate: "Gemiddeld", demanding: "Uitdagend" },
  en: { easy: "Easy", moderate: "Moderate", demanding: "Demanding" },
};

export interface IdeaLocation {
  name: string;
  address: string;
  city: string;
}

export interface IdeaBookEntry {
  title: string;
  intro: string;
  why_it_fits: string;
  details: string[];
  first_action: string;
  practical: IdeaPractical;
  location: IdeaLocation | null;
  requirements: string[];
  image_suggestion: string;
}

export interface GeneratedIdeaBook {
  profile_summary: string;
  must_haves: string[];
  preferences: string[];
  ideas: IdeaBookEntry[];
  wildcard: IdeaBookEntry;
  labels: {
    steps_heading: string;
    first_action_heading: string;
    wildcard_heading: string;
    time_label: string;
    cost_label: string;
    location_heading: string;
    requirements_heading: string;
  };
}

const SYSTEM_PROMPT = `${WINDOW_VOICE_SYSTEM_PROMPT}

The person has just paid for their WINDOW Idea Book — a personalized set of
exactly 6 possibilities generated directly from their profile, plus one
"wildcard" idea. There is no browsing or narrowing step: everything you
generate here is the final, paid deliverable, so it needs to already feel
considered and worth the money. The book is printed as a PDF with one full
page per idea, so there's real room to breathe — but every field still has
a length guideline below. Stay close to it: concise and specific reads as
considered, padding to fill space reads as filler.

Rules for using the profile:
- Fields the person marked as MUST-HAVES are hard constraints. Never
  generate an idea that violates one. If a must-have makes most ideas
  impossible, work harder within it rather than ignoring it.
- Fields the person marked as PREFERENCES are directional nudges only —
  lean toward them where it fits naturally, but don't force every idea to
  satisfy every preference, and don't treat them as requirements.
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
  a marketing blurb. Also needed: details (an array of
  exactly 3 concrete, sequential, doable steps — one short imperative
  sentence per step, max ~16 words each, no vague verbs like "consider" or
  "explore"), and a first_action: one specific, immediately doable next
  step, one short instruction (max ~16 words), e.g. "Check dit weekend de
  beschikbaarheid en boek daarna de kayak.".
- practical is a small structured object, not free text:
  estimated_cost (short, e.g. "€25–40" or "Gratis"), duration (short,
  e.g. "Een dagdeel"), difficulty (exactly "easy", "moderate", or
  "demanding"), and preparation (one short line on what to arrange
  beforehand, or an empty string if nothing needs preparing).
- location: only fill this in for ideas tied to one specific, findable
  physical place — a named park, museum, trail, neighborhood, or venue.
  Use it for the place's name and city; only fill in "address" when you
  are confident about a real, well-known public place (a famous landmark,
  a specific city park) — leave it as an empty string for anything more
  specific than that, since you cannot verify exact street addresses of
  individual businesses. Set location to null entirely for ideas that
  don't happen at one specific findable place (e.g. "cook a new recipe at
  home", "write letters to old friends").
- requirements: up to 4 short items (a few words each) of concrete things
  the person needs to arrange, buy, or bring (tickets, gear, clothing, an
  app, a reservation) — an empty array when the idea genuinely needs
  nothing beyond showing up.
- Never invent a specific ticket price, opening hours, or a direct URL —
  you have no way to verify those and a wrong one actively hurts trust.
  Keep estimated_cost approximate and don't mention opening hours at all.
- image_suggestion is a one-line internal art-direction note for a future
  illustration of this idea — not shown to the user, so it can be terse.
- Write the profile_summary as one warm, specific sentence that reflects
  this person's situation back to them — not a generic recap.
- Write must_haves and preferences as short, cleaned-up bullet phrases
  echoing what the person told you (don't invent new ones).
- The "labels" are tiny pieces of UI micro-copy for the printed book
  (section headings like "Steps" or "What you'll need"); keep them short.
- Write absolutely everything (profile_summary, must_haves, preferences,
  all idea fields, all labels) in {{LANGUAGE}}, not English, unless
  {{LANGUAGE}} is English.`;

function formatProfile(intake: IntakeAnswers): string {
  return `Situation: ${intake.situation}
Purpose: ${intake.purpose}
Purpose detail: ${intake.purposeFollowUp}
Age bracket: ${intake.ageCategory}
Location: ${intake.location}
Search distance: ${intake.searchDistance}
Practical-to-wild dial: ${intake.practicalToWild}
Desired surprise level: ${intake.surpriseLevel}
Time available: ${intake.timeAvailable}
Budget: ${intake.budget}
Willingness to put in effort: ${intake.effort}
Open to these kinds of possibilities: ${intake.solutionTypes.join(", ")}
Must-haves (hard constraints): ${intake.mustHaves || "none stated"}
Preferences (soft nudges): ${intake.preferences || "none stated"}
Company: ${intake.company}`;
}

const PRACTICAL_SCHEMA = {
  type: "object" as const,
  properties: {
    estimated_cost: { type: "string" },
    duration: { type: "string" },
    difficulty: { type: "string", enum: ["easy", "moderate", "demanding"] },
    preparation: { type: "string" },
  },
  required: ["estimated_cost", "duration", "difficulty", "preparation"],
};

const LOCATION_SCHEMA = {
  type: ["object", "null"] as const,
  properties: {
    name: { type: "string" },
    address: { type: "string" },
    city: { type: "string" },
  },
  required: ["name", "address", "city"],
};

const IDEA_ENTRY_SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string" },
    intro: { type: "string" },
    why_it_fits: { type: "string" },
    details: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
    },
    first_action: { type: "string" },
    practical: PRACTICAL_SCHEMA,
    location: LOCATION_SCHEMA,
    requirements: { type: "array", maxItems: 4, items: { type: "string" } },
    image_suggestion: { type: "string" },
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
  locale: Locale
): Promise<GeneratedIdeaBook> {
  const language = languageLabel(locale);
  const system = SYSTEM_PROMPT.replaceAll("{{LANGUAGE}}", language);

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 12000,
    system,
    messages: [
      {
        role: "user",
        content: `${formatProfile(intake)}

Generate the full Idea Book by calling the create_idea_book tool exactly
once, with exactly 6 ideas plus one separate wildcard.`,
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
  locale: Locale
): Promise<GeneratedIdeaBook> {
  const attempts = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await callClaudeForIdeaBook(intake, locale);
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
function toText(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => toText(item)).join(" ");
  if (value == null) return "";
  return String(value);
}

function toTextArray(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  return items.map(toText).filter((item) => item.length > 0);
}

function normalizePractical(value: unknown): IdeaPractical {
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

function normalizeLocation(value: unknown): IdeaLocation | null {
  if (value == null || typeof value !== "object") return null;
  const l = value as Partial<IdeaLocation>;
  const name = toText(l.name);
  if (!name) return null;
  return { name, address: toText(l.address), city: toText(l.city) };
}

function normalizeEntry(entry: unknown): IdeaBookEntry {
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
  };
}

function toTextList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(toText) : [];
}

function normalizeIdeaBook(book: GeneratedIdeaBook): GeneratedIdeaBook {
  const ideas = Array.isArray(book.ideas) ? book.ideas.map(normalizeEntry) : [];

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
    wildcard: normalizeEntry(book.wildcard),
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
