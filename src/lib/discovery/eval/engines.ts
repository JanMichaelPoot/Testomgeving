import { defaultEngineLibrary } from "@/lib/discovery/engine";
import { selectSeeds, type EngineLibrary } from "@/lib/discovery/engine/select";
import type { EngineInput, EngineResult } from "@/lib/discovery/engine/types";

// The engines the harness can compare.
//  - "current": the pipeline as it ships (KNOWLEDGE_ENGINE_V2 off).
//  - "v2": the knowledge engine of stage B so far (WINDOW_Bouwopdracht_Kennisengine.md). At this point it is the
//    same selection engine with KNOWLEDGE_ENGINE_V2 switched on for the writing and the PDF (B5: activity-specific
//    fill lines, honest origin wording, visible chain). Its seeds are therefore identical to "current" (a test
//    pins that); the difference only shows in a --full run. When B2-B4 change the selection, only `select` here
//    changes, and the same-seeds test is the thing that is meant to start failing.

export const ENGINE_NAMES = ["current", "v2"] as const;
export type EngineName = (typeof ENGINE_NAMES)[number];

export interface EvalEngine {
  name: EngineName;
  library: EngineLibrary;
  select(input: EngineInput): EngineResult;
  /** Whether a --full run writes and renders with KNOWLEDGE_ENGINE_V2 on. */
  knowledgeV2: boolean;
}

export class EngineNotAvailableError extends Error {}

export function getEngine(name: string): EvalEngine {
  if (name === "current" || name === "v2") {
    const library = defaultEngineLibrary();
    return { name, library, select: (input) => selectSeeds(input, library), knowledgeV2: name === "v2" };
  }
  throw new EngineNotAvailableError(`Unknown engine "${name}"; choose one of ${ENGINE_NAMES.join(", ")}.`);
}
