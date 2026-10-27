import { defaultEngineLibrary } from "@/lib/discovery/engine";
import { selectSeeds, type EngineLibrary } from "@/lib/discovery/engine/select";
import type { EngineInput, EngineResult } from "@/lib/discovery/engine/types";

// The engines the harness can compare. "current" is the selection engine as it ships. "v2" is the
// knowledge engine of stage B (WINDOW_Bouwopdracht_Kennisengine.md): it does not exist yet, and the
// harness says so instead of quietly falling back to "current" (which would show a flattering 0% difference).

export const ENGINE_NAMES = ["current", "v2"] as const;
export type EngineName = (typeof ENGINE_NAMES)[number];

export interface EvalEngine {
  name: EngineName;
  library: EngineLibrary;
  select(input: EngineInput): EngineResult;
}

export class EngineNotAvailableError extends Error {}

export function getEngine(name: string): EvalEngine {
  if (name === "current") {
    const library = defaultEngineLibrary();
    return { name, library, select: (input) => selectSeeds(input, library) };
  }
  if (name === "v2") throw new EngineNotAvailableError("Engine v2 is not built yet (stage B4/B5); only 'current' can be run.");
  throw new EngineNotAvailableError(`Unknown engine "${name}"; choose one of ${ENGINE_NAMES.join(", ")}.`);
}
