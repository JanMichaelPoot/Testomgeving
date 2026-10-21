import { randomUUID } from "node:crypto";
import type { StoredIntake } from "@/app/intake/actions";
import { TAGS } from "@/lib/discovery/library";
import { associationsToEngineInput, sanitizeAssociations } from "@/lib/discovery/associations";
import { sanitizeAxesOverride } from "@/lib/discovery/associationProfile";

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

export function applyImageIntake(stored: StoredIntake, locale: "nl" | "en", seed: string = randomUUID()): StoredIntake {
  const { associations, associationCorrections } = sanitizeAssociations(stored);
  const axesOverride = sanitizeAxesOverride(stored.axesOverride);
  const purpose = stored.purpose === "gift" ? "gift" : "self";
  const derived = associationsToEngineInput({
    associationIds: associations,
    corrections: associationCorrections,
    interestDomains: stored.interestDomains ?? [],
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
  });
  const tagLabel = new Map(TAGS.map((t) => [t.id, t.label[locale]]));

  return {
    ...stored,
    intakeVariant: "associations",
    purpose,
    recipientName: purpose === "gift" ? cleanRecipientName(stored.recipientName) : "",
    associations,
    associationCorrections,
    axesOverride,
    interests: derived.interests,
    interestDomains: derived.interestDomains,
    practicalToWild: derived.practicalToWild,
    effort: derived.effort,
    solutionTypes: ["activity"],
    purposeFollowUp: "",
    freeTimePattern: "",
    situation: "",
    preferences: associationCorrections.map((t) => tagLabel.get(t) ?? t).join(", "),
  };
}
