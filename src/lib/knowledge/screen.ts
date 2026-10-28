import type { NormalizedRecord, RejectReason } from "@/lib/knowledge/types";

// Automatic screens for a record that nothing in the library matches. They only ever REJECT (a record that is
// kept is still reviewed by a human before it can become an activity). Each is a plain, auditable rule.

// Things WINDOW does not suggest, whatever the source says: weapons, drugs, chemistry at home, gambling.
const UNSAFE = /\b(weapon|weapons|firearm|explosive|explosives|drug|drugs|poison|chemistry|gambling|betting|casino)\b/i;
// Clinical or collector terms for a fascination, not an activity ("tyrosemiophilia", "nesophilia").
const TECHNICAL = /(philia|phobia)$/i;
// One-word labels that name a whole field, not something to do on a Saturday.
const GENERIC_LABELS = new Set([
  "collecting", "collection", "hobby", "game", "games", "sport", "sports", "art", "craft", "crafts", "spotting", "posting",
  "recreation", "culture", "tourism", "writing", "reading", "music",
]);

export const MAX_LABEL_CHARS = 40;

export function autoReject(rec: NormalizedRecord): RejectReason | null {
  const en = rec.labels.en?.trim();
  const nl = rec.labels.nl?.trim();
  if (!en && !nl) return "no_label";
  for (const label of [en, nl]) {
    if (!label) continue;
    if (UNSAFE.test(label)) return "unsafe_or_restricted";
    if (TECHNICAL.test(label.split(/\s+/).pop() ?? label)) return "technical_term";
    if (label.length > MAX_LABEL_CHARS) return "label_too_long";
  }
  if (en && GENERIC_LABELS.has(en.toLowerCase())) return "too_generic";
  return null;
}

/**
 * Ranks queue candidates so that the cap keeps the most promising ones: a Dutch label already exists (no translation
 * needed), the source describes it, the name is short. Deterministic; a person's proposal weighs most.
 */
export function queueScore(rec: NormalizedRecord, verdict: "accept" | "unsure" | "merge" | undefined): number {
  let score = 0;
  // A person's proposal outranks everything the rules can add (at most +4 below), so the cap drops unread records first.
  // New activities first, then maybes, then "we already have this" (a quick yes or no, and the least valuable).
  if (verdict === "accept") score += 8;
  else if (verdict === "unsure") score += 7;
  else if (verdict === "merge") score += 6;
  if (rec.labels.nl) score += 2;
  if (rec.descriptions.en) score += 1;
  if (rec.descriptions.nl) score += 1;
  const words = (rec.labels.en ?? rec.labels.nl ?? "").trim().split(/\s+/).length;
  score -= Math.max(0, words - 3);
  return score;
}
