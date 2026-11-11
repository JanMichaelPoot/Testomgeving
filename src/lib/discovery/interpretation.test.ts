import { describe, expect, it } from "vitest";
import {
  INTERPRET_LIMITS,
  createCache,
  createLimiter,
  factsKey,
  interpretSystemPrompt,
  interpretUserPrompt,
  validateBlocks,
  type InterpretFacts,
} from "@/lib/discovery/interpretation";
import { buildFacts } from "@/lib/discovery/interpretFacts";
import { buildProfileStory } from "@/lib/discovery/profileStory";
import { buildAssociationLibrary } from "@/lib/discovery/associations";
import { getDictionary } from "@/lib/i18n/dictionaries";

const facts = (over: Partial<InterpretFacts> = {}): InterpretFacts => ({
  locale: "nl",
  audience: "self",
  name: "",
  images: [
    { label: "Een plank vol nerven", tags: ["maken", "natuur"] },
    { label: "Het licht van een filmset", tags: ["verhaal"] },
  ],
  activities: ["Pottenbakken", "Houtsnijden"],
  leans: ["leans towards calm, unhurried things"],
  corrections: [],
  ...over,
});

const GOOD = {
  opening: "Je trekt naar dingen waar je handen iets te doen hebben.",
  thread: "Een plank vol nerven, pottenbakken en houtsnijden gaan alle drie over maken met een eerlijk materiaal, in je eigen tempo.",
  direction: "Dat wijst naar rustig werk met je handen, en misschien naar een vak dat je nog niet kende.",
};

describe("the model-written reading is checked before it is shown", () => {
  it("accepts a plain, grounded reading", () => {
    expect(validateBlocks(GOOD, facts())).toEqual(GOOD);
  });

  it("rejects what is not an object with three texts, and texts that are too short or too long", () => {
    expect(validateBlocks(null, facts())).toBeNull();
    expect(validateBlocks("tekst", facts())).toBeNull();
    expect(validateBlocks({ ...GOOD, direction: undefined }, facts())).toBeNull();
    expect(validateBlocks({ ...GOOD, opening: "Kort." }, facts())).toBeNull();
    expect(validateBlocks({ ...GOOD, thread: GOOD.thread.repeat(4) }, facts())).toBeNull();
    expect(GOOD.opening.length).toBeGreaterThanOrEqual(INTERPRET_LIMITS.opening.min);
  });

  it("rejects numbers, addresses, markup, the banned phrases and talk of AI", () => {
    const bad = [
      "Je hebt 3 dingen gekozen die bij pottenbakken passen en dat zegt veel.",
      "Kijk eens op www.pottenbakker.nl voor een plank vol nerven en pottenbakken.",
      "**Een plank vol nerven** en pottenbakken horen bij elkaar in je keuzes.",
      "Wat ons opviel: een plank vol nerven en pottenbakken horen bij elkaar.",
      "Een algoritme zag dat een plank vol nerven en pottenbakken bij elkaar horen.",
      "Dit wijst op een introvert iemand met een plank vol nerven en pottenbakken.",
    ];
    for (const opening of bad) expect(validateBlocks({ ...GOOD, opening }, facts()), opening).toBeNull();
  });

  it("rejects a reading that says nothing about what was chosen", () => {
    const generic = {
      opening: "Er is veel te ontdekken voor wie nieuwsgierig blijft kijken.",
      thread: "Alles hangt samen met alles, en dat maakt een leven mooi en verrassend om te ontdekken.",
      direction: "Dat wijst naar een wereld die nog open ligt voor wie durft te kiezen.",
    };
    expect(validateBlocks(generic, facts())).toBeNull();
  });

  it("keeps to one sentence for the opening", () => {
    expect(validateBlocks({ ...GOOD, opening: "Je houdt van materiaal. Je houdt van rust." }, facts())).toBeNull();
  });

  it("speaks in the third person for someone else and never addresses them with 'je'", () => {
    const other = facts({ audience: "named", name: "Emma" });
    expect(validateBlocks(GOOD, other)).toBeNull();
    const third = {
      opening: "Emma trekt naar dingen waar de handen iets te doen hebben.",
      thread: "Een plank vol nerven, pottenbakken en houtsnijden gaan alle drie over maken met eerlijk materiaal.",
      direction: "Dat wijst naar rustig werk met de handen, en misschien naar een vak dat nog nieuw is.",
    };
    expect(validateBlocks(third, other)).toEqual(third);
    const english = facts({ locale: "en", audience: "other", images: [{ label: "A plank full of grain", tags: ["making"] }], activities: ["Pottery"] });
    expect(
      validateBlocks(
        { opening: "There is a real pull towards things made by hand.", thread: "A plank full of grain and pottery both come from making with honest material, at an unhurried pace.", direction: "That points to quiet craft, and perhaps one you did not know yet." },
        english,
      ),
    ).toBeNull();
  });

  it("the prompts carry the rules and only the facts", () => {
    const system = interpretSystemPrompt(facts());
    expect(system).toMatch(/Never invent/);
    expect(system).toMatch(/Dutch/);
    expect(interpretSystemPrompt(facts({ locale: "en" }))).toMatch(/English/);
    expect(interpretSystemPrompt(facts({ audience: "named", name: "Emma" }))).toMatch(/Emma/);
    const user = interpretUserPrompt(facts());
    expect(user).toContain("Een plank vol nerven: maken, natuur");
    expect(user).toContain("Pottenbakken; Houtsnijden");
    expect(user).not.toMatch(/budget|plaats|Utrecht/i);
  });
});

describe("the key, the cache and the limiter", () => {
  it("the same facts give the same key whatever the order of the picks", () => {
    const a = facts();
    const b = facts({ images: [...a.images].reverse(), activities: [...a.activities].reverse() });
    expect(factsKey(a)).toBe(factsKey(b));
    expect(factsKey(a)).not.toBe(factsKey(facts({ activities: ["Pottenbakken"] })));
  });

  it("the cache forgets old readings and stays small", () => {
    const cache = createCache<string>(2, 1000);
    cache.set("a", "1", 0);
    expect(cache.get("a", 500)).toBe("1");
    expect(cache.get("a", 1500)).toBeUndefined();
    cache.set("b", "2", 0);
    cache.set("c", "3", 0);
    cache.set("d", "4", 0);
    expect(cache.size).toBeLessThanOrEqual(2);
  });

  it("a connection gets only a handful of readings per window", () => {
    const limiter = createLimiter(3, 1000);
    expect([0, 1, 2, 3].map((i) => limiter.take("ip", i * 10))).toEqual([true, true, true, false]);
    expect(limiter.take("other", 40)).toBe(true);
    expect(limiter.take("ip", 1200)).toBe(true);
  });
});

describe("the facts are rebuilt from ids, and the fixed reading always exists", () => {
  it("only real ids count; unknown ones are dropped, and with none there is no reading to write", () => {
    expect(buildFacts({ associations: ["nope"], interests: [], corrections: [] }, "nl")).toBeNull();
    const f = buildFacts({ associations: ["place-forest-edge", "nope"], interests: ["pottenbakken", "nope"], corrections: ["nature", "not-a-tag"] }, "nl");
    expect(f).not.toBeNull();
    expect(f!.images).toHaveLength(1);
    expect(f!.activities).toEqual(["Pottenbakken"]);
    expect(f!.corrections).toHaveLength(1);
    expect(f!.audience).toBe("self");
  });

  it("who it is for decides the person of the reading", () => {
    const base = { associations: ["place-forest-edge"], interests: [], corrections: [] };
    expect(buildFacts({ ...base, searchContext: "child", recipientName: "Emma" }, "nl")!.audience).toBe("named");
    expect(buildFacts({ ...base, searchContext: "adult" }, "nl")!.audience).toBe("other");
    expect(buildFacts({ ...base, searchContext: "group" }, "nl")!.audience).toBe("group");
    expect(buildFacts({ ...base, searchContext: "adult", recipientName: "<b>Els</b>" }, "nl")!.name).not.toMatch(/[<>]/);
  });

  for (const locale of ["nl", "en"] as const) {
    it(`the fixed reading has three non-empty blocks and every chosen image (${locale})`, () => {
      const library = buildAssociationLibrary(locale);
      const chosen = library.cards.slice(0, 5).map((c) => c.id);
      const story = buildProfileStory(
        {
          cards: library.cards,
          tagLabels: library.tagLabels,
          chosen,
          corrections: [],
          timeAvailable: "",
          budget: "",
          searchDistance: "city",
          company: [],
          socialFormats: [],
          mustHaves: "",
          forOther: false,
          name: "",
        },
        getDictionary(locale).venster.profile,
      );
      expect(story.interpretation.opening.length).toBeGreaterThan(10);
      expect(story.interpretation.thread.length).toBeGreaterThan(10);
      expect(story.interpretation.direction.length).toBeGreaterThan(10);
      expect(story.chosenCards.map((c) => c.id)).toEqual(chosen);
      // No lists any more: the reading never contains the removed headings.
      const text = JSON.stringify(story.interpretation);
      expect(text).not.toMatch(/Wat ons opviel|What caught our eye/);
    });
  }
});
