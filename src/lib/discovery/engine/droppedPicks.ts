import type { Activity, SocialFormat } from "@/lib/discovery/types";
import { inSeason } from "@/lib/discovery/season";
import type { ResolvedConstraints } from "@/lib/discovery/engine/types";

// In the two-page intake the person chooses concrete activities (page 2) BEFORE the screen with budget, time and place. A hard
// limit given there can rule a chosen activity out. Dropping it silently would break the promise "you chose X", so the profile
// screen names it and says why, and the person can change the limit or the choice. This is the same rule as passesConstraints
// (a test keeps the two in step), only it says which limit.

export type DroppedReason = "season" | "budget" | "effort" | "supervised" | "setting" | "format" | "groups";

const GROUP_ONLY: readonly SocialFormat[] = ["small_group", "large_group"];

/**
 * The first hard limit an activity breaks, or null when it passes. `explicitPick` mirrors EngineInput.explicitPicks: a chosen
 * activity that needs supervision is not ruled out by the "predictable" dial.
 */
export function whyNot(a: Activity, c: ResolvedConstraints, opts: { explicitPick?: boolean } = {}): DroppedReason | null {
  if (!inSeason(a, c.month)) return "season";
  if (a.cost === null) {
    if (c.strictFreeCost && c.costCap === 0) return "budget";
  } else if (a.cost > c.costCap) return "budget";
  if (a.intensity !== null && a.intensity > c.intensityCap) return "effort";
  if (a.safety.tier === 2 && c.hideSupervised && !opts.explicitPick) return "supervised";
  if (c.setting && a.setting !== null && a.setting !== "both" && a.setting !== c.setting) return "setting";
  if (a.formats !== null) {
    if (c.formats && !a.formats.some((f) => c.formats!.includes(f))) return "format";
    if (c.noGroups && a.formats.every((f) => GROUP_ONLY.includes(f))) return "groups";
  }
  return null;
}

export interface DroppedPick {
  activityId: string;
  reason: DroppedReason;
}

/** Which of the chosen activities the limits rule out, in the order they were chosen, each with the first limit it breaks. */
export function explainDroppedPicks(picks: readonly Activity[], constraints: ResolvedConstraints): DroppedPick[] {
  return picks.flatMap((a) => {
    const reason = whyNot(a, constraints, { explicitPick: true });
    return reason ? [{ activityId: a.id, reason }] : [];
  });
}
