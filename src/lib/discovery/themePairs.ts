import pairsJson from "@/lib/discovery/themePairs.json";

// A4 (docs/plan-activiteitenselectie.md): hand-made verdicts for pairs of chosen themes. The tag arithmetic that says "this activity fits both
// themes" is right most of the time and wrong in a few well-known ways (boomklimmen as "nature and technology", a reptile house as "animals and
// mystery"). themePairs.json holds, per pair, the activities that really are both ("good": preferred whatever the tags say) and the ones the tags
// wrongly put there ("bad": never the combination of that pair). One module for everyone who asks: the selection (engine/select.ts), page 2
// (twoPages.ts) and the book's "because you chose X and Y" line (associations.ts), so a combination means the same everywhere. Pure, client-safe.

interface PairTable {
  pairs: Record<string, { good: string[]; bad: string[] }>;
}
const TABLE = pairsJson as unknown as PairTable;

export interface PairVerdict {
  good: ReadonlySet<string>;
  bad: ReadonlySet<string>;
}

const VERDICTS = new Map<string, PairVerdict>(Object.entries(TABLE.pairs).map(([key, v]) => [key, { good: new Set(v.good), bad: new Set(v.bad) }]));

/** The value of a hand-made "good" combination: strong, as if the activity fitted both themes at three quarters of the best activity of each. */
export const CURATED_COMBO_VALUE = 0.75;

/** The floor for a combination that is only the tag arithmetic (a pair nobody made a list for, or a list that has run out): stricter than a curated one needs. */
export const COMBO_FLOOR_UNCURATED = 0.6;

const bare = (themeId: string) => themeId.replace(/^theme-/, "");

/** "natuur+techniek": the two theme ids, with or without their "theme-" prefix, in alphabetical order. */
export function pairKey(a: string, b: string): string {
  return [bare(a), bare(b)].sort().join("+");
}

/** What is known about a pair of themes, or undefined when nobody made a list for it. */
export function pairVerdict(a: string, b: string): PairVerdict | undefined {
  return VERDICTS.get(pairKey(a, b));
}

/** Every pair that has a hand-made list (for the tests and the report). */
export const CURATED_PAIR_KEYS: readonly string[] = [...VERDICTS.keys()];
