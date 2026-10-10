import { describe, expect, it } from "vitest";
import { buildBecauseLines, buildVensterEcho } from "@/lib/vensterReveal";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { ideaPhoto } from "@/lib/illustrations";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

const v = getDictionary("nl").venster;
const source = {
  intakeVariant: "associations",
  associations: ["place-forest-edge", "place-workshop", "moment-clay", "sense-wood"],
  purpose: "self",
  personalReflection: "vaker iets met mijn handen",
};
const idea = (activity_id?: string) => ({ activity_id, photo_category: "creative_workshop" }) as IdeaBookEntry;

describe("buildVensterEcho", () => {
  it("names one image per round and quotes the open answer", () => {
    const echo = buildVensterEcho(source, "nl", v)!;
    expect(echo.sentence).toBe("Je koos een stille bosrand, handen vol klei en houtgeur.");
    expect(echo.images).toHaveLength(3);
    expect(echo.wrote).toBe("Je schreef: ‘vaker iets met mijn handen’.");
  });

  it("speaks to the recipient of a gift and stays away from other wizards", () => {
    expect(buildVensterEcho({ ...source, purpose: "gift" }, "nl", v)!.sentence).toMatch(/^Voor jou gekozen:/);
    expect(buildVensterEcho({ ...source, intakeVariant: undefined }, "nl", v)).toBeNull();
    expect(buildVensterEcho(null, "nl", v)).toBeNull();
  });
});

describe("buildBecauseLines", () => {
  it("finds the chosen image behind an idea", () => {
    const lines = buildBecauseLines([idea("pottenbakken"), idea()], idea("houtbewerking"), source, "nl", v);
    expect(lines["idea-0"].text).toBe("Omdat je handen vol klei koos");
    expect(lines["idea-1"]).toBeUndefined();
    expect(lines.wildcard).toBeDefined();
  });
});

describe("ideaPhoto", () => {
  it("prefers the activity's own photo", () => {
    expect(ideaPhoto(idea("pottenbakken"), 0)).toBe("/illustrations/discovery/pottenbakken.jpg");
    expect(ideaPhoto(idea(), 0)).toMatch(/categories\/creative_workshop/);
  });
});
