import { describe, expect, it } from "vitest";
import { ASSOCIATIONS } from "@/lib/discovery/associations";
import { ASSOCIATION_ROUNDS } from "@/lib/discovery/associationProfile";
import { mergeSeen, sampleRoundCards, SEEN_CAP } from "@/lib/discovery/associationSampling";

const cards = ASSOCIATIONS;
const ids = (list: { id: string }[]) => list.map((c) => c.id);
const familyOf = (c: { id: string; family?: string }) => c.family ?? c.id;

describe("sampleRoundCards", () => {
  it("shows exactly one variant of every family, nine cards a round", () => {
    for (const round of ASSOCIATION_ROUNDS) {
      const deck = sampleRoundCards(cards, round, { seed: "a" });
      expect(deck).toHaveLength(9);
      expect(new Set(deck.map(familyOf)).size).toBe(9);
      expect(deck.every((c) => c.round === round)).toBe(true);
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
    // Three variants per family: about a third of the images repeat by chance, not all of them.
    expect(overlaps / 20).toBeLessThan(6);
    expect(orderChanges).toBeGreaterThanOrEqual(19);
  });

  it("keeps the same ground covered whatever is shown (same families, same axes)", () => {
    const reference = new Map(cards.filter((c) => c.round === "moments").map((c) => [familyOf(c), JSON.stringify(c.axes)]));
    for (let i = 0; i < 10; i++) {
      for (const c of sampleRoundCards(cards, "moments", { seed: `v${i}` })) expect(JSON.stringify(c.axes)).toBe(reference.get(familyOf(c)));
    }
  });

  it("prefers images this browser has not seen, and then the ones seen longest ago", () => {
    const first = sampleRoundCards(cards, "senses", { seed: "one" });
    const second = sampleRoundCards(cards, "senses", { seed: "two", seen: ids(first) });
    expect(second.filter((c) => ids(first).includes(c.id))).toEqual([]);
    const third = sampleRoundCards(cards, "senses", { seed: "three", seen: [...ids(first), ...ids(second)] });
    expect(third.filter((c) => ids(first).includes(c.id) || ids(second).includes(c.id))).toEqual([]);
    // All three variants seen: the oldest comes back first.
    const fourth = sampleRoundCards(cards, "senses", { seed: "four", seen: [...ids(first), ...ids(second), ...ids(third)] });
    expect(ids(fourth).sort()).toEqual(ids(first).sort());
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
