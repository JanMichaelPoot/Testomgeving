// The short personal reading on the results page ("Wat jouw keuzes ons vertellen"): an opening, a red thread and a direction. A fixed
// version is always built from the choices (profileStory.ts); this module is the optional model-written version of the same three
// blocks. It exists to be careful, not clever: the model gets nothing but the facts below (the images and activities the person chose, the
// tags read from them, the leanings), it is told not to invent anything about the person, and what comes back is checked before it is
// shown (length, no numbers or addresses, none of the banned phrases, and it must actually speak about what was chosen). Anything
// that fails the checks, any error and any limit leaves the fixed text in place.
//
// Pure and free of server imports: the prompts, the facts' shape, the checks, a rate limiter and a small cache (all testable).

export type InterpretAudience = "self" | "named" | "other" | "group";

export interface InterpretFacts {
  locale: "nl" | "en";
  audience: InterpretAudience;
  /** The first name, only for "named". */
  name: string;
  images: { label: string; tags: string[] }[];
  /** The activities the person chose themselves on page 2. */
  activities: string[];
  /** Plain-word leanings read from the images and sliders ("prefers being outdoors"). */
  leans: string[];
  /** Tags the person added under "adjust". */
  corrections: string[];
}

export interface InterpretBlocks {
  opening: string;
  thread: string;
  direction: string;
}

export const INTERPRET_LIMITS = {
  opening: { min: 24, max: 190 },
  thread: { min: 40, max: 340 },
  direction: { min: 30, max: 300 },
} as const;

// --- the prompt ----------------------------------------------------------------------------------------

const ADDRESS: Record<InterpretAudience, string> = {
  self: 'Speak to the person directly ("je" in Dutch, "you" in English).',
  named: 'Write about the person by their first name, in the third person ("{name}"), never "je" or "you".',
  other: 'Write about "the person" without using their name, in the third person, never "je" or "you". Prefer a sentence without a subject ("Er is veel oog voor...", "There is a real pull towards...") over repeating "the person".',
  group: 'Speak to the group ("jullie" in Dutch, "you all" in English).',
};

export function interpretSystemPrompt(facts: Pick<InterpretFacts, "locale" | "audience" | "name">): string {
  const language = facts.locale === "nl" ? "Dutch" : "English";
  return `You write a short, warm reading of what a person's choices say, for a discovery app (WindowInto). Write in ${language}.

You are given ONLY facts: the images they picked, the tags read from those images, the activities they picked, and how their picks lean. Rules:
- Use only these facts. Never invent a trait, an age, a job, a feeling, a history, a motive or a plan. Never say what kind of person they "are"; say what their choices point towards.
- Do not diagnose, judge or label (no personality types). Do not praise. Do not give advice.
- Every sentence must be traceable to a fact given: name the images or activities (or the idea behind them) that carry it. Mention an activity or place that is not listed: never.
- No numbers, no web addresses, no prices, no names of places or businesses.
- Never write "Wat ons opviel" / "What caught our eye", never mention AI, an algorithm or "data".
- ${ADDRESS[facts.audience].replace("{name}", facts.name || "the person")}
- Plain, correct ${language} in short sentences with concrete words. No dashes (no "—" or "–"), no semicolons, no abstract nouns piled up, no invented compounds. Read it back once before you answer and fix any slip of grammar or spelling.
- Calm, specific, a little poetic like a travel magazine, never gushing.

Return three parts through the tool:
- opening: ONE sentence (at most 22 words) that opens the reading, personal and concrete.
- thread: one or two sentences (at most 45 words): the red thread through the choices: what the images and activities have in common.
- direction: one or two sentences (at most 40 words): which direction of discovery this points to, including what might be new to them. Leave out promises about what the book will contain.`;
}

export function interpretUserPrompt(facts: InterpretFacts): string {
  const lines = [
    "Images picked (label: tags read from it):",
    ...facts.images.map((i) => `- ${i.label}${i.tags.length ? `: ${i.tags.join(", ")}` : ""}`),
    facts.activities.length ? `Activities picked: ${facts.activities.join("; ")}` : "Activities picked: none (they asked us to choose)",
    facts.leans.length ? `How the picks lean: ${facts.leans.join("; ")}` : "How the picks lean: no clear lean",
    facts.corrections.length ? `They added these themes themselves: ${facts.corrections.join(", ")}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export const INTERPRET_TOOL = {
  name: "write_reading",
  description: "The three short parts of the reading.",
  schema: {
    type: "object",
    properties: {
      opening: { type: "string" },
      thread: { type: "string" },
      direction: { type: "string" },
    },
    required: ["opening", "thread", "direction"],
    additionalProperties: false,
  },
} as const;

// --- the checks ----------------------------------------------------------------------------------------

const BANNED = [
  /wat ons opviel/i,
  /what caught our eye/i,
  /\b(ai|a\.i\.|algoritme|algorithm|kunstmatige intelligentie|artificial intelligence|data)\b/i,
  /\b(persoonlijkheidstype|personality type|introvert|extravert|extrovert)\b/i,
  /https?:\/\//i,
  /\bwww\./i,
  /\b[a-z0-9-]+\.(nl|com|org|eu|be)\b/i,
  /[0-9€$]/,
  /[*_#`<>]/,
  /[—–]/,
];

const WORD = /[\p{L}]{5,}/gu;

/** The first five letters of every word of five letters or more: enough to see that a text speaks about a fact, in either language. */
function stems(text: string): Set<string> {
  return new Set((text.toLowerCase().match(WORD) ?? []).map((w) => w.slice(0, 5)));
}

/** Every content word of the facts (labels, tags, activities, themes), as stems. */
export function factStems(facts: InterpretFacts): Set<string> {
  const text = [...facts.images.flatMap((i) => [i.label, ...i.tags]), ...facts.activities, ...facts.corrections].join(" ");
  return stems(text);
}

function sentenceCount(text: string): number {
  return (text.match(/[.!?](\s|$)/g) ?? []).length || 1;
}

/**
 * Accepts the model's answer only when it is plain text of a fitting size, free of the banned things, in the right person, and
 * speaks about at least one thing that was chosen (opening and thread together). Returns the cleaned blocks, or null.
 */
export function validateBlocks(raw: unknown, facts: InterpretFacts): InterpretBlocks | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const clean = (v: unknown): string | null => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : null);
  const blocks = { opening: clean(r.opening), thread: clean(r.thread), direction: clean(r.direction) };
  for (const key of ["opening", "thread", "direction"] as const) {
    const text = blocks[key];
    if (text === null) return null;
    const { min, max } = INTERPRET_LIMITS[key];
    if (text.length < min || text.length > max) return null;
    if (BANNED.some((rx) => rx.test(text))) return null;
    if (sentenceCount(text) > (key === "opening" ? 1 : 3)) return null;
  }
  const all = `${blocks.opening} ${blocks.thread} ${blocks.direction}`;
  // Third person for someone else: a "je"/"you" would address the wrong reader.
  if (facts.audience === "named" || facts.audience === "other") {
    if (facts.locale === "nl" ? /\b(je|jij|jouw|jou)\b/i.test(all) : /\b(you|your|yours)\b/i.test(all)) return null;
  }
  if (facts.audience === "group" && (facts.locale === "nl" ? /\b(je|jij|jouw)\b/i.test(all) : false)) return null;
  // It must be about what was chosen.
  const facted = factStems(facts);
  const spoken = stems(`${blocks.opening} ${blocks.thread}`);
  let overlap = 0;
  for (const s of spoken) if (facted.has(s)) overlap++;
  if (overlap < 1) return null;
  return blocks as InterpretBlocks;
}

// --- cache and limits (per server instance) ------------------------------------------------------------

/** A key that is the same for the same facts, in any order of pick. */
export function factsKey(facts: InterpretFacts): string {
  return JSON.stringify({
    l: facts.locale,
    a: facts.audience,
    n: facts.audience === "named" ? facts.name.toLowerCase() : "",
    i: facts.images.map((x) => x.label).sort(),
    c: [...facts.activities].sort(),
    e: [...facts.leans].sort(),
    k: [...facts.corrections].sort(),
  });
}

/** A small time-limited cache. */
export function createCache<T>(max = 400, ttlMs = 24 * 60 * 60 * 1000) {
  const map = new Map<string, { value: T; at: number }>();
  return {
    get(key: string, now = Date.now()): T | undefined {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (now - hit.at > ttlMs) {
        map.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key: string, value: T, now = Date.now()) {
      if (map.size >= max) map.delete(map.keys().next().value as string);
      map.set(key, { value, at: now });
    },
    get size() {
      return map.size;
    },
  };
}

/** "At most `max` per `windowMs`" per key, remembered in this process only. */
export function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    take(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
      }
      return true;
    },
  };
}
