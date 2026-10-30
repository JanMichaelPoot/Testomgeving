import { describe, expect, it } from "vitest";
import {
  LAYER_LIMITS,
  hasMoreLayers,
  normalizeFeelsLike,
  normalizeNextStep,
  normalizePlaces,
  normalizeRelated,
  normalizeSizes,
  readStoredLayers,
} from "@/lib/claude/ideaLayers";

const size = (n: number) => ({ title: `Maat ${n}`, description: "Een zin over deze maat.", estimated_cost: "Gratis", duration: "1 uur" });
const three = [size(1), size(2), size(3)];

describe("normalizeSizes", () => {
  it("accepts exactly three complete sizes and gives them their fixed kinds", () => {
    expect(normalizeSizes(three)?.map((s) => s.kind)).toEqual(["taste", "do", "deepen"]);
  });

  it("drops the whole layer when one is missing, incomplete or too long", () => {
    expect(normalizeSizes(three.slice(0, 2))).toBeUndefined();
    expect(normalizeSizes([...three, size(4)])).toBeUndefined();
    expect(normalizeSizes([three[0], three[1], { ...three[2], duration: "" }])).toBeUndefined();
    expect(normalizeSizes([three[0], three[1], { ...three[2], description: "x".repeat(LAYER_LIMITS.size_description + 1) }])).toBeUndefined();
    expect(normalizeSizes([three[0], null, three[2]])).toBeUndefined();
    expect(normalizeSizes(undefined)).toBeUndefined();
    expect(normalizeSizes("nope")).toBeUndefined();
  });
});

describe("feels_like and next_step", () => {
  it("keep a good text and drop empty, missing or over-long ones (never cut)", () => {
    expect(normalizeFeelsLike("  Koel water. Zacht licht.  ")).toBe("Koel water. Zacht licht.");
    expect(normalizeFeelsLike("")).toBeUndefined();
    expect(normalizeFeelsLike(undefined)).toBeUndefined();
    expect(normalizeFeelsLike(42)).toBeUndefined();
    expect(normalizeFeelsLike("x".repeat(LAYER_LIMITS.feels_like + 1))).toBeUndefined();
    expect(normalizeNextStep("Boek een tweede les.")).toBe("Boek een tweede les.");
    expect(normalizeNextStep("x".repeat(LAYER_LIMITS.next_step + 1))).toBeUndefined();
  });
});

describe("places and related", () => {
  it("keep at most three distinct places and only real web addresses", () => {
    const places = normalizePlaces([
      { name: "Steck", city: "Utrecht", url: "https://steck.nl", note: "Proefles" },
      { name: "steck", city: "utrecht", url: null, note: "dubbel" },
      { name: "Kor", city: "Utrecht", url: "javascript:alert(1)", note: "" },
      { name: "A", city: "x", url: null, note: "" },
      { name: "B", city: "x", url: null, note: "" },
    ]);
    expect(places.map((p) => p.name)).toEqual(["Steck", "Kor", "A"]);
    expect(places[1].url).toBeNull();
  });

  it("related needs an id and a label", () => {
    expect(normalizeRelated([{ id: "a", label: "A" }, { id: "b" }, { label: "c" }, null])).toEqual([{ id: "a", label: "A" }]);
    expect(normalizeRelated("x")).toEqual([]);
  });
});

describe("readStoredLayers / hasMoreLayers", () => {
  it("gives an empty result for an old idea, so old books keep working", () => {
    const layers = readStoredLayers({ title: "Oud idee", intro: "x" });
    expect(layers).toEqual({});
    expect(hasMoreLayers(layers)).toBe(false);
    expect(readStoredLayers(null)).toEqual({});
  });

  it("keeps the valid layers and drops the invalid ones independently", () => {
    const layers = readStoredLayers({ feels_like: "Warm.", sizes: three.slice(0, 1), next_step: "Doe het nog eens.", places: [{ name: "Steck", city: "Utrecht" }] });
    expect(layers.feels_like).toBe("Warm.");
    expect(layers.sizes).toBeUndefined();
    expect(layers.next_step).toBe("Doe het nog eens.");
    expect(layers.places).toHaveLength(1);
    expect(hasMoreLayers(layers)).toBe(true);
  });
});

import { pdfPageNumbers, withValidLayers, type IdeaLayers } from "@/lib/claude/ideaLayers";

describe("pdfPageNumbers", () => {
  const layered = { feels_like: "Koel." };
  it("is the old numbering when no idea has a layer", () => {
    expect(pdfPageNumbers([{}, {}, {}])).toEqual({ ideas: [3, 4, 5], wildcard: 6 });
  });

  it("pushes later pages on by one for every idea that has a second page", () => {
    expect(pdfPageNumbers([layered, {}, layered, {}])).toEqual({ ideas: [3, 5, 6, 8], wildcard: 9 });
  });
});

describe("withValidLayers", () => {
  it("removes a broken layer and keeps everything else on the idea", () => {
    const entry = { title: "T", sizes: [1, 2], feels_like: "Koel.", places: "x" } as unknown as { title: string } & IdeaLayers;
    const out = withValidLayers(entry);
    expect(out.title).toBe("T");
    expect(out.feels_like).toBe("Koel.");
    expect("sizes" in out).toBe(false);
    expect("places" in out).toBe(false);
  });
});
