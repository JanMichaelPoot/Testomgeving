import type { ProgressMeta, ProgressStage } from "@/types/database";

// "Het venster" fase 0: the waiting screen shows the real step the generation has reached
// (window_plans.progress_stage, written by src/app/plan/data.ts). Five phases on screen map
// onto four stages: the first two happen together when the selection engine runs.
//   null        -> 0  "translating your choices"
//   selected    -> 2  "finding places near you"   (0 and 1 done)
//   researched  -> 3  "writing your ideas"
//   written     -> 4  "laying out your book"
//   rendered    -> 5  everything done (the page navigates to the book right after)
export function activePhaseFor(stage: ProgressStage | null | undefined): number {
  switch (stage) {
    case "selected":
      return 2;
    case "researched":
      return 3;
    case "written":
      return 4;
    case "rendered":
      return 5;
    default:
      return 0;
  }
}

// --- what the waiting screen says -------------------------------------------------------------

/** No sign of life for this long and the screen says it takes longer than usual. Equal to the
 *  function ceiling in plan/page.tsx (maxDuration): a generation still open after that has most
 *  likely been stopped by the platform, and the row is marked failed shortly after (150 s). */
export const STALL_AFTER_MS = 120_000;

export function isStalled(elapsedMs: number): boolean {
  return elapsedMs >= STALL_AFTER_MS;
}

/** Milliseconds since `startedAtIso` (the pending row's own timestamp), null when unknown. */
export function elapsedSince(startedAtIso: string | null | undefined, nowMs: number): number | null {
  if (!startedAtIso) return null;
  const started = Date.parse(startedAtIso);
  if (Number.isNaN(started)) return null;
  return Math.max(0, nowMs - started);
}

/** The numbers recorded so far plus the ones of a new step: a step adds to what is known, it
 *  never wipes it (the first real run lost "7 doors" when "10 places" was written). */
export function mergeProgressMeta(previous: ProgressMeta | null | undefined, next: ProgressMeta | null | undefined): ProgressMeta {
  return { ...(previous ?? {}), ...(next ?? {}) };
}

/** Same, measured now (kept apart so server components need no impure call of their own). */
export function elapsedSinceNow(startedAtIso: string | null | undefined): number | null {
  return elapsedSince(startedAtIso, Date.now());
}

export interface PhaseCopy {
  /** Present tense: the step that is running or still to come. */
  phases: string[];
  /** Past tense: the step is done. */
  phasesDone: string[];
  /** "{n} doors chosen" */
  doorsDone: string;
  /** "{n} places found" */
  placesDone: string;
  /** "{n} places found near {place}" */
  placesDoneNear: string;
}

/**
 * The five lines of the waiting screen. A finished step reads in the past tense, and with the
 * real number when the pipeline recorded one (progress_meta). No number known: the step is shown
 * without one, never with an invented figure.
 */
export function phaseLabels(
  copy: PhaseCopy,
  active: number,
  meta: ProgressMeta | null | undefined,
  place: string | null | undefined,
): string[] {
  const near = place?.trim() || "";
  return copy.phases.map((todo, i) => {
    if (i >= active) return todo;
    if (i === 1 && meta?.ideas && meta.ideas > 0) return copy.doorsDone.replace("{n}", String(meta.ideas));
    if (i === 2 && meta?.places && meta.places > 0) {
      return (near ? copy.placesDoneNear.replace("{place}", near) : copy.placesDone).replace("{n}", String(meta.places));
    }
    return copy.phasesDone[i] ?? todo;
  });
}
