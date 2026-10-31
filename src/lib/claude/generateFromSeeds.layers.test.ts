import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeAnswers } from "@/app/intake/actions";
import { computeCharacterProfile } from "@/lib/characterProfile";

// The model and the research are replaced: this tests what the pipeline does with the R2.3 layers
// (a second call that runs next to the one that writes the ideas), not the model. Nothing here
// costs anything.
const create = vi.fn();
vi.mock("@/lib/anthropic", () => ({ anthropic: { messages: { create: (...a: unknown[]) => create(...a) } }, CLAUDE_MODEL: "test-model" }));

const researchSeeds = vi.fn();
vi.mock("@/lib/claude/localResearch", async (orig) => ({
  ...(await orig<typeof import("@/lib/claude/localResearch")>()),
  researchSeeds: (...a: unknown[]) => researchSeeds(...a),
}));

import { generateIdeaBookFromSeeds, splitCoreAnswer } from "@/lib/claude/generateFromSeeds";

const intake: IntakeAnswers = {
  situation: "",
  purpose: "self",
  purposeFollowUp: "",
  ageCategory: "35-44",
  location: "Utrecht",
  searchDistance: "hour",
  freeTimePattern: "",
  practicalToWild: "either",
  timeAvailable: "halfday",
  budget: "100",
  effort: "some",
  solutionTypes: ["activity"],
  mustHaves: "",
  preferences: "",
  company: ["partner"],
  personalReflection: "",
  intakeVariant: "associations",
  associations: ["moment-clay", "place-forest-edge", "sense-wood"],
  interests: ["pottenbakken"],
  interestDomains: ["creative"],
};

const size = (n: number) => ({ title: `Maat ${n}`, description: "Een zin.", estimated_cost: "Gratis", duration: "1 uur" });
const entry = (n: number) => ({
  title: `Idee ${n}`,
  intro: "Een zin.",
  why_it_fits: "Omdat.",
  details: ["Stap één.", "Stap twee."],
  first_action: "Doe dit.",
  practical: { estimated_cost: "€10", duration: "1 uur", difficulty: "easy", preparation: "" },
  location: null,
  requirements: [],
});
const layer = (n: number, extra: Record<string, unknown> = {}) => ({
  feels_like: `Koel ${n}. Stil.`,
  sizes: [size(1), size(2), size(3)],
  next_step: `Doe het nog eens ${n}.`,
  ...extra,
});

const toolUse = (name: string, input: unknown) => ({ content: [{ type: "tool_use", name, input }], usage: {} });
const coreAnswer = (n = 7) =>
  toolUse("create_idea_book", {
    profile_summary: "Samenvatting.",
    must_haves: [],
    preferences: [],
    ideas: Array.from({ length: n - 1 }, (_, i) => entry(i + 1)),
    wildcard: entry(n),
  });
const layersAnswer = (layers: unknown[]) => toolUse("create_layers", { ideas: layers });
const sevenLayers = (extra: (n: number) => Record<string, unknown> = () => ({})) => [1, 2, 3, 4, 5, 6, 7].map((n) => layer(n, extra(n)));

/** Answers each call by the tool it asks for. */
function respond(opts: { core?: () => unknown; layers?: () => unknown }) {
  create.mockImplementation(async (args: { tools: { name: string }[] }) => {
    const name = args.tools[0].name;
    if (name === "create_layers") {
      const out = (opts.layers ?? (() => layersAnswer(sevenLayers())))();
      if (out instanceof Error) throw out;
      return out;
    }
    return (opts.core ?? (() => coreAnswer()))();
  });
}

const callsFor = (tool: string) => create.mock.calls.map((c) => c[0]).filter((a) => a.tools[0].name === tool);

beforeEach(() => {
  create.mockReset();
  researchSeeds.mockReset();
  researchSeeds.mockImplementation(async (opts: { activityIds: string[] }) => ({
    byActivity: new Map(
      opts.activityIds.map((id, i) => [
        id,
        {
          activityId: id,
          source: "search",
          options:
            i === 0
              ? [
                  { name: "Steck Utrecht", city: "Utrecht", url: "https://steck.nl", note: "Proefles" },
                  { name: "Kor", city: "Utrecht", url: null, note: "" },
                ]
              : [],
        },
      ]),
    ),
    stats: { cached: 0, searched: opts.activityIds.length, failed: 0, ms: 1 },
  }));
});

async function run() {
  return generateIdeaBookFromSeeds(intake, "nl", computeCharacterProfile(intake), { sessionId: "layers-test" });
}

describe("the R2.3 layers: a second call next to the ideas", () => {
  it("writes the ideas and the layers with two separate calls, each with its own prompt and schema", async () => {
    respond({});
    await run();
    const [core] = callsFor("create_idea_book");
    const [extra] = callsFor("create_layers");
    expect(create).toHaveBeenCalledTimes(2);
    const coreProps = Object.keys(core.tools[0].input_schema.properties.ideas.items.properties);
    expect(coreProps).not.toEqual(expect.arrayContaining(["feels_like"]));
    expect(core.system).not.toContain("feels_like");
    expect(Object.keys(extra.tools[0].input_schema.properties.ideas.items.properties)).toEqual(["feels_like", "sizes", "next_step"]);
    expect(extra.tools[0].input_schema.properties.ideas.minItems).toBe(7);
    // The honesty rules are in the prompt that writes the layers (line breaks do not matter).
    const layersPrompt: string = extra.system.replace(/\s+/g, " ");
    expect(layersPrompt).toContain("ONLY when it appears in THAT idea's verified local options");
    expect(layersPrompt).toContain("Never name an organisation from memory");
    expect(layersPrompt).toContain("never more than ninety minutes");
    expect(layersPrompt).toContain('Write "Gratis" ONLY when');
  });

  it("runs the two calls at the same time, so the layers add no waiting time", async () => {
    // The ideas call only answers once the layers call has been started: written one after the other it never would.
    let layersStarted!: () => void;
    const started = new Promise<void>((resolve) => (layersStarted = resolve));
    create.mockImplementation(async (args: { tools: { name: string }[] }) => {
      if (args.tools[0].name === "create_layers") {
        layersStarted();
        return layersAnswer(sevenLayers());
      }
      await started;
      return coreAnswer();
    });
    const { book } = await run();
    expect(book.ideas[0].feels_like).toBe("Koel 1. Stil.");
  });

  it("keeps what the model wrote for each idea, in the order of the ideas, the wildcard last", async () => {
    respond({});
    const { book } = await run();
    book.ideas.forEach((idea, i) => {
      expect(idea.feels_like).toBe(`Koel ${i + 1}. Stil.`);
      expect(idea.next_step).toBe(`Doe het nog eens ${i + 1}.`);
      expect(idea.sizes?.map((s) => s.kind)).toEqual(["taste", "do", "deepen"]);
    });
    expect(book.wildcard.feels_like).toBe("Koel 7. Stil.");
  });

  it("takes the places from the research, never from the model, and only where research found some", async () => {
    respond({ layers: () => layersAnswer(sevenLayers(() => ({ places: [{ name: "Verzonnen", city: "X", url: null, note: "" }] }))) });
    const { book } = await run();
    const all = [...book.ideas, book.wildcard];
    const withPlaces = all.filter((i) => i.places?.length);
    // The pottery idea itself, plus the idea that is a curated combination with pottery (the providers of both halves count, Stap 125).
    expect(withPlaces.length).toBeGreaterThanOrEqual(1);
    expect(withPlaces.length).toBeLessThanOrEqual(2);
    expect(withPlaces.some((i) => i.activity_id === "pottenbakken")).toBe(true);
    for (const i of withPlaces) expect(i.places?.map((p) => p.name)).toEqual(["Steck Utrecht", "Kor"]);
    expect(all.some((i) => i.places?.some((p) => p.name === "Verzonnen"))).toBe(false);
  });

  it("fills 'also in this direction' by code: never a door of the book, never twice, never more than three", async () => {
    respond({});
    const { book, report } = await run();
    const doors = new Set(report.seeds.map((s) => s.activityId));
    const seen = new Set<string>();
    for (const idea of [...book.ideas, book.wildcard]) {
      expect((idea.related ?? []).length).toBeLessThanOrEqual(3);
      for (const r of idea.related ?? []) {
        expect(doors.has(r.id)).toBe(false);
        expect(seen.has(r.id)).toBe(false);
        seen.add(r.id);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it("leaves a missing or broken layer out and reports why, without failing the book", async () => {
    respond({
      layers: () =>
        layersAnswer([
          layer(1, { feels_like: undefined }),
          layer(2, { sizes: [size(1), size(2)] }),
          layer(3, { next_step: "x".repeat(400) }),
          layer(4, { sizes: undefined, feels_like: undefined, next_step: undefined }),
          layer(5),
          layer(6, { feels_like: 42, sizes: "nope" }),
          layer(7),
        ]),
    });
    const { book, report } = await run();
    expect(report.issues).toContain("idea2:sizes_dropped (2 sizes instead of 3)");
    expect(report.issues).toContain("idea6:sizes_dropped (not a list)");
    expect(book.ideas[0].feels_like).toBeUndefined();
    expect(book.ideas[0].sizes).toHaveLength(3);
    expect(book.ideas[1].sizes).toBeUndefined();
    expect(book.ideas[1].feels_like).toBe("Koel 2. Stil.");
    expect(book.ideas[2].next_step).toBeUndefined();
    expect(book.ideas[3].sizes).toBeUndefined();
    expect(book.ideas[5].feels_like).toBeUndefined();
    expect(book.wildcard.title).toBe("Idee 7");
  });

  it("delivers the book without layers when the layers call fails, and does not try it again", async () => {
    respond({ layers: () => new Error("overloaded") });
    const { book } = await run();
    expect(book.ideas).toHaveLength(6);
    for (const idea of [...book.ideas, book.wildcard]) {
      expect(idea.feels_like).toBeUndefined();
      expect(idea.sizes).toBeUndefined();
      expect(idea.next_step).toBeUndefined();
    }
    // What code fills in does not depend on the model. An activity with few neighbours (knots, say) may have none left
    // once the other doors are excluded, so this asks for most ideas, not every one.
    const withRelated = [...book.ideas, book.wildcard].filter((idea) => idea.related !== undefined).length;
    expect(withRelated).toBeGreaterThanOrEqual(5);
    expect(callsFor("create_layers")).toHaveLength(1);
  });

  it("also delivers the book when the layers call returns the wrong number of entries", async () => {
    respond({ layers: () => layersAnswer(sevenLayers().slice(0, 5)) });
    const { book } = await run();
    expect(book.ideas[0].feels_like).toBeUndefined();
    expect(book.wildcard.title).toBe("Idee 7");
  });

  it("retries only the ideas call when it answers badly, not the layers", async () => {
    let coreCalls = 0;
    respond({
      core: () => {
        coreCalls += 1;
        return coreCalls === 1 ? toolUse("create_idea_book", { ideas: [], wildcard: null }) : coreAnswer();
      },
    });
    const { book } = await run();
    expect(callsFor("create_idea_book")).toHaveLength(2);
    expect(callsFor("create_layers")).toHaveLength(1);
    expect(book.ideas[0].feels_like).toBe("Koel 1. Stil.");
  });
});

describe("an ideas answer that is a near miss is used instead of paid for twice", () => {
  const list = (n: number) => Array.from({ length: n }, (_, i) => entry(i + 1));

  it("accepts seven entries under ideas and no wildcard: the last one is the wildcard", () => {
    const split = splitCoreAnswer({ ideas: list(7) }, 7)!;
    expect(split.ideas).toHaveLength(6);
    expect((split.wildcard as { title: string }).title).toBe("Idee 7");
  });

  it("accepts seven entries and a wildcard: the wildcard that was given is used", () => {
    const given = entry(99);
    const split = splitCoreAnswer({ ideas: list(7), wildcard: given }, 7)!;
    expect(split.ideas).toHaveLength(6);
    expect(split.wildcard).toBe(given);
  });

  it("keeps the normal answer as it is", () => {
    const split = splitCoreAnswer({ ideas: list(6), wildcard: entry(7) }, 7)!;
    expect(split.ideas).toHaveLength(6);
  });

  it("still refuses what cannot be read: too few entries, no list, six entries without a wildcard", () => {
    expect(splitCoreAnswer({ ideas: list(5), wildcard: entry(7) }, 7)).toBeNull();
    expect(splitCoreAnswer({ ideas: list(6) }, 7)).toBeNull();
    expect(splitCoreAnswer({ ideas: "nope" as unknown as unknown[] }, 7)).toBeNull();
    expect(splitCoreAnswer({}, 7)).toBeNull();
  });

  it("makes one ideas call, not two, when the model lists all seven under ideas", async () => {
    respond({ core: () => toolUse("create_idea_book", { profile_summary: "S.", must_haves: [], preferences: [], ideas: list(7) }) });
    const { book } = await run();
    expect(callsFor("create_idea_book")).toHaveLength(1);
    expect(book.ideas).toHaveLength(6);
    expect(book.wildcard.title).toBe("Idee 7");
  });
});
