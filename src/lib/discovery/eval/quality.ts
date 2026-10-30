import type { GeneratedIdeaBook } from "@/lib/claude/ideaBookTypes";
import type { Finding } from "@/lib/discovery/eval/checks";
import type { EvalRunInfo } from "@/lib/discovery/eval/results";

// Fase 3: the release gate of the written book. What a reader of the finished PDF must never see (the machinery talking, the
// same sentence on two ideas) fails the gate; everything else is counted and reported so a change can be compared with the
// last run. Pure: it works on the findings of checkBook and on the books themselves.

export interface QualitySummary {
  books: number;
  ideas: number;
  /** Findings per quality code, over all books. */
  counts: Record<"exposed_reasoning" | "repeated_sentence" | "season" | "type_setting" | "time_chip" | "related" | "coverage_time" | "coverage_budget", number>;
  /** Ideas (wildcard included) that name at least one real place found in the research, and that place has a website. */
  ideasWithPlace: number;
  ideasWithPlaceSite: number;
  /** Ideas that need a provider (cost, supervision or rare supply) and still have no place. */
  placeRate: number;
  totalUsd: number;
  avgSeconds: number;
  /** The gate: zero exposed reasoning and zero repeated sentences in every book. */
  releaseGate: { pass: boolean; failures: string[] };
}

const CODES = ["exposed_reasoning", "repeated_sentence", "season", "type_setting", "time_chip", "related", "coverage_time", "coverage_budget"] as const;

export function summariseQuality(books: Record<string, GeneratedIdeaBook>, findings: readonly Finding[], runInfo?: Record<string, EvalRunInfo>): QualitySummary {
  const counts = Object.fromEntries(CODES.map((c) => [c, 0])) as QualitySummary["counts"];
  for (const f of findings) {
    const code = f.check.startsWith("quality:") ? f.check.slice("quality:".length) : "";
    if ((CODES as readonly string[]).includes(code)) counts[code as (typeof CODES)[number]] += 1;
  }
  const all = Object.values(books).flatMap((b) => [...b.ideas, b.wildcard]);
  const ideasWithPlace = all.filter((e) => (e.places?.length ?? 0) > 0).length;
  const ideasWithPlaceSite = all.filter((e) => (e.places ?? []).some((p) => !!p.url)).length;
  const runs = Object.values(runInfo ?? {});
  const failures: string[] = [];
  if (counts.exposed_reasoning > 0) failures.push(`${counts.exposed_reasoning} x exposed reasoning`);
  if (counts.repeated_sentence > 0) failures.push(`${counts.repeated_sentence} x repeated sentence`);
  return {
    books: Object.keys(books).length,
    ideas: all.length,
    counts,
    ideasWithPlace,
    ideasWithPlaceSite,
    placeRate: all.length === 0 ? 0 : ideasWithPlace / all.length,
    totalUsd: runs.reduce((s, r) => s + r.usd, 0),
    avgSeconds: runs.length === 0 ? 0 : runs.reduce((s, r) => s + r.seconds, 0) / runs.length,
    releaseGate: { pass: failures.length === 0, failures },
  };
}
