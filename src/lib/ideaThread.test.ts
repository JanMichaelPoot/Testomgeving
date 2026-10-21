import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  buildAssociationSources,
  getAssociation,
  imagesBehind,
  parseAssociationSources,
  sourceTagsFor,
  associationsToEngineInput,
} from "@/lib/discovery/associations";
import { getActivity } from "@/lib/discovery/library";
import { buildIdeaThreads, threadSentence } from "@/lib/ideaThread";
import { IdeaThread } from "@/components/plan/IdeaThread";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

const CHOSEN = ["place-still-water", "moment-clay", "sense-wood"];
const idea = (title: string, activity_id: string | null, location: unknown = null) =>
  ({ title, activity_id, location }) as unknown as IdeaBookEntry;

describe("sourceTagsFor", () => {
  const pottery = getActivity("pottenbakken")!;

  it("returns only tags that sit on the activity AND on a chosen image, strongest first, at most two", () => {
    const tags = sourceTagsFor(pottery.tags, CHOSEN);
    expect(tags).toEqual(["craft", "making"]);
    for (const t of tags) {
      expect(pottery.tags).toContain(t);
      expect(CHOSEN.some((id) => (getAssociation(id)!.tagWeights[t] ?? 0) > 0)).toBe(true);
    }
  });

  it("is empty when the images share nothing with the activity (never an invented link)", () => {
    expect(sourceTagsFor(pottery.tags, ["moment-summit"])).toEqual([]);
    expect(sourceTagsFor(pottery.tags, [])).toEqual([]);
    expect(sourceTagsFor(pottery.tags, ["not-an-image"])).toEqual([]);
  });

  it("holds for a spread of activities: every tag it names is on both sides", () => {
    const chosen = ["place-forest-edge", "moment-stillness", "sense-wood", "moment-rhythm", "place-kitchen-table"];
    const activities = ["pottenbakken", "hardlopen", "creatief-schrijven", "yoga"].map((id) => getActivity(id)).filter((a) => !!a);
    expect(activities.length).toBeGreaterThanOrEqual(2);
    for (const a of activities) {
      for (const t of sourceTagsFor(a!.tags, chosen)) {
        expect(a!.tags).toContain(t);
        expect(chosen.some((id) => (getAssociation(id)!.tagWeights[t] ?? 0) > 0)).toBe(true);
      }
    }
  });

  it("is also part of what the engine input returns", () => {
    const out = associationsToEngineInput({
      associationIds: CHOSEN,
      interestDomains: [],
      constraints: { budget: "100", timeAvailable: "halfday", mustHaves: "", socialFormats: [], ageCategory: "" },
      seed: "t",
    });
    expect(Object.keys(out.sourceTags).length).toBeGreaterThan(0);
    for (const [id, tags] of Object.entries(out.sourceTags)) {
      expect(tags.length).toBeLessThanOrEqual(2);
      for (const t of tags) expect(getActivity(id)!.tags).toContain(t);
    }
  });
});

describe("association sources (stored with the book)", () => {
  it("builds version 2 for the ideas that came from the library and skips the others", () => {
    const built = buildAssociationSources([{ activity_id: "pottenbakken" }, { activity_id: null }, { activity_id: "no-such-activity" }, {}], CHOSEN);
    expect(built.version).toBe(2);
    expect(Object.keys(built.sources)).toEqual(["pottenbakken"]);
    expect(built.sources.pottenbakken).toEqual(imagesBehind(getActivity("pottenbakken")!.tags, CHOSEN, 2));
    expect(built.sourceTags.pottenbakken).toEqual(["craft", "making"]);
  });

  it("reads version 2 back unchanged", () => {
    const built = buildAssociationSources([{ activity_id: "pottenbakken" }], CHOSEN);
    expect(parseAssociationSources(JSON.parse(JSON.stringify(built)))).toEqual(built);
  });

  it("still reads the old shape (just the images per activity)", () => {
    expect(parseAssociationSources({ pottenbakken: ["moment-clay", "sense-wood"] })).toEqual({
      version: 2,
      sources: { pottenbakken: ["moment-clay", "sense-wood"] },
      sourceTags: {},
    });
  });

  it("gives nothing for nothing and for something that is not ours", () => {
    for (const raw of [null, undefined, 5, "x", [], [["a"]], {}, { version: 2 }, { a: 1 }, { a: [] }]) {
      const out = parseAssociationSources(raw);
      if (out) expect(Object.keys(out.sources).length + Object.keys(out.sourceTags).length).toBe(0);
      else expect(out).toBeNull();
    }
    expect(parseAssociationSources({ version: 2, sources: { a: [1, "x"] }, sourceTags: "oops" })).toEqual({ version: 2, sources: { a: ["x"] }, sourceTags: {} });
  });
});

describe("buildIdeaThreads", () => {
  const sources = buildAssociationSources([{ activity_id: "pottenbakken" }], CHOSEN);

  it("builds a thread with the image, the tags, the door and the place", () => {
    const threads = buildIdeaThreads(
      [idea("Pottenbakken zoals je stiekem wilde", "pottenbakken", { name: "Steck", city: "Utrecht" })],
      null,
      sources,
      "nl",
    );
    expect(threads["idea-0"]).toEqual({
      image: { src: getAssociation("moment-clay")!.image, label: "Handen vol klei" },
      tags: ["vakmanschap", "zelf maken"],
      title: "Pottenbakken zoals je stiekem wilde",
      place: "Steck, Utrecht",
    });
  });

  it("leaves out the place when the idea has none, and the whole thread for old books and other ideas", () => {
    const ideas = [idea("A", "pottenbakken"), idea("B", null), idea("C", "hardlopen")];
    const threads = buildIdeaThreads(ideas, null, sources, "nl");
    expect(threads["idea-0"].place).toBeNull();
    expect(threads["idea-1"]).toBeUndefined();
    expect(threads["idea-2"]).toBeUndefined(); // nothing stored for this activity: never filled in
    expect(buildIdeaThreads(ideas, null, null, "nl")).toEqual({});
  });

  it("keeps a thread that has only one of image and tags, drops one that has neither", () => {
    const onlyTags = { version: 2 as const, sources: {}, sourceTags: { pottenbakken: ["craft"] } };
    expect(buildIdeaThreads([idea("A", "pottenbakken")], null, onlyTags, "nl")["idea-0"]).toMatchObject({ image: null, tags: ["vakmanschap"] });
    const neither = { version: 2 as const, sources: {}, sourceTags: {} };
    expect(buildIdeaThreads([idea("A", "pottenbakken")], null, neither, "nl")).toEqual({});
  });

  it("shows only words the shown image itself carries (a tag from another chosen image would suggest a wrong link)", () => {
    // Tea house: the shown image (laughing) carries conviviality, but "discovery" came from the forest image.
    const tea = buildAssociationSources([{ activity_id: "koffie-thee" }], ["place-forest-edge-c", "moment-laughing-c"]);
    expect(tea.sourceTags["koffie-thee"]).toContain("discovery");
    const thread = buildIdeaThreads([idea("Proeven", "koffie-thee")], null, tea, "nl")["idea-0"];
    expect(thread.image?.label).toBe("Confetti na de grap");
    expect(thread.tags).toEqual(["gezelligheid"]);
  });

  it("gives the wildcard its own key", () => {
    const threads = buildIdeaThreads([], idea("W", "pottenbakken"), sources, "en");
    expect(Object.keys(threads)).toEqual(["wildcard"]);
    expect(threads.wildcard.tags).toHaveLength(2);
  });
});

describe("threadSentence (the PDF line)", () => {
  const thread = { image: { src: "/illustrations/associations/moment-clay.jpg", label: "Handen vol klei" }, tags: ["vakmanschap", "zelf maken"], title: "T", place: null };

  it("reads naturally in both languages and has no arrow glyph", () => {
    const nl = threadSentence(thread, getDictionary("nl").venster.thread, "en");
    expect(nl).toBe("Bij deze deur hoort het beeld ‘handen vol klei’: daarin lazen we vakmanschap en zelf maken.");
    const en = threadSentence({ ...thread, image: { ...thread.image, label: "Hands full of clay" }, tags: ["craftsmanship"] }, getDictionary("en").venster.thread, "and");
    expect(en).toBe("This door follows from the image ‘hands full of clay’, in which we read craftsmanship.");
    expect(`${nl}${en}`).not.toMatch(/[→›]/);
  });

  it("says only what is there", () => {
    const copy = getDictionary("nl").venster.thread;
    expect(threadSentence({ ...thread, tags: [] }, copy, "en")).toBe("Bij deze deur hoort het beeld ‘handen vol klei’.");
    expect(threadSentence({ ...thread, image: null }, copy, "en")).toBe("In de gekozen beelden lazen we vakmanschap en zelf maken.");
    expect(threadSentence({ ...thread, image: null, tags: [] }, copy, "en")).toBeNull();
    expect(threadSentence(undefined, copy, "en")).toBeNull();
  });
});

describe("IdeaThread (component)", () => {
  const copy = getDictionary("nl").venster.thread;
  const full = {
    image: { src: "/illustrations/associations/moment-clay.jpg", label: "Handen vol klei" },
    tags: ["vakmanschap", "zelf maken"],
    title: "Pottenbakken",
    place: "Steck, Utrecht",
  };

  it("renders nothing without data", () => {
    expect(renderToStaticMarkup(createElement(IdeaThread, { thread: null, copy }))).toBe("");
    expect(renderToStaticMarkup(createElement(IdeaThread, { thread: undefined, copy }))).toBe("");
  });

  it("is an ordered list of four links, each with a caption, the image with its label as alt text", () => {
    const html = renderToStaticMarkup(createElement(IdeaThread, { thread: full, copy }));
    expect(html).toContain("<ol");
    expect((html.match(/<li/g) ?? []).length).toBe(4);
    expect(html).toContain('alt="Handen vol klei"');
    for (const text of ["vakmanschap · zelf maken", "Pottenbakken", "Steck, Utrecht", copy.imageCaption, copy.tagsCaption, copy.doorCaption, copy.placeCaption, copy.heading]) {
      expect(html).toContain(text);
    }
  });

  it("leaves out a link that is not in the data instead of inventing it", () => {
    const html = renderToStaticMarkup(createElement(IdeaThread, { thread: { ...full, image: null, place: null }, copy }));
    expect((html.match(/<li/g) ?? []).length).toBe(2);
    expect(html).not.toContain("<img");
    expect(html).not.toContain(copy.imageCaption);
    expect(html).not.toContain(copy.placeCaption);
  });
});
