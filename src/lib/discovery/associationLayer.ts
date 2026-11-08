// The association layer (step 2 of "implement the reference library"): a second vocabulary next to the 43 tags.
//
// The tags are coarse (a "stillness" tag cannot tell warmth from silence from rest), and 51 of the 127 reference associations have no
// tag at all: verwondering, trots, vrijheid, geduld, geur, tast, stilte, warmte, schoonheid... exactly what an image evokes. So:
//   - every image family says which associations it evokes (cardAssociations.json, written by hand, weights 1 / .7 / .4);
//   - every activity carries its strongest associations from the reference library (activityAssociations.json, generated);
//   - closeness is the overlap of the two, damped by how common an association is (idf), so "trots", which sits on nearly everything,
//     says less than "geur".
// Pure and client-safe: the server hands the browser slim vectors (concretePool.ts, associations.ts). Off unless
// KNOWLEDGE_ASSOCIATION_LAYER is on (knowledgeFlags.ts); with it off nothing here is used and nothing in the app changes.

/** An activity's associations, already multiplied by idf and scaled by score: [association, value][]. */
export type ActivityVector = readonly (readonly [string, number])[];

/** The associations the chosen images evoke, summed (association -> weight). */
export function assocProfile(cards: readonly { assoc?: Record<string, number> }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cards) for (const [s, w] of Object.entries(c.assoc ?? {})) out[s] = (out[s] ?? 0) + w;
  return out;
}

/** How close an activity lies to the chosen images in association space. 0 when it has no vector or shares nothing. */
export function assocCloseness(profile: Record<string, number>, vector: ActivityVector | undefined): number {
  if (!vector || vector.length === 0) return 0;
  let sum = 0;
  for (const [s, v] of vector) sum += (profile[s] ?? 0) * v;
  return sum / Math.sqrt(vector.length);
}

/** The associations that tie an activity to the chosen images, strongest first (for "daarin lazen we ..."). */
export function sharedAssociations(profile: Record<string, number>, vector: ActivityVector | undefined, n = 2): string[] {
  if (!vector) return [];
  return vector
    .map(([s, v]) => ({ s, w: (profile[s] ?? 0) * v }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w || (a.s < b.s ? -1 : 1))
    .slice(0, n)
    .map((x) => x.s);
}
