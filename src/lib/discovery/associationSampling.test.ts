import { describe, expect, it } from "vitest";
import { ASSOCIATIONS } from "@/lib/discovery/associations";
import { ASSOCIATION_ROUNDS } from "@/lib/discovery/associationProfile";
import { ENOUGH_PER_SIDE, mergeSeen, sampleRoundCards, sampleWorldExamples, SEEN_CAP } from "@/lib/discovery/associationSampling";

const cards = ASSOCIATIONS;
const ids = (list: { id: string }[]) => list.map((c) => c.id);
const familyOf = (c: { id: string; family?: string }) => c.family ?? c.id;

describe("sampleRoundCards", () => {
  it("shows nine cards a round, one variant of nine different families", () => {
    for (const round of ASSOCIATION_ROUNDS) {
      const deck = sampleRoundCards(cards, round, { seed: "a" });
      expect(deck).toHaveLength(9);
      expect(new Set(deck.map(familyOf)).size).toBe(9);
      expect(deck.every((c) => c.round === round)).toBe(true);
    }
  });

  it("draws the nine from a pool of twelve families a round, and every family comes up now and then", () => {
    for (const round of ASSOCIATION_ROUNDS) {
      const families = new Set(cards.filter((c) => c.round === round).map(familyOf));
      expect(families.size).toBe(12);
      const shown = new Map<string, number>();
      for (let i = 0; i < 200; i++) for (const c of sampleRoundCards(cards, round, { seed: `pool${i}` })) shown.set(familyOf(c), (shown.get(familyOf(c)) ?? 0) + 1);
      expect(new Set(shown.keys())).toEqual(families);
      // About 150 of 200 sessions each (9 of 12), allowing for the repair step.
      for (const n of shown.values()) expect(n).toBeGreaterThan(90);
    }
  });

  it("never gives a one-sided round: each axis has at least two feelings on both sides (one for novelty), as far as the pool has them", () => {
    for (const round of ASSOCIATION_ROUNDS) {
      const pool = cards.filter((c) => c.round === round && familyOf(c) === c.id);
      for (let i = 0; i < 300; i++) {
        const deck = sampleRoundCards(cards, round, { seed: `cover${i}` });
        for (const axis of ["social", "energy", "setting", "novelty"] as const) {
          for (const sign of [1, -1]) {
            const need = Math.min(axis === "novelty" ? 1 : ENOUGH_PER_SIDE, pool.filter((c) => c.axes[axis] * sign >= 0.3).length);
            expect(deck.filter((c) => c.axes[axis] * sign >= 0.3).length).toBeGreaterThanOrEqual(need);
          }
        }
      }
    }
  });

  it("is deterministic for a seed, so a refresh shows the same cards in the same order", () => {
    expect(ids(sampleRoundCards(cards, "places", { seed: "x" }))).toEqual(ids(sampleRoundCards(cards, "places", { seed: "x" })));
  });

  it("varies between sessions: other seeds show other images and another order", () => {
    const base = ids(sampleRoundCards(cards, "places", { seed: "s0" }));
    let overlaps = 0;
    let orderChanges = 0;
    for (let i = 1; i <= 20; i++) {
      const other = ids(sampleRoundCards(cards, "places", { seed: `s${i}` }));
      overlaps += other.filter((id) => base.includes(id)).length;
      if (other.join() !== base.join()) orderChanges++;
    }
    // Nine of twelve families and three variants each: far from the same nine images every time.
    expect(overlaps / 20).toBeLessThan(5);
    expect(orderChanges).toBeGreaterThanOrEqual(19);
  });

  it("keeps the same ground covered whatever is shown (same families, same axes)", () => {
    const reference = new Map(cards.filter((c) => c.round === "moments").map((c) => [familyOf(c), JSON.stringify(c.axes)]));
    for (let i = 0; i < 10; i++) {
      for (const c of sampleRoundCards(cards, "moments", { seed: `v${i}` })) expect(JSON.stringify(c.axes)).toBe(reference.get(familyOf(c)));
    }
  });

  it("prefers images this browser has not seen, and then the ones seen longest ago", () => {
    const deckOf = (seed: string, seen: string[] = []) => sampleRoundCards(cards, "senses", { seed, seen });
    const first = deckOf("one");
    const second = deckOf("two", ids(first));
    // A family shown in both decks shows another variant the second time.
    const inFirst = new Map(first.map((c) => [familyOf(c), c.id]));
    for (const c of second) if (inFirst.has(familyOf(c))) expect(c.id).not.toBe(inFirst.get(familyOf(c)));
    const third = deckOf("three", [...ids(first), ...ids(second)]);
    const earlier = new Set([...ids(first), ...ids(second)]);
    for (const c of third) {
      // Once every variant of a family was seen, the oldest comes back; before that, never a seen one.
      const variants = cards.filter((x) => familyOf(x) === familyOf(c)).map((x) => x.id);
      if (variants.some((v) => !earlier.has(v))) expect(earlier.has(c.id)).toBe(false);
    }
    // All three variants of the families seen: the one seen longest ago comes back first.
    const seenAll = cards.filter((c) => c.round === "senses").map((c) => c.id);
    const fourth = deckOf("four", seenAll);
    for (const c of fourth) expect(seenAll.indexOf(c.id)).toBe(Math.min(...cards.filter((x) => familyOf(x) === familyOf(c)).map((x) => seenAll.indexOf(x.id))));
  });

  it("keeps a chosen variant visible, also when it was not the preferred one", () => {
    const chosen = cards.find((c) => c.id === "place-forest-edge-c")!;
    const deck = sampleRoundCards(cards, "places", { seed: "k", seen: [chosen.id], keep: [chosen.id] });
    expect(ids(deck)).toContain(chosen.id);
    expect(deck.filter((c) => familyOf(c) === "place-forest-edge")).toHaveLength(1);
  });

  it("does not move any card when the visitor picks one: same families in the same places", () => {
    const seed = "stay";
    const before = sampleRoundCards(cards, "places", { seed });
    const keep: string[] = [];
    for (const card of before) {
      keep.push(card.id);
      const after = sampleRoundCards(cards, "places", { seed, keep });
      expect(ids(after)).toEqual(ids(before));
    }
  });
});

describe("mergeSeen", () => {
  it("moves shown ids to the end without duplicates and stays within the cap", () => {
    expect(mergeSeen(["a", "b", "c"], ["b", "d"])).toEqual(["a", "c", "b", "d"]);
    const long = Array.from({ length: SEEN_CAP + 30 }, (_, i) => `id${i}`);
    expect(mergeSeen(long, ["new"])).toHaveLength(SEEN_CAP);
    expect(mergeSeen(long, ["new"]).at(-1)).toBe("new");
  });
});

describe("sampleWorldExamples (the examples on a direction card)", () => {
  const examples = [
    { label: "Boogschieten", sub: "precision" },
    { label: "Schietles", sub: "precision" },
    { label: "Kleiduifschieten", sub: "precision" },
    { label: "Boulderen", sub: "climbing" },
    { label: "Via ferrata", sub: "climbing" },
    { label: "Kanoën", sub: "water" },
    { label: "Zwemmen", sub: "water" },
    { label: "Hardlopen", sub: "endurance" },
  ];

  it("gives three examples, from different sub-domains while there are enough, without repeats", () => {
    for (let i = 0; i < 50; i++) {
      const out = sampleWorldExamples(examples, `s${i}`, "movement");
      expect(out).toHaveLength(3);
      expect(new Set(out).size).toBe(3);
      const subs = out.map((l) => examples.find((e) => e.label === l)!.sub);
      expect(new Set(subs).size).toBe(3);
    }
  });

  it("is the same for the same seed and changes between sessions, so every activity gets its turn", () => {
    expect(sampleWorldExamples(examples, "x", "movement")).toEqual(sampleWorldExamples(examples, "x", "movement"));
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) for (const l of sampleWorldExamples(examples, `v${i}`, "movement")) seen.add(l);
    expect(seen.size).toBe(examples.length);
  });

  it("copes with few or no activities", () => {
    expect(sampleWorldExamples([], "x", "w")).toEqual([]);
    expect(sampleWorldExamples(examples.slice(0, 2), "x", "w")).toHaveLength(2);
  });
});
