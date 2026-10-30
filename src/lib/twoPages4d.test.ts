import { describe, expect, it } from "vitest";
import { buildAssociationLibrary, buildAssociationSources, parseAssociationSources } from "@/lib/discovery/associations";
import { buildProfileStory, type ProfileInput } from "@/lib/discovery/profileStory";
import { buildIdeaThreads, threadSentence } from "@/lib/ideaThread";
import { windowImageHref } from "@/lib/vensterPanes";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

const CHOSEN = ["place-still-water", "moment-clay", "sense-wood"];

describe("the profile portrait of the two-page intake", () => {
  const lib = buildAssociationLibrary("nl");
  const input = (extra: Partial<ProfileInput> = {}): ProfileInput => ({
    cards: lib.cards,
    tagLabels: lib.tagLabels,
    chosen: CHOSEN,
    corrections: [],
    timeAvailable: "halfday",
    budget: "25",
    searchDistance: "hour",
    company: ["alone"],
    socialFormats: [],
    mustHaves: "",
    gift: false,
    name: "",
    ...extra,
  });
  const copy = getDictionary("nl").venster.profile;

  it("names what the person chose themselves, at most three, once", () => {
    const withPicks = buildProfileStory(input({ picks: ["Pottenbakken", "Boulderen", "Yoga", "Schaken"] }), copy);
    expect(withPicks.story).toContain("Zelf koos je ook pottenbakken, boulderen en yoga");
    expect(withPicks.story).not.toContain("schaken");
    expect(buildProfileStory(input(), copy).story).not.toContain("Zelf koos je");
  });

  it("speaks of the recipient in a gift, in both languages", () => {
    const gift = buildProfileStory(input({ gift: true, name: "Anna", picks: ["Pottenbakken"] }), copy);
    expect(gift.story).toContain("Anna koos zelf ook pottenbakken");
    const enLib = buildAssociationLibrary("en");
    const en = buildProfileStory({ ...input({ picks: ["Pottery", "Climbing"] }), cards: enLib.cards, tagLabels: enLib.tagLabels }, getDictionary("en").venster.profile);
    expect(en.story).toContain("You also chose pottery and climbing yourself");
  });
});

describe("the thread of a door the person chose themselves", () => {
  const idea = (title: string, activity_id: string) => ({ title, activity_id, location: null }) as unknown as IdeaBookEntry;
  const ideas = [idea("Pottenbakken zoals je stiekem wilde", "pottenbakken"), idea("Een vleermuizenwandeling", "nachtdieren")];

  it("remembers which activities of the book were chosen on page 2, and nothing for the old flow", () => {
    const sources = buildAssociationSources(ideas, CHOSEN, ["pottenbakken", "not-in-book"]);
    expect(sources.own).toEqual(["pottenbakken"]);
    expect(buildAssociationSources(ideas, CHOSEN).own).toBeUndefined();
    expect(parseAssociationSources(JSON.parse(JSON.stringify(sources)))?.own).toEqual(["pottenbakken"]);
    expect(parseAssociationSources({ version: 2, sources: {}, sourceTags: {}, own: [1, "x"] })?.own).toEqual(["x"]);
  });

  it("marks the thread and says so in the PDF sentence and the caption, and leaves a derived door as it was", () => {
    const sources = buildAssociationSources(ideas, CHOSEN, ["pottenbakken"]);
    const threads = buildIdeaThreads(ideas, null, sources, "nl");
    expect(threads["idea-0"].own).toBe(true);
    expect(threads["idea-1"]?.own).toBeUndefined();
    const copy = getDictionary("nl").venster.thread;
    expect(threadSentence(threads["idea-0"], copy, "en")).toMatch(/^Dit koos je zelf\./);
    expect(copy.ownDoorCaption).toBe("Door jou gekozen");
    expect(getDictionary("en").venster.thread.pdfOwn).toBe("You chose this yourself.");
  });

  it("keeps a thread for a chosen activity even when the images share nothing with it", () => {
    const sources = buildAssociationSources([idea("Bungeejumpen", "bungeejump")], ["place-still-water"], ["bungeejump"]);
    const threads = buildIdeaThreads([idea("Bungeejumpen", "bungeejump")], null, sources, "nl");
    expect(threads["idea-0"]?.own).toBe(true);
    expect(threads["idea-0"]?.image).toBeNull();
  });
});

describe("the downloadable window of the two-page intake", () => {
  it("lists the images and then the chosen activities as a:<id>, and no directions", () => {
    const href = windowImageHref({ intakeFlow: "images2", associations: ["place-still-water", "moment-clay"], interests: ["pottenbakken", "yoga"], interestDomains: ["nature"] });
    const c = new URL(href!, "http://x").searchParams.get("c")!;
    expect(c).toBe("place-still-water,moment-clay,a:pottenbakken,a:yoga");
  });

  it("is unchanged for the four-round intake", () => {
    const href = windowImageHref({ associations: ["place-still-water"], interestDomains: ["nature"], interests: ["yoga"] });
    expect(new URL(href!, "http://x").searchParams.get("c")).toBe("w:nature,place-still-water");
  });
});
