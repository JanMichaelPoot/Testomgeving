// What a person must already be able to do before an activity can start (fix round "skills the reader doesn't have"). The default assumption is
// that the reader has NO domain skill. An activity that needs a specific one is only offered when the reader said, in their own words, that they
// have it; without that it is not selected, not shown as a companion and not offered as a card.
//
// Kept as an explicit list, not read from the free text of the library: adding a line here is a decision. Pure and client-safe.

import type { Activity } from "@/lib/discovery/types";

export type SpecificSkill = "programming" | "diving";
export type PriorSkill = "none" | "basic" | `specific(${SpecificSkill})`;

export const SPECIFIC_SKILLS: Readonly<Record<string, SpecificSkill>> = {
  // "Pick a good first issue and fix one small bug": needs to be able to read and change code, and to work with GitHub.
  "open-source": "programming",
  // "Only with a certificate and a recognised dive school."
  grotduiken: "diving",
  wrakduiken: "diving",
};

/** "specific(...)" from the list above; "basic" for the library's advanced level; "none" otherwise. */
export function priorSkillOf(a: Pick<Activity, "id" | "level">): PriorSkill {
  const specific = SPECIFIC_SKILLS[a.id];
  if (specific) return `specific(${specific})`;
  return (a.level ?? 0) >= 2 ? "basic" : "none";
}

const SKILL_PHRASES: Record<SpecificSkill, RegExp> = {
  programming:
    /\b(ik programmeer|ik kan (goed )?programmeren|programmeur|software ?(engineer|ontwikkelaar|developer)|(web|app)?developer|ontwikkelaar van software|i (can )?(program|code)\b|i'm a (programmer|developer|coder)|i am a (programmer|developer|coder)|i work (in|as) (software|a developer|a programmer)|coding experience|programmeerervaring|ervaring met (programmeren|python|javascript|typescript|java|c\+\+|c#))\b/i,
  diving: /\b(duikbrevet|ik duik\b|ik heb mijn brevet|open water (diver|brevet)|padi|scuba (certified|certificate|diver)|dive certificate|certified diver|i (scuba )?dive\b)/i,
};

// A sentence that is about not having the skill, or about wanting to get it, confirms nothing.
const NOT_HAVING = /\b(niet|geen|nooit|zonder|wil (graag )?(leren|beginnen)|leren|zou willen|no|not|never|can't|cannot|don't|without|learn(ing)?|want to|would like)\b/i;

/** The specific skills the person says they have, read conservatively from their own free text (sentence by sentence). */
export function confirmedSkills(texts: readonly (string | undefined | null)[]): SpecificSkill[] {
  const sentences = texts.flatMap((t) => (t ? t.split(/[.!?;\n]+/) : []));
  return (Object.keys(SKILL_PHRASES) as SpecificSkill[]).filter((skill) => sentences.some((s) => SKILL_PHRASES[skill].test(s) && !NOT_HAVING.test(s)));
}

/** Whether this activity may be offered to someone with these confirmed skills. */
export function skillAllows(activityId: string, confirmed: readonly string[] = []): boolean {
  const specific = SPECIFIC_SKILLS[activityId];
  return !specific || confirmed.includes(specific);
}
