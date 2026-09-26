import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { WINDOW_VOICE_SYSTEM_PROMPT, extractToolInput } from "@/lib/claude/shared";
import { languageLabel, type Locale } from "@/lib/locale";
import type { IntakeAnswers } from "@/app/intake/actions";
import type { CharacterProfile } from "@/lib/characterProfile";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import {
  LOCATION_SCHEMA,
  PRACTICAL_SCHEMA,
  formatProfile,
  normalizeLocation,
  normalizePractical,
  toText,
  toTextArray,
} from "@/lib/claude/generateIdeaBook";
import { researchSeeds, type LocalOption, type SeedResearch } from "@/lib/claude/localResearch";
import { engineInputFromIntake, runEngine } from "@/lib/discovery/engine";
import type { EngineResult, Seed } from "@/lib/discovery/engine";
import { photoCategoryFor } from "@/lib/discovery/engine/photo";
import { scoresForSeed } from "@/lib/discovery/engine/scores";
import { TAGS, getActivity } from "@/lib/discovery/library";

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
export function shouldUseEngine(intake: Pick<IntakeAnswers, "interests" | "interestDomains" | "surpriseMe">): boolean {
  return (intake.interests?.length ?? 0) > 0 || (intake.interestDomains?.length ?? 0) > 0 || intake.surpriseMe === true;
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
- practical: estimated_cost (short, e.g. "€25–40" or "Gratis"), duration (short), difficulty ("easy",
  "moderate" or "demanding") and preparation (one short line, or empty).
- location: only when the idea happens at one specific, findable place taken from the verified local options of
  THAT idea (name and city; the address only when the research gives it). Otherwise null.
- requirements: up to 4 short items (a few words each) to arrange, buy or bring; empty when nothing is needed.
- Follow the "How to take part" line: open with the form the person chose and mention other forms only as
  alternatives. Use the "Easy way in" as the starting point, adapted to the local option where there is one.
- If an idea says it may only be suggested with qualified supervision, say so in its steps and only offer the
  supervised, legal way in.
- Never invent a business name, street address, ticket price, opening hours or website that is not in that idea's
  verified local options. Keep costs approximate and do not mention opening hours.

Also write profile_summary (one warm, specific sentence reflecting their situation back), must_haves and
preferences (short cleaned-up phrases echoing what they told you; do not invent new ones).

Write absolutely everything in {{LANGUAGE}}, not English, unless {{LANGUAGE}} is English.`;

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

function why(seed: Seed, locale: Locale): string {
  const label = (id: string) => getActivity(id)?.label[locale] ?? id;
  const via = seed.via.map((t) => TAG_LABEL.get(t)?.[locale] ?? t).join(", ");
  if (seed.hybrid) {
    return `A combination the person did not ask for but that grows out of what they picked (${label(seed.hybrid.partnerId)}): "${seed.hybrid.label[locale]}".`;
  }
  switch (seed.direction) {
    case "familiar":
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

function seedBlock(seed: Seed, index: number, research: SeedResearch | undefined, locale: Locale): string {
  const a = getActivity(seed.activityId)!;
  const name = seed.hybrid ? seed.hybrid.label[locale] : a.label[locale];
  const forms = [seed.lead, ...seed.alsoFormats].filter((f): f is NonNullable<typeof f> => !!f).map((f) => FORMAT_TEXT[f]);
  const take = seed.lead
    ? `lead with "${FORMAT_TEXT[seed.lead]}"${forms.length > 1 ? `; also possible: ${forms.slice(1).join(", ")}` : ""}`
    : forms.length
      ? `no stated preference; it can be done ${forms.join(", ")}`
      : "no stated preference";
  const options = research?.options.length
    ? research.options.map((o) => `    - ${o.name}${o.city ? ` (${o.city})` : ""}: ${o.note}${o.url ? ` — ${o.url}` : ""}`).join("\n")
    : "    none verified: keep this idea's location null and its steps generic (Google Maps, Meetup, an exact search)";
  return [
    `Idea ${index + 1} — ${seed.direction === "wildcard" ? "WILDCARD (the separate wildcard slot)" : `door: ${seed.door}`}`,
    `  Activity: ${name}`,
    `  Why it was chosen: ${why(seed, locale)}`,
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

interface RawBook {
  profile_summary?: unknown;
  must_haves?: unknown;
  preferences?: unknown;
  ideas?: unknown;
  wildcard?: unknown;
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

function buildEntry(raw: unknown, seed: Seed): IdeaBookEntry {
  const e = (raw ?? {}) as Record<string, unknown>;
  const a = getActivity(seed.activityId)!;
  return {
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
    scores: scoresForSeed(seed, a),
    activity_id: a.id,
    chain: seed.chain,
  };
}

export interface SeedPipelineReport {
  seeds: Seed[];
  notes: string[];
  research: { cached: number; searched: number; failed: number };
  issues: string[];
}

export async function generateIdeaBookFromSeeds(
  intake: IntakeAnswers,
  locale: Locale,
  characterProfile: CharacterProfile,
  opts: { sessionId?: string; history?: readonly string[] } = {},
): Promise<{ book: GeneratedIdeaBook; report: SeedPipelineReport }> {
  // 1. Select the seeds.
  const engine: EngineResult = runEngine(
    engineInputFromIntake(intake, { seed: opts.sessionId ?? `${Date.now()}`, history: opts.history }),
  );
  const seeds = engine.seeds;
  if (seeds.length < 6) throw new Error("The selection engine could not find enough activities for this profile.");

  // 2. Research, grouped and cached (once, outside the retry loop below).
  const research = await researchSeeds({
    activityIds: seeds.map((s) => s.activityId),
    location: intake.location,
    searchDistance: intake.searchDistance,
    locale,
  });

  // 3. Write the ideas (one retry on a malformed answer, without repeating the research).
  const language = languageLabel(locale);
  const system = SYSTEM_PROMPT.replaceAll("{{LANGUAGE}}", language);
  const user = `${formatProfile(intake, characterProfile)}

The seven ideas to write (in this order; Idea ${seeds.length} is the wildcard):

${seeds.map((s, i) => seedBlock(s, i, research.byActivity.get(s.activityId), locale)).join("\n\n")}

Call the create_idea_book tool exactly once: ${seeds.length - 1} entries in "ideas" (Ideas 1-${seeds.length - 1}, same order) plus the wildcard entry for Idea ${seeds.length}.`;

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
      if (!Array.isArray(candidate.ideas) || candidate.ideas.length !== seeds.length - 1 || !candidate.wildcard) {
        throw new Error("Claude did not return the expected number of ideas. Please try again.");
      }
      raw = candidate;
    } catch (err) {
      lastError = err;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  if (!raw) throw lastError ?? new Error("Idea generation failed.");

  // 4. Assemble and check.
  const allHosts = new Set<string>();
  for (const r of research.byActivity.values()) for (const o of r.options) if (o.url) allHosts.add(hostOf(o.url));
  const issues: string[] = [];
  const regular = seeds.filter((s) => s.direction !== "wildcard");
  const wild = seeds.find((s) => s.direction === "wildcard") ?? seeds[seeds.length - 1];
  const ideas = (raw.ideas as unknown[]).map((r, i) => {
    const seed = regular[i];
    const checked = checkEntry(buildEntry(r, seed), research.byActivity.get(seed.activityId)?.options ?? [], allHosts);
    issues.push(...checked.issues.map((x) => `idea${i + 1}:${x}`));
    return checked.entry;
  });
  const wildChecked = checkEntry(buildEntry(raw.wildcard, wild), research.byActivity.get(wild.activityId)?.options ?? [], allHosts);
  issues.push(...wildChecked.issues.map((x) => `wildcard:${x}`));
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

  const report: SeedPipelineReport = { seeds, notes: engine.notes, research: research.stats, issues };
  console.log(
    `WINDOW: seed pipeline: ${seeds.map((s) => `${s.direction}:${s.activityId}`).join(", ")} | issues: ${issues.length ? issues.join("; ") : "none"}`,
  );
  return { book, report };
}
