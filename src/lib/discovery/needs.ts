import type { UnfitFlag } from "@/lib/discovery/suitability";

// The needs the start page chips can state, as the browser reads them (parseMustHaves in engine/constraints.ts). Small and client-safe:
// the lists behind them stay on the server (suitability.ts), which sends each activity's `unfit` flags to page 2.

export interface Needs {
  youngKids?: boolean;
  wheelchair?: boolean;
  calmPace?: boolean;
  noAlcohol?: boolean;
  quiet?: boolean;
  meetPeople?: boolean;
  /** "With one other person" and "with a group": the forms of taking part they asked for (union). */
  withOne?: boolean;
  withGroup?: boolean;
}

/** Whether an activity with these `unfit` flags must stay off page 2 for these needs. */
export function hiddenByNeeds(unfit: readonly UnfitFlag[] | undefined, n: Needs): boolean {
  if (!unfit || unfit.length === 0) return false;
  const has = (f: UnfitFlag) => unfit.includes(f);
  if (n.youngKids && has("young_kids")) return true;
  if (n.wheelchair && has("wheelchair")) return true;
  if (n.calmPace && has("calm")) return true;
  if (n.noAlcohol && has("alcohol")) return true;
  if (n.quiet && has("quiet")) return true;
  if (n.meetPeople && has("no_meet")) return true;
  // The forms are a union: only hidden when it fits none of the forms they asked for.
  if (n.withOne || n.withGroup) {
    const fitsOne = !!n.withOne && !has("no_duo");
    const fitsGroup = !!n.withGroup && !has("no_group");
    if (!fitsOne && !fitsGroup) return true;
  }
  return false;
}
