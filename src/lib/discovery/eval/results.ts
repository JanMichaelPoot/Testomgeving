import type { GeneratedIdeaBook } from "@/lib/claude/ideaBookTypes";
import { getActivity } from "@/lib/discovery/library";
import type { Run } from "@/lib/discovery/engine/evaluate";
import type { EngineLibrary } from "@/lib/discovery/engine/select";
import { checkBook, checkSeedRun, type Finding } from "@/lib/discovery/eval/checks";
import { computeMetrics, type Metrics } from "@/lib/discovery/eval/metrics";
import type { EngineName } from "@/lib/discovery/eval/engines";

// What one harness run leaves behind: the metrics, the checks and, per profile, the seven ideas
// (and, for a `--full` run, the written book). The same file feeds the Markdown report and the blind A/B sheet.

export interface EvalSeedRow {
  activityId: string;
  label: { nl: string; en: string };
  door: string;
  direction: string;
  /** The path from a "pick" to this idea, as activity labels (nl). */
  chain: string[];
  lead: string | null;
  verify: string[];
}

export interface EvalBookLite {
  profile_summary: string;
  ideas: { door: string; title: string; intro: string; why_it_fits: string; first_action: string; activity_id?: string }[];
}

export interface EvalProfileResult {
  id: string;
  title: string;
  kind: string;
  edge: boolean;
  /** Who this visitor is, in a few lines (shown to the raters of the blind sheet). */
  brief: string[];
  /** Notes of the engine ("direction_relaxed:stretch", ...). */
  notes: string[];
  seeds: EvalSeedRow[];
  book?: EvalBookLite;
  findings: Finding[];
}

export interface EvalResultFile {
  engine: EngineName;
  mode: "seeds-only" | "full";
  /** Where the profiles came from: "scripts/eval/profiles (20)" or "synthetic cards n=500 seed=ke-1". */
  source: string;
  generatedAt: string;
  metrics: Metrics;
  profiles: EvalProfileResult[];
}

export function liteBook(book: GeneratedIdeaBook): EvalBookLite {
  const all = [...book.ideas, book.wildcard];
  return {
    profile_summary: book.profile_summary,
    ideas: all.map((e) => ({ door: e.door, title: e.title, intro: e.intro, why_it_fits: e.why_it_fits, first_action: e.first_action, activity_id: e.activity_id })),
  };
}

export function buildResults(args: {
  engine: EngineName;
  mode: EvalResultFile["mode"];
  source: string;
  runs: readonly Run[];
  lib: EngineLibrary;
  titles?: Record<string, { title: string; kind: string; edge: boolean; brief?: string[] }>;
  books?: Record<string, GeneratedIdeaBook>;
  generatedAt?: string;
}): EvalResultFile {
  const { runs, lib } = args;
  const profiles: EvalProfileResult[] = runs.map((run) => {
    const meta = args.titles?.[run.profile.id];
    const book = args.books?.[run.profile.id];
    return {
      id: run.profile.id,
      title: meta?.title ?? run.profile.archetype,
      kind: meta?.kind ?? "synthetic",
      edge: meta?.edge ?? false,
      brief: meta?.brief ?? [],
      notes: run.result.notes,
      seeds: run.result.seeds.map((s) => {
        const a = getActivity(s.activityId);
        return {
          activityId: s.activityId,
          label: { nl: a?.label.nl ?? s.activityId, en: a?.label.en ?? s.activityId },
          door: s.door,
          direction: s.direction,
          chain: s.chain.map((id) => getActivity(id)?.label.nl ?? id),
          lead: s.lead,
          verify: s.verify,
        };
      }),
      ...(book ? { book: liteBook(book) } : {}),
      findings: [...checkSeedRun(run, lib), ...(book ? checkBook(book, run.profile.id) : [])],
    };
  });
  return {
    engine: args.engine,
    mode: args.mode,
    source: args.source,
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    metrics: computeMetrics(runs, lib),
    profiles,
  };
}
