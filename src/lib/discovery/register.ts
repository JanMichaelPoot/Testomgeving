import registerJson from "@/lib/discovery/register.json";
import type { Localized } from "@/lib/discovery/types";
import { REGISTERS, type Register } from "@/lib/discovery/registerTypes";

export * from "@/lib/discovery/registerTypes";

// The style register of an activity or an association image: the kind of taste it speaks to, used ONLY to balance
// what the image intake shows and to compose the second (concrete) page from the first (associative) one. See
// docs/plan-twee-beeldpagina-s.md, section 3.
//
// Deliberately NOT a gender label: no gender is asked or stored (Step 9), and a register describes the item, not the
// person. Anyone can like anything; the register only makes sure that nobody is shown a page that is lopsided by
// design. It is internal: never shown in the interface, never stored with an answer, never sent to analytics as text.
//
// The register of every item is written down in register.json (one line per activity id and per card family), so it
// can be read and corrected in one place; deriveRegister() is only the fallback for an item nobody classified yet,
// and validateRegisters() fails the build on such an item so the fallback is never silently relied on.

/** Names for people reading a report or the admin. Never shown to a visitor. */
export const REGISTER_LABELS: Record<Register, Localized> = {
  expressive: { nl: "Sierlijk en expressief", en: "Ornate and expressive" },
  nurturing: { nl: "Warm en verzorgend", en: "Warm and nurturing" },
  technical: { nl: "Technisch en scherp", en: "Technical and sharp" },
  nature: { nl: "Rust en natuur", en: "Calm and nature" },
};

interface RegisterTable {
  activities: Record<string, Register>;
  families: Record<string, Register>;
}
export const REGISTER_TABLE = registerJson as RegisterTable;

// Which register a tag leans towards. Used only by deriveRegister() and for the agreement figure in the report:
// the table above is the source of truth.
const TAG_REGISTER: Record<string, Register> = {
  performance: "expressive", color: "expressive", retro: "expressive", roleplay: "expressive", rhythm: "expressive", miniature: "expressive",
  caring: "nurturing", food: "nurturing", conviviality: "nurturing", growing: "nurturing", animals: "nurturing",
  precision: "technical", technique: "technical", strategy: "technical", competition: "technical", puzzling: "technical",
  challenge: "technical", speed: "technical", height: "technical", suspense: "technical", chance: "technical", depths: "technical", fire: "technical",
  nature: "nature", outdoors: "nature", stillness: "nature", water: "nature", stars: "nature", language: "nature", history: "nature", balance: "nature",
};
// A tie goes to the first register in this order, so the fallback is deterministic.
const TIE_ORDER: Register[] = ["technical", "nature", "expressive", "nurturing"];

/** The register the tags point to (weights optional). Fallback and sanity check, not the source of truth. */
export function deriveRegister(tags: readonly string[] | Record<string, number>): Register {
  const weights = Array.isArray(tags) ? Object.fromEntries((tags as readonly string[]).map((t) => [t, 1])) : (tags as Record<string, number>);
  const score: Record<Register, number> = { expressive: 0, nurturing: 0, technical: 0, nature: 0 };
  for (const [tag, w] of Object.entries(weights)) {
    const r = TAG_REGISTER[tag];
    if (r) score[r] += w;
  }
  return TIE_ORDER.reduce((best, r) => (score[r] > score[best] ? r : best), TIE_ORDER[0]);
}

/** The register of an activity: its line in register.json, else derived from its tags. */
export function registerOfActivity(a: { id: string; tags: readonly string[] }): Register {
  return REGISTER_TABLE.activities[a.id] ?? deriveRegister(a.tags);
}

/** The family a card belongs to (the card's own id when it stands alone). */
export function familyOf(c: { id: string; family?: string }): string {
  return c.family ?? c.id;
}

/** The register of an association card (all variants of a family share one): the family's line, else derived. */
export function registerOfCard(c: { id: string; family?: string; tagWeights: Record<string, number> }): Register {
  return REGISTER_TABLE.families[familyOf(c)] ?? deriveRegister(c.tagWeights);
}

/** Validation of register.json against the library. Pure; used by the vitest suite and taxonomy-check. */
export function validateRegisters(input: {
  activities: readonly { id: string; status: string }[];
  families: readonly string[];
  table?: RegisterTable;
}): { errors: string[]; warnings: string[] } {
  const table = input.table ?? REGISTER_TABLE;
  const errors: string[] = [];
  const known = new Set<string>(REGISTERS);
  const live = input.activities.filter((a) => a.status !== "retired");
  const activityIds = new Set(live.map((a) => a.id));
  const familyIds = new Set(input.families);
  for (const a of live) {
    const r = table.activities[a.id];
    if (!r) errors.push(`activity "${a.id}": no register in register.json (add it under "activities")`);
    else if (!known.has(r)) errors.push(`activity "${a.id}": unknown register "${r}"`);
  }
  for (const [id, r] of Object.entries(table.activities)) {
    if (!activityIds.has(id)) errors.push(`register.json: activity "${id}" does not exist (or is retired)`);
    else if (!known.has(r)) errors.push(`register.json: activity "${id}" has unknown register "${r}"`);
  }
  for (const f of familyIds) {
    const r = table.families[f];
    if (!r) errors.push(`card family "${f}": no register in register.json (add it under "families")`);
    else if (!known.has(r)) errors.push(`card family "${f}": unknown register "${r}"`);
  }
  for (const [id, r] of Object.entries(table.families)) {
    if (!familyIds.has(id)) errors.push(`register.json: card family "${id}" does not exist`);
    else if (!known.has(r)) errors.push(`register.json: card family "${id}" has unknown register "${r}"`);
  }
  return { errors, warnings: [] };
}
