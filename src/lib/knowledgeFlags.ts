// Feature flag of the knowledge-engine work (WINDOW_Bouwopdracht_Kennisengine.md, rule 10): everything that
// B5 adds (activity-specific "fill" lines, honest origin wording, the visible chain) only runs when
// KNOWLEDGE_ENGINE_V2 is switched on. Off by default; it is switched on only after the comparison of B6 is positive.
//
// Server side only (a plain, non-public environment variable). Components that need to know get the result as a prop.

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

/** Whether the V2 behaviour is on. Accepts 1/true/yes/on, in any case, with stray quotes or spaces. */
export function knowledgeEngineV2Enabled(value: string | undefined = process.env.KNOWLEDGE_ENGINE_V2): boolean {
  if (!value) return false;
  return TRUE_VALUES.has(value.trim().replace(/^["']|["']$/g, "").toLowerCase());
}
