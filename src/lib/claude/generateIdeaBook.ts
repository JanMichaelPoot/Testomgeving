import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import {
  WINDOW_VOICE_SYSTEM_PROMPT,
  extractToolInput,
} from "@/lib/claude/shared";
import { languageLabel, type Locale } from "@/lib/language";
import type { IntakeAnswers } from "@/app/intake/actions";

export interface IdeaBookEntry {
  title: string;
  intro: string;
  why_it_fits: string;
  details: string[];
  practical_info: string;
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
  };
}

const SYSTEM_PROMPT = `${WINDOW_VOICE_SYSTEM_PROMPT}

The person has just paid for their WINDOW Idea Book — a personalized set of
exactly 6 possibilities generated directly from their profile, plus one
"wildcard" idea. There is no browsing or narrowing step: everything you
generate here is the final, paid deliverable, so it needs to already feel
considered and worth the money. The book is printed as a fixed 6-page PDF
(two ideas per page), so every field below has a firm length limit —
respect it exactly, don't pad and don't run long.

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
- Every idea needs: a title (max ~6 words), a one-sentence intro, a
  one-sentence why_it_fits (why this fits *this* person, referencing
  specifics from their profile), details (an array of exactly 3 concrete,
  sequential, doable steps — one short imperative sentence per step, no
  vague verbs like "consider" or "explore"), and practical_info (one short
  line combining a realistic time and cost estimate).
- image_suggestion is a one-line internal art-direction note for a future
  illustration of this idea — not shown to the user, so it can be terse.
- Write the profile_summary as one warm, specific sentence that reflects
  this person's situation back to them — not a generic recap.
- Write must_haves and preferences as short, cleaned-up bullet phrases
  echoing what the person told you (don't invent new ones).
- The "labels" are tiny pieces of UI micro-copy for the printed book
  (section headings like "Steps" or "First action"); keep them short.
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
    practical_info: { type: "string" },
    image_suggestion: { type: "string" },
  },
  required: [
    "title",
    "intro",
    "why_it_fits",
    "details",
    "practical_info",
    "image_suggestion",
  ],
};

export async function generateIdeaBook(
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
            labels: {
              type: "object",
              properties: {
                steps_heading: { type: "string" },
                first_action_heading: { type: "string" },
                wildcard_heading: { type: "string" },
                time_label: { type: "string" },
                cost_label: { type: "string" },
              },
              required: [
                "steps_heading",
                "first_action_heading",
                "wildcard_heading",
                "time_label",
                "cost_label",
              ],
            },
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

function normalizeEntry(entry: unknown): IdeaBookEntry {
  const e = (entry ?? {}) as Partial<IdeaBookEntry>;
  return {
    title: toText(e.title),
    intro: toText(e.intro),
    why_it_fits: toText(e.why_it_fits),
    details: toTextArray(e.details),
    practical_info: toText(e.practical_info),
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
    },
  };
}
