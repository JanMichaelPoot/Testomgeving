// Feature flags of the knowledge-engine work (WINDOW_Bouwopdracht_Kennisengine.md, rule 10). They are off by default and
// switched on only after a positive comparison. Since the improvement plan (docs/verbeterplan-windowinto.md, D9) there
// are two, because the two halves of the old KNOWLEDGE_ENGINE_V2 were measured differently:
//
//   KNOWLEDGE_RANKING_V2  B4: the stepwise ranking (weights WEIGHTS_V2) and the measured `fit`/`reasons` per idea.
//                         Measured well (docs/eval/2026-10-28-b4-ranking.md): fewer variations of one thing, no unknown
//                         costs for a free budget.
//   KNOWLEDGE_WRITING_V2  B5: activity-specific fill lines, honest origin wording, the visible chain. The blind comparison
//                         split 2-2 (Stap 104), so it stays off until a clearer result.
//
//   KNOWLEDGE_ANCHOR_PICKS  Stap 125: the anchor model. Four of the person's own page-2 choices are in the book, two ideas are built
//                         around them, one wildcard. Needs the B4 ranking (it selects with WEIGHTS_ANCHOR, which includes it).
//
// The old KNOWLEDGE_ENGINE_V2 still works as "both on", so an existing deployment behaves as before until it is changed.
//
// Server side only (plain, non-public environment variables). Components that need to know get the result as a prop.

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function isOn(value: string | undefined): boolean {
  if (!value) return false;
  return TRUE_VALUES.has(value.trim().replace(/^["']|["']$/g, "").toLowerCase());
}

/** B4 on: the stepwise ranking and `fit`/`reasons`. KNOWLEDGE_RANKING_V2, or the legacy KNOWLEDGE_ENGINE_V2. */
export function knowledgeRankingV2Enabled(
  value: string | undefined = process.env.KNOWLEDGE_RANKING_V2,
  legacy: string | undefined = process.env.KNOWLEDGE_ENGINE_V2,
): boolean {
  return isOn(value) || isOn(legacy);
}

/** B5 on: fill lines, honest origin wording, visible chain. KNOWLEDGE_WRITING_V2, or the legacy KNOWLEDGE_ENGINE_V2. */
export function knowledgeWritingV2Enabled(
  value: string | undefined = process.env.KNOWLEDGE_WRITING_V2,
  legacy: string | undefined = process.env.KNOWLEDGE_ENGINE_V2,
): boolean {
  return isOn(value) || isOn(legacy);
}

/** Whether the legacy flag alone is on (both halves). Kept for the harness and old call sites. */
export function knowledgeEngineV2Enabled(value: string | undefined = process.env.KNOWLEDGE_ENGINE_V2): boolean {
  return isOn(value);
}

/** Stap 125: the anchor model (own picks first). KNOWLEDGE_ANCHOR_PICKS only; the legacy flag does not switch it on. */
export function knowledgeAnchorEnabled(value: string | undefined = process.env.KNOWLEDGE_ANCHOR_PICKS): boolean {
  return isOn(value);
}
