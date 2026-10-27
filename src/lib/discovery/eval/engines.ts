import { defaultEngineLibrary } from "@/lib/discovery/engine";
import { selectSeeds, type EngineLibrary } from "@/lib/discovery/engine/select";
import { WEIGHTS_CURRENT, WEIGHTS_V2, type Weights } from "@/lib/discovery/engine/weights";
import type { EngineInput, EngineResult } from "@/lib/discovery/engine/types";

// The engines the harness can compare.
//  - "current": the pipeline as it ships (KNOWLEDGE_ENGINE_V2 off).
//  - "v2": the knowledge engine of stage B (WINDOW_Bouwopdracht_Kennisengine.md): KNOWLEDGE_ENGINE_V2 switched on for
//    the writing and the PDF (B5: activity-specific fill lines, honest origin wording, visible chain) and, since B4,
//    the stepwise ranking of WEIGHTS_V2 (diversity step, unknown cost never passes a free budget, measured fit for
//    "if you only pick one"). Its seeds therefore differ from "current"; the hard limits must not.

export const ENGINE_NAMES = ["current", "v2"] as const;
export type EngineName = (typeof ENGINE_NAMES)[number];

export interface EvalEngine {
  name: EngineName;
  library: EngineLibrary;
  select(input: EngineInput): EngineResult;
  /** Whether a --full run writes and renders with KNOWLEDGE_ENGINE_V2 on. */
  knowledgeV2: boolean;
  /** The ranking weights this engine selects with (weights.ts). */
  weights: Weights;
}

export class EngineNotAvailableError extends Error {}

export function getEngine(name: string): EvalEngine {
  if (name === "current" || name === "v2") {
    const library = defaultEngineLibrary();
    const weights = name === "v2" ? WEIGHTS_V2 : WEIGHTS_CURRENT;
    return { name, library, select: (input) => selectSeeds(input, library, { weights }), knowledgeV2: name === "v2", weights };
  }
  throw new EngineNotAvailableError(`Unknown engine "${name}"; choose one of ${ENGINE_NAMES.join(", ")}.`);
}
