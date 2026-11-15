import { describe, expect, it } from "vitest";
import { fillFromReserve, reserveExclusions, reserveFrom } from "@/lib/claude/searchPlan";
import type { Direction, Seed } from "@/lib/discovery/engine/types";

// Search Engine 2.0 (Stap 200): the choosing among a researched reserve, in plain code. No model, no network.

const seed = (activityId: string, direction: Direction, extra: Partial<Seed> = {}): Seed => ({
  activityId,
  direction,
  door: direction === "wildcard" ? "wildcard" : direction === "familiar" ? "natural" : direction === "adjacent" ? "discovery" : direction === "unexpected" ? "unexpected" : "stretch",
  chain: [activityId],
  via: [],
  lead: null,
  alsoFormats: [],
  verify: [],
  ...extra,
});
const WORLD: Record<string, string> = { a: "w1", b: "w2", c: "w3", d: "w4", e: "w5", a2: "w1", b2: "w2", c2: "w3", d2: "w4", e2: "w5", a3: "w1", c3: "w1" };
const domainOf = (id: string) => WORLD[id];
const book = [seed("a", "familiar"), seed("b", "adjacent"), seed("c", "unexpected"), seed("d", "stretch"), seed("e", "wildcard")];
const reserve = [seed("a2", "familiar"), seed("b2", "adjacent"), seed("c2", "unexpected"), seed("d2", "stretch"), seed("e2", "wildcard")];
const hasIn = (ids: string[]) => (s: Seed) => ids.includes(s.activityId);
const base = { ownPicks: new Set<string>(), domainOf };

describe("the reserve", () => {
  it("leaves alone the ideas of the book and the other half of its combinations", () => {
    const combo = seed("brieven", "unexpected", { hybrid: { partnerId: "vulpennen", label: { nl: "x", en: "x" } } });
    expect(reserveExclusions([seed("a", "familiar"), combo]).sort()).toEqual(["a", "brieven", "vulpennen"]);
    const picked = [seed("a", "familiar"), seed("vulpennen", "adjacent"), seed("z", "stretch")];
    expect(reserveFrom([seed("a", "familiar"), combo], picked).map((s) => s.activityId)).toEqual(["z"]);
  });
});

describe("fillFromReserve", () => {
  it("changes nothing when every idea has a real place", () => {
    const r = fillFromReserve({ ...base, seeds: book, reserve, hasOption: (s) => ["a", "b", "c", "d", "e"].includes(s.activityId) });
    expect(r.swaps).toEqual([]);
    expect(r.seeds.map((s) => s.activityId)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("swaps an idea without a place for the reserve idea of the same direction that has one, in the same position", () => {
    const r = fillFromReserve({ ...base, seeds: book, reserve, hasOption: hasIn(["a", "b", "c2", "d", "e", "c"].filter((x) => x !== "c")) });
    expect(r.swaps).toEqual([{ out: "c", in: "c2" }]);
    expect(r.seeds.map((s) => s.activityId)).toEqual(["a", "b", "c2", "d", "e"]);
    expect(r.seeds[2].direction).toBe("unexpected");
  });

  it("keeps the level of the slot, and never mutates its input", () => {
    const withLevel = book.map((s, i) => ({ ...s, level: (i + 1) as Seed["level"] }));
    const r = fillFromReserve({ ...base, seeds: withLevel, reserve, hasOption: hasIn(["a", "b", "d", "e", "d2", "c2"]) });
    expect(r.seeds[2].level).toBe(3);
    expect(withLevel[2].activityId).toBe("c");
  });

  it("never takes a reserve idea of another direction: the book keeps its shape", () => {
    const r = fillFromReserve({ ...base, seeds: book, reserve, hasOption: hasIn(["a", "b", "d", "e", "d2", "b2"]) });
    expect(r.swaps).toEqual([]);
    expect(r.seeds.map((s) => s.activityId)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("does not take a reserve idea that would be the same idea twice, or a third from one world", () => {
    const combo = seed("c2", "unexpected", { hybrid: { partnerId: "a", label: { nl: "x", en: "x" } } });
    // c2 is a combination whose half is the familiar idea of the book: refused.
    expect(fillFromReserve({ ...base, seeds: book, reserve: [combo], hasOption: hasIn(["a", "b", "d", "e", "c2"]) }).swaps).toEqual([]);
    // a3 and c3 are both in world w1 with "a": a book would then hold three ideas of w1.
    const crowded = [seed("a", "familiar"), seed("a3", "adjacent"), seed("c", "unexpected"), seed("d", "stretch"), seed("e", "wildcard")];
    const r = fillFromReserve({ ...base, seeds: crowded, reserve: [seed("c3", "unexpected")], hasOption: hasIn(["a", "a3", "d", "e", "c3"]) });
    expect(r.swaps).toEqual([]);
  });

  it("offers a lacking choice of the person's own another choice of theirs first", () => {
    const own = new Set(["a", "a2", "a4"]);
    const pool = [seed("a4", "familiar"), seed("a2", "familiar")];
    const w = { a4: "w9", a2: "w1" };
    const r = fillFromReserve({ ...base, ownPicks: own, domainOf: (id) => (w as Record<string, string>)[id] ?? WORLD[id], seeds: [seed("a", "familiar"), ...book.slice(1)], reserve: [seed("x", "familiar"), ...pool], hasOption: hasIn(["b", "c", "d", "e", "x", "a4", "a2"]) });
    expect(r.swaps).toEqual([{ out: "a", in: "a4" }]); // "x" comes first in the selection but is not a choice of theirs
  });

  it("chooses the better rated of two reserve ideas that qualify, and the first of the selection on a tie", () => {
    const two = [seed("c2", "unexpected"), seed("c3", "unexpected")];
    const rated = fillFromReserve({ ...base, domainOf: (id) => (id === "c3" ? "w9" : WORLD[id]), seeds: book, reserve: two, hasOption: hasIn(["a", "b", "d", "e", "c2", "c3"]), quality: (s) => (s.activityId === "c3" ? 4.6 : 4.1) });
    expect(rated.swaps).toEqual([{ out: "c", in: "c3" }]);
    const tie = fillFromReserve({ ...base, domainOf: (id) => (id === "c3" ? "w9" : WORLD[id]), seeds: book, reserve: two, hasOption: hasIn(["a", "b", "d", "e", "c2", "c3"]) });
    expect(tie.swaps).toEqual([{ out: "c", in: "c2" }]);
  });

  it("uses every reserve idea once, and the place rule is judged inside the book it would join", () => {
    const seen: string[][] = [];
    fillFromReserve({
      ...base,
      seeds: book,
      reserve,
      hasOption: (s, b) => {
        seen.push(b.map((x) => x.activityId));
        return ["a", "b", "d", "e", "c2"].includes(s.activityId);
      },
    });
    // the reserve idea was asked about inside the book in which it takes the place of "c"
    expect(seen.some((b) => b.join() === "a,b,c2,d,e")).toBe(true);
  });
});
