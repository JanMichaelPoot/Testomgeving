import type { IdeaScores } from "@/lib/claude/ideaBookTypes";
import type { Activity } from "@/lib/discovery/types";
import type { Direction, Seed } from "@/lib/discovery/engine/types";

// The Idea Book keeps a set of internal 0-100 scores per idea (the "One Thing" pick uses
// four of them; the admin export shows them all). Before the engine, Claude estimated
// them, which cost output tokens and varied per run. The engine knows the direction and
// the facts of the activity, so they are derived here: the same seed always gets the
// same scores. They are relative indications for ordering, not measurements.

const BY_DIRECTION: Record<Direction, { relevance: number; novelty: number; surprise: number; challenge: number; shareability: number }> = {
  familiar: { relevance: 92, novelty: 15, surprise: 12, challenge: 15, shareability: 45 },
  adjacent: { relevance: 72, novelty: 48, surprise: 40, challenge: 35, shareability: 55 },
  unexpected: { relevance: 56, novelty: 78, surprise: 78, challenge: 55, shareability: 72 },
  stretch: { relevance: 52, novelty: 66, surprise: 62, challenge: 78, shareability: 66 },
  wildcard: { relevance: 36, novelty: 90, surprise: 90, challenge: 70, shareability: 82 },
  explore: { relevance: 55, novelty: 55, surprise: 50, challenge: 40, shareability: 55 },
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function scoresForSeed(seed: Seed, activity: Activity): IdeaScores {
  const d = BY_DIRECTION[seed.direction];
  // How doable it is for a beginner: cost, physical effort, experience and supervision count against it;
  // an unknown facet costs a little (we cannot promise it).
  const unknown = [activity.cost, activity.intensity, activity.level].filter((v) => v === null).length;
  const feasibility =
    92 - (activity.cost ?? 1) * 8 - (activity.intensity ?? 1) * 6 - (activity.level ?? 1) * 8 - (activity.safety.tier === 2 ? 12 : 0) - unknown * 4;
  const effort = 10 + (activity.intensity ?? 1) * 20 + (activity.level ?? 1) * 15 + (activity.duration ?? 2) * 5;
  const cost = activity.cost === null ? 50 : activity.cost * 30 + 5;
  return {
    relevance: clamp(d.relevance),
    novelty: clamp(d.novelty),
    feasibility: clamp(feasibility),
    surprise: clamp(d.surprise),
    shareability: clamp(d.shareability),
    effort: clamp(effort),
    cost: clamp(cost),
    social_fit: clamp(seed.lead ? 88 : activity.formats ? 62 : 55),
    challenge_level: clamp(d.challenge + (activity.level ?? 0) * 6 + (activity.safety.tier === 2 ? 6 : 0)),
  };
}
