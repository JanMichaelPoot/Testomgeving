import type { Direction } from "@/lib/discovery/engine/types";

// Every number that steers the selection, in one place (knowledge-engine assignment, B4). Nothing here is a
// measurement: they are relative nudges, tuned against the shadow runs (scripts/eval, scripts/discovery-shadow.ts),
// and each one says what it is for so a later change is a decision and not a hunt through select.ts.
//
// Two sets exist:
//   WEIGHTS_CURRENT  exactly what shipped before B4. The default; a test pins the seeds it gives for the 20 fixed
//                    profiles (scripts/eval/baseline/current.json).
//   WEIGHTS_V2       the B4 ranking, used only with KNOWLEDGE_ENGINE_V2 on (and by the harness engine "v2").
// Hard limits (constraints.ts) are never a weight: no score can buy back a violated limit.

export interface Weights {
  // --- variety ---------------------------------------------------------------------------------------
  /** How strongly each direction leans towards the long tail (Graph.rarity). The person's own picks are never touched. */
  rare: Record<"familiar" | "adjacent" | "unexpected" | "stretch" | "wildcard", number>;
  /** Each visitor weighs an activity's rarity a little differently: factor = base + spread * (0..1 from the seed). */
  rareJitter: { base: number; spread: number };
  /** Needs a provider within reach that may not be near: a small penalty, none for the person's own picks. */
  supply: { rare: number; regional: number };
  /** Themes should not pile up: score lost per unit of bridge weight shared with an idea already chosen. */
  redundancyPerBridge: number;
  /**
   * B4 diversity step (MMR-like): score lost for every idea already chosen that shares two or more non-generic tags
   * with this one ("two variations of the same thing"). 0 = off (WEIGHTS_CURRENT).
   */
  sharedPairPenalty: number;

  // --- per direction ---------------------------------------------------------------------------------
  familiar: {
    pickedScore: number;
    nearRel: number;
    noise: number;
    spreadPerSameDomain: number;
    /** Fase 3 "Praktisch": added to the SECOND familiar slot, times the activity's practicality (engine/levels.ts). 0 = off. */
    practicalBonus: number;
  };
  unexpected: { hybridBase: number; hybridBridge: number; hybridNoise: number; chainNoise: number; oneStepBridge: number; oneStepNoise: number; farRelMax: number };
  adjacent: { noise: number; noveltyOtherWorld: number; peak: number };
  stretch: { base: number; bridge: number; noise: number; targetByWildness: readonly number[] };
  wildcard: { bridge: number; newWorld: number; redundancyFactor: number; ageDecay: number; baseRare: number; supplyDecay: number };

  // --- B4 behaviour switches (all off in WEIGHTS_CURRENT) --------------------------------------------
  /** An activity whose cost is unknown does not pass a "free" budget: unknown is never a favourable answer. */
  strictFreeCost: boolean;
  /** Seeds carry `fit` (measured relevance, 0..1) and `reasons[]` (which signals led to them). */
  explain: boolean;
  /**
   * Stap 125, the anchor model. With the person's own picks on a concrete page (EngineInput.explicitPicks) and at least three of
   * them usable, up to `picks` of them are seeds themselves (instead of two "familiar" slots), the rest of the book is built
   * around them (one adjacent, one unexpected, a stretch only when fewer than `picks` fit) and the wildcard stays separate.
   * 0 = off (every set but WEIGHTS_ANCHOR).
   */
  anchor: { picks: number };
}

export const WEIGHTS_CURRENT: Weights = {
  rare: { familiar: 0.12, adjacent: 0.2, unexpected: 0.25, stretch: 0.15, wildcard: 1.5 },
  rareJitter: { base: 0.4, spread: 1.2 },
  supply: { rare: 0.18, regional: 0.04 },
  redundancyPerBridge: 0.05,
  sharedPairPenalty: 0,
  familiar: { pickedScore: 2, nearRel: 0.4, noise: 0.3, spreadPerSameDomain: 0.35, practicalBonus: 0 },
  unexpected: { hybridBase: 2.5, hybridBridge: 0.15, hybridNoise: 0.3, chainNoise: 0.15, oneStepBridge: 0.1, oneStepNoise: 0.15, farRelMax: 0.3 },
  adjacent: { noise: 0.15, noveltyOtherWorld: 0.15, peak: 0.38 },
  stretch: { base: 2, bridge: 0.15, noise: 0.2, targetByWildness: [1, 1.2, 2, 2.8] },
  wildcard: { bridge: 2, newWorld: 2, redundancyFactor: 4, ageDecay: 2, baseRare: 0.5, supplyDecay: 3 },
  strictFreeCost: false,
  explain: false,
  anchor: { picks: 0 },
};

export const WEIGHTS_V2: Weights = {
  ...WEIGHTS_CURRENT,
  // Two ideas that share two real tags read as variations of one thing (41-46% of books in the zero measurement).
  // The penalty is of the order of a whole "adjacent" score so it decides between near-equal candidates without
  // overriding a clearly better one; the diversity rules in select.ts (domain/sub-domain caps) still apply on top.
  sharedPairPenalty: 0.45,
  // Fase 3: the second familiar idea is the one that is easiest to start. About the size of the noise, so it decides
  // between near-equal candidates (two of the person's own picks, say) without replacing a clearly closer one.
  familiar: { ...WEIGHTS_CURRENT.familiar, practicalBonus: 0.3 },
  strictFreeCost: true,
  explain: true,
};

/** B4 plus the anchor model: four of the person's own choices are in the book (Jan, 31 Oct 2026: 4 own + 2 anchored + 1 wildcard). */
export const WEIGHTS_ANCHOR: Weights = {
  ...WEIGHTS_V2,
  anchor: { picks: 4 },
};

/** Doors and directions are listed here only so the type stays close to the weights that use them. */
export type WeightedDirection = Extract<Direction, "familiar" | "adjacent" | "unexpected" | "stretch" | "wildcard">;
