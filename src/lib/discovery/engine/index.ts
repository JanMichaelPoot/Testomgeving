import type { IntakeAnswers } from "@/app/intake/actions";
import { HYBRIDS, TAGS, getActivities } from "@/lib/discovery/library";
import { DISCOVERY_MIN_STATUS } from "@/lib/discovery/cardLibrary";
import { selectSeeds, type EngineLibrary, type SelectOptions } from "@/lib/discovery/engine/select";
import { relatedActivitiesIn } from "@/lib/discovery/engine/related";
import type { Activity } from "@/lib/discovery/types";
import type { ResolvedConstraints } from "@/lib/discovery/engine/types";
import type { EngineInput, EngineResult } from "@/lib/discovery/engine/types";

export { selectSeeds, challenge, agePenalty } from "@/lib/discovery/engine/select";
export type { EngineLibrary, SelectOptions } from "@/lib/discovery/engine/select";
export { WEIGHTS_CURRENT, WEIGHTS_V2, type Weights } from "@/lib/discovery/engine/weights";
export { resolveConstraints, passesConstraints, parseMustHaves } from "@/lib/discovery/engine/constraints";
export { buildGraph, BRIDGE_MIN } from "@/lib/discovery/engine/graph";
export { relatedActivitiesIn } from "@/lib/discovery/engine/related";
export type * from "@/lib/discovery/engine/types";

let cached: EngineLibrary | null = null;

/** The shipped library, resolved once (the graph is cached against this array). */
export function defaultEngineLibrary(): EngineLibrary {
  cached ??= { activities: getActivities({ minStatus: DISCOVERY_MIN_STATUS }), tags: TAGS, hybrids: HYBRIDS };
  return cached;
}

/** Engine input from what the intake stored. */
export function engineInputFromIntake(
  intake: Pick<
    IntakeAnswers,
    "practicalToWild" | "budget" | "effort" | "timeAvailable" | "ageCategory" | "mustHaves"
  > &
    Partial<Pick<IntakeAnswers, "interests" | "interestDomains" | "socialFormats" | "surpriseMe" | "intakeFlow">>,
  extra: { seed: string; history?: readonly string[]; month?: number; exclude?: readonly string[] },
): EngineInput {
  return {
    interests: intake.interests ?? [],
    interestDomains: intake.interestDomains ?? [],
    surpriseMe: intake.surpriseMe,
    socialFormats: intake.socialFormats ?? [],
    practicalToWild: intake.practicalToWild,
    budget: intake.budget,
    effort: intake.effort,
    timeAvailable: intake.timeAvailable,
    ageCategory: intake.ageCategory,
    mustHaves: intake.mustHaves,
    history: extra.history,
    seed: extra.seed,
    month: extra.month,
    exclude: extra.exclude,
    ...(intake.intakeFlow === "images2" ? { explicitPicks: true } : {}),
  };
}

/** Convenience: run the engine on the shipped library. */
export function runEngine(input: EngineInput, opts?: SelectOptions): EngineResult {
  return selectSeeds(input, defaultEngineLibrary(), opts);
}

/** Up to three other activities in the same direction as `activityId` (R2.3), on the shipped library. */
export function relatedActivities(
  activityId: string,
  constraints: ResolvedConstraints,
  excludeIds: ReadonlySet<string> | readonly string[] = [],
  max = 3,
): Activity[] {
  return relatedActivitiesIn(defaultEngineLibrary(), activityId, constraints, excludeIds, max);
}
