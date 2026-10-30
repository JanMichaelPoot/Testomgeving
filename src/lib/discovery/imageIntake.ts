import { randomUUID } from "node:crypto";
import type { StoredIntake } from "@/app/intake/actions";
import { TAGS, getActivity, isImagePending } from "@/lib/discovery/library";
import { associationsToEngineInput, sanitizeAssociations } from "@/lib/discovery/associations";
import { sanitizeAxesOverride } from "@/lib/discovery/associationProfile";
import { currentMonth } from "@/lib/discovery/season";
import { MAX_CONCRETE_PICKS } from "@/lib/discovery/twoPages";

// Server side of the image intake ("Het venster"): turns what the image intake stores into
// the answers the rest of the app already reads. Applied once in submitIntake, so checkout,
// the engine, the prompt and the PDF all see the same, final answers.
//
// Which question became what (vraag-audit, WindowInto/WINDOW_Vraag-audit_Fase1-1.md):
//   asked       worlds, images (three rounds), place + search distance, time, budget,
//               company + social form, age, hard limits, one optional open question
//   derived     interests, practicalToWild (novelty axis), effort (energy axis)
//   fixed       solutionTypes = ["activity"]
//   left empty  purposeFollowUp, freeTimePattern, situation (read as "not stated")
//   from images preferences = the tags added under "Niet helemaal"
//   the person's own sliders on the profile screen (axesOverride) replace the axis the images gave

const MAX_NAME = 40;

export function cleanRecipientName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\r\n\t<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_NAME).trim();
}

const EFFORTS = ["minimal", "some", "committed"] as const;
const EFFORT_CAP = { minimal: 1, some: 2, committed: 3 } as const;

/**
 * Two pages: the effort dial is read from the images (energy axis), but the person also chose concrete activities. An activity
 * they chose that needs more effort than the images suggest must not be ruled out by a dial they never answered, so the effort
 * rises to what their picks need. A slider the person moved themselves (`energyMoved`) is an answer and stays.
 */
export function effortForPicks(fromImages: string, picks: readonly string[], energyMoved: boolean): string {
  if (energyMoved) return fromImages;
  const need = Math.max(0, ...picks.map((id) => getActivity(id)?.intensity ?? 0));
  const have = EFFORTS.indexOf(fromImages as (typeof EFFORTS)[number]);
  const needed = EFFORTS.findIndex((e) => EFFORT_CAP[e] >= need);
  return EFFORTS[Math.max(have < 0 ? 1 : have, needed < 0 ? 2 : needed)];
}

// `month` is only passed by the evaluation harness (scripts/eval) so a run does not depend on the date it is made on.
export function applyImageIntake(stored: StoredIntake, locale: "nl" | "en", seed: string = randomUUID(), month: number = currentMonth()): StoredIntake {
  const { associations, associationCorrections } = sanitizeAssociations(stored);
  const axesOverride = sanitizeAxesOverride(stored.axesOverride);
  const purpose = stored.purpose === "gift" ? "gift" : "self";
  // Two-page flow: the activities on page 2 are the person's own choice (sanitised again below, the browser is not trusted).
  const twoPages = stored.intakeFlow === "images2";
  const picks = twoPages
    ? [...new Set((stored.interests ?? []).filter((id): id is string => typeof id === "string"))]
        .filter((id) => {
          const a = getActivity(id);
          return !!a && a.status !== "retired" && !isImagePending(a);
        })
        .slice(0, MAX_CONCRETE_PICKS)
    : null;
  const derived = associationsToEngineInput({
    associationIds: associations,
    corrections: associationCorrections,
    interestDomains: twoPages ? [] : stored.interestDomains ?? [],
    explicitInterests: picks ?? undefined,
    surpriseMe: stored.surpriseMe,
    axesOverride,
    constraints: {
      budget: stored.budget,
      timeAvailable: stored.timeAvailable,
      mustHaves: stored.mustHaves,
      socialFormats: stored.socialFormats ?? [],
      ageCategory: stored.ageCategory,
    },
    seed,
    month,
  });
  const tagLabel = new Map(TAGS.map((t) => [t.id, t.label[locale]]));

  return {
    ...stored,
    intakeVariant: "associations",
    ...(twoPages ? { intakeFlow: "images2" as const } : { intakeFlow: undefined }),
    purpose,
    recipientName: purpose === "gift" ? cleanRecipientName(stored.recipientName) : "",
    associations,
    associationCorrections,
    axesOverride,
    interests: derived.interests,
    // Two pages: the worlds are those of the chosen activities (no direction screen any more).
    interestDomains: twoPages ? [...new Set(derived.interests.map((id) => getActivity(id)?.domain).filter((d): d is string => !!d))] : derived.interestDomains,
    practicalToWild: derived.practicalToWild,
    effort: twoPages ? effortForPicks(derived.effort, derived.interests, axesOverride.energy !== undefined) : derived.effort,
    solutionTypes: ["activity"],
    purposeFollowUp: "",
    freeTimePattern: "",
    situation: "",
    preferences: associationCorrections.map((t) => tagLabel.get(t) ?? t).join(", "),
  };
}
