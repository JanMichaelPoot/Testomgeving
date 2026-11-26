import { describe, expect, it } from "vitest";
import { bookKindOverride, hasPhotoDefault, photoCategoryFor } from "@/lib/discovery/engine/photo";
import { ALL_ACTIVITIES, getActivity } from "@/lib/discovery/library";
import { activityKindFor, kindCopy } from "@/lib/pdf/ideaContent";

// The "Type" an idea page names comes from here. Six subdomains that were added later once had no default and silently read "Outdoors".
const typeOf = (id: string) => {
  const activity = getActivity(id)!;
  return kindCopy(activityKindFor({ photo_category: photoCategoryFor(activity), activity_id: id }), "nl").label;
};

describe("the type of an idea", () => {
  it("has a default for every subdomain in the library", () => {
    const missing = new Set(ALL_ACTIVITIES.filter((a) => !hasPhotoDefault(a.sub)).map((a) => `${a.domain}/${a.sub}`));
    expect([...missing]).toEqual([]);
  });

  it("never says outdoors for something done indoors, or at home for something done outdoors", () => {
    const indoors = ALL_ACTIVITIES.filter((a) => a.setting === "indoor" && photoCategoryFor(a) === "nature_outdoor");
    const outdoors = ALL_ACTIVITIES.filter((a) => a.setting === "outdoor" && photoCategoryFor(a) === "home_cozy");
    expect(indoors.map((a) => a.id)).toEqual([]);
    expect(outdoors.map((a) => a.id)).toEqual([]);
  });

  it("types learning, helping and collecting by the activity itself", () => {
    expect(typeOf("slides-ontwerpen")).toBe("Leren");
    expect(typeOf("hoofdrekenen")).toBe("Leren");
    expect(typeOf("hospice-vrijwilliger")).toBe("Voor een ander");
    expect(typeOf("dierenasiel")).toBe("Voor een ander");
    expect(typeOf("mineralen-edelstenen")).toBe("Verzamelen");
    expect(typeOf("kringloop")).toBe("Markt & winkelen");
    for (const a of ALL_ACTIVITIES) {
      if (a.domain === "growth") expect(bookKindOverride(a), a.id).toBe("learning");
      if (a.domain === "society") expect(bookKindOverride(a), a.id).toBe("helping");
    }
  });

  it("does not call writing or practising alone social", () => {
    for (const id of ["roman-schrijven", "gedichten-schrijven", "orgel-leren", "videomontage-leren", "podcast-maken"]) expect(typeOf(id), id).toBe("Creatief");
    expect(typeOf("koor")).toBe("Sociaal");
  });

  it("keeps the type of the category for a book without activity ids", () => {
    expect(activityKindFor({ photo_category: "nature_outdoor" })).toBe("outdoor");
  });
});
