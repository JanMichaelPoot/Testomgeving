// What one book has cost so far, and whether the next OPTIONAL research round still fits (Jan, 14 Nov 2026: a book may cost at most USD 0.40).
//
// The model calls of a book are priced from their own `usage` (the same prices as scripts/persona-books.ts and scripts/measure-generation.ts),
// so the ledger and the cost meters agree. Two parts of a book are not optional: the first search (the standard pass and the pass for the
// person's own choices) and the writing (the ideas and their layers). The rounds in between are: the broad pass for what the first search found nothing
// for, the online providers, and the replacement rounds. Before each of those the pipeline asks `canAfford(kind)`: what has been spent, plus
// what a round of that kind usually costs (or what the last one of that kind did cost, when that was more), plus the reserve for the writing,
// has to stay under the cap. When it does not, the round is skipped and said so (the book still gets an honest line for an idea without an
// option, and ideas that earlier rounds found options for are swapped in), instead of spending more.
//
// Cached answers cost nothing and so never show up here. Pure: no network, no clock.

import type { BookCostMeta } from "@/types/database";

export type RoundKind = "standard" | "own" | "broad" | "online";
/** "qa": the quality gate (the grammar pass, and the rewrite of ideas that failed a check). It is paid after the cap decisions are made, so it never blocks a round. */
export type SpendKind = RoundKind | "writing" | "qa" | "other";

export interface UsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

/** USD per million tokens (input, output). Haiku does the research and the QA, Sonnet the writing. */
const MODEL_PRICE: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};
const SEARCH_USD = 0.01;

export function priceUsage(usage: UsageLike | null | undefined, model = "claude-sonnet-5"): number {
  if (!usage) return 0;
  const p = MODEL_PRICE[model] ?? MODEL_PRICE["claude-sonnet-5"];
  return (
    ((usage.input_tokens ?? 0) / 1e6) * p.input +
    ((usage.output_tokens ?? 0) / 1e6) * p.output +
    ((usage.cache_creation_input_tokens ?? 0) / 1e6) * p.input * 1.25 +
    ((usage.cache_read_input_tokens ?? 0) / 1e6) * p.input * 0.1 +
    (usage.server_tool_use?.web_search_requests ?? 0) * SEARCH_USD
  );
}

/** What a round of each kind usually costs, from the measurements of 14 Nov 2026 (standard 0.06-0.08, own 0.11-0.14, broad 0.06-0.13, online 0.04). */
export const DEFAULT_ROUND_USD: Record<RoundKind, number> = { standard: 0.075, own: 0.12, broad: 0.09, online: 0.05 };
/** The writing of a book (the ideas 0.043-0.047, the layers 0.051-0.059) and the quality repairs, measured: it has to fit whatever the research does. */
export const WRITING_RESERVE_USD = 0.11;
export const DEFAULT_BOOK_CAP_USD = 0.4;

/** The cap in USD: WINDOW_BOOK_COST_CAP, default 0.40; "0" or "off" switches the limit off (null). */
export function bookCostCap(env: Record<string, string | undefined> = process.env): number | null {
  const raw = env.WINDOW_BOOK_COST_CAP?.trim().toLowerCase();
  if (!raw) return DEFAULT_BOOK_CAP_USD;
  if (raw === "off" || raw === "0") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BOOK_CAP_USD;
}

const roundUsd = (n: number) => Math.round(n * 10000) / 10000;

/**
 * What one book cost, in the shape that is kept with it (progress_meta.cost, see BookCostMeta): the ledger's own numbers plus what it cannot
 * know itself, the Google lookups and the research counts. Rounded to a hundredth of a cent so the stored numbers stay readable.
 */
export function bookCostMeta(
  ledger: CostLedger,
  extra: { placesLookups?: number; research?: { cached: number; searched: number; failed: number }; quiet?: { known: number; inBook: number }; pipeline?: "classic" | "classic_after_failure"; placesListPriceUsd?: number } = {},
): BookCostMeta {
  const meta: BookCostMeta = {
    usd: roundUsd(ledger.spentUsd()),
    capUsd: ledger.capUsd,
    skipped: ledger.skipped(),
    breakdown: ledger.breakdown(),
  };
  if (extra.placesLookups !== undefined) {
    meta.placesLookups = extra.placesLookups;
    meta.placesListUsd = roundUsd(extra.placesLookups * (extra.placesListPriceUsd ?? 0.035));
  }
  if (extra.research) meta.research = { cached: extra.research.cached, searched: extra.research.searched, failed: extra.research.failed };
  if (extra.quiet) meta.quiet = { known: extra.quiet.known, inBook: extra.quiet.inBook };
  if (extra.pipeline) meta.pipeline = extra.pipeline;
  return meta;
}

export interface CostLedger {
  /** The cap in USD, or null when the limit is off. */
  readonly capUsd: number | null;
  /** Records one model call; returns what it cost. */
  add(kind: SpendKind, usage: UsageLike | null | undefined, model?: string): number;
  spentUsd(): number;
  breakdown(): Record<string, number>;
  /** What the next round of this kind is expected to cost. */
  estimate(kind: RoundKind): number;
  /** Whether a round of this kind fits under the cap, with the writing still to be paid. Always true without a cap. */
  canAfford(kind: RoundKind): boolean;
  /** Notes that a round was skipped for cost. */
  skip(kind: RoundKind): void;
  skipped(): string[];
}

export function createCostLedger(opts: { capUsd?: number | null; writingReserveUsd?: number } = {}): CostLedger {
  const capUsd = opts.capUsd === undefined ? bookCostCap() : opts.capUsd;
  const reserve = opts.writingReserveUsd ?? WRITING_RESERVE_USD;
  const spent: Record<string, number> = {};
  const last: Partial<Record<RoundKind, number>> = {};
  const skipped: string[] = [];
  const total = () => Object.values(spent).reduce((a, b) => a + b, 0);
  const estimate = (kind: RoundKind) => Math.max(DEFAULT_ROUND_USD[kind], last[kind] ?? 0);
  return {
    capUsd,
    add(kind, usage, model) {
      const cost = priceUsage(usage, model);
      spent[kind] = (spent[kind] ?? 0) + cost;
      if (kind !== "writing" && kind !== "qa" && kind !== "other") last[kind] = cost;
      return cost;
    },
    spentUsd: total,
    breakdown: () => Object.fromEntries(Object.entries(spent).map(([k, v]) => [k, Math.round(v * 1000) / 1000])),
    estimate,
    canAfford: (kind) => capUsd === null || total() + estimate(kind) + reserve <= capUsd,
    skip(kind) {
      if (!skipped.includes(kind)) skipped.push(kind);
    },
    skipped: () => [...skipped],
  };
}
