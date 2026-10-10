import type { ProgressStage } from "@/types/database";

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
