import { describe, expect, it } from "vitest";
import { ASSOCIATIONS, activityAxes, hasOwnImage } from "@/lib/discovery/associations";
import { TAGS, getActivities } from "@/lib/discovery/library";
import { tagProfile, averageAxes } from "@/lib/discovery/associationProfile";
import { SIDE } from "@/lib/discovery/associationSampling";
import { registerOfActivity, registerOfCard } from "@/lib/discovery/register";
import { hashSeed, mulberry32, shuffled } from "@/lib/discovery/rng";
import { REGISTERS, countRegisters, type Register } from "@/lib/discovery/registerTypes";
import {
  CONCRETE_PAGE_SIZE,
  EXPLORE_SLOTS,
  IMAGES_PAGE_SIZE,
  MAX_IMAGE_PICKS,
  MIN_IMAGE_PICKS,
  MIN_PER_REGISTER,
  composeConcretePage,
  registerMix,
  sampleBalancedBatch,
  type ConcreteActivity,
  type RegisteredCard,
} from "@/lib/discovery/twoPages";

const cards: RegisteredCard[] = ASSOCIATIONS.filter(hasOwnImage).map((c) => ({
  id: c.id,
  family: c.family,
  round: c.round,
  tagWeights: c.tagWeights,
  axes: c.axes,
  register: registerOfCard(c),
}));
const pool: ConcreteActivity[] = getActivities().map((a) => ({
  id: a.id,
  domain: a.domain,
  sub: a.sub,
  register: registerOfActivity(a),
  tags: a.tags,
  axes: activityAxes(a),
}));
const generic = new Set(TAGS.filter((t) => t.generic).map((t) => t.id));
const familyOf = (c: { id: string; family?: string }) => c.family ?? c.id;
const registersOf = (list: { register: Register }[]) => countRegisters(list.map((c) => c.register));

describe("page 1: a balanced batch of images", () => {
  it("shows 18 images, one variant per family, from all three rounds, in a mixed order", () => {
    const batch = sampleBalancedBatch(cards, { seed: "t1" });
    expect(batch).toHaveLength(IMAGES_PAGE_SIZE);
    expect(new Set(batch.map(familyOf)).size).toBe(IMAGES_PAGE_SIZE);
    expect(new Set(batch.map((c) => c.round)).size).toBe(3);
    // Not grouped by round: the first six are not all one round.
    expect(new Set(batch.slice(0, 6).map((c) => c.round)).size).toBeGreaterThan(1);
  });

  it("gives every register at least a quarter (4 of 18), whichever seed", () => {
    for (let i = 0; i < 300; i++) {
      const counts = registersOf(sampleBalancedBatch(cards, { seed: `s${i}` }));
      for (const r of REGISTERS) expect(counts[r], `seed s${i} ${r}`).toBeGreaterThanOrEqual(4);
    }
  });

  it("keeps two feelings on each side of every axis (one for novelty) and every round at 4 or more, as far as the pool allows", () => {
    for (let i = 0; i < 200; i++) {
      const batch = sampleBalancedBatch(cards, { seed: `axes${i}` });
      for (const axis of ["social", "energy", "setting"] as const) {
        expect(batch.filter((c) => c.axes[axis] >= SIDE).length, `${i} ${axis}+`).toBeGreaterThanOrEqual(2);
        expect(batch.filter((c) => c.axes[axis] <= -SIDE).length, `${i} ${axis}-`).toBeGreaterThanOrEqual(2);
      }
      expect(batch.filter((c) => c.axes.novelty >= SIDE).length, `${i} novelty+`).toBeGreaterThanOrEqual(1);
      expect(batch.filter((c) => c.axes.novelty <= -SIDE).length, `${i} novelty-`).toBeGreaterThanOrEqual(1);
      for (const round of ["places", "moments", "senses"] as const) expect(batch.filter((c) => c.round === round).length, `${i} ${round}`).toBeGreaterThanOrEqual(4);
    }
  });

  it("is the same for the same seed and different for another", () => {
    const a = sampleBalancedBatch(cards, { seed: "same" }).map((c) => c.id);
    expect(sampleBalancedBatch(cards, { seed: "same" }).map((c) => c.id)).toEqual(a);
    expect(sampleBalancedBatch(cards, { seed: "other" }).map((c) => c.id)).not.toEqual(a);
  });

  it("does not move another card when one is chosen (the first page does not depend on the choice)", () => {
    const base = sampleBalancedBatch(cards, { seed: "stay" });
    // Choosing is not an input of the first page at all; keeping an image only matters when a new page is built.
    expect(sampleBalancedBatch(cards, { seed: "stay" })).toEqual(base);
  });

  it("'show others' gives a new page without repeating a family, three times over, and keeps what was chosen", () => {
    const first = sampleBalancedBatch(cards, { seed: "r" });
    const chosen = first.slice(0, 3).map((c) => c.id);
    let shown = first.map((c) => c.id);
    const families = new Set(first.map(familyOf));
    const keep = chosen;
    for (let refresh = 1; refresh <= 3; refresh++) {
      const next = sampleBalancedBatch(cards, { seed: "r", refresh, keep, exclude: shown });
      expect(next).toHaveLength(IMAGES_PAGE_SIZE);
      for (const id of keep) expect(next.some((c) => c.id === id), `kept ${id}`).toBe(true);
      const fresh = next.filter((c) => !keep.includes(c.id));
      for (const c of fresh) expect(families.has(familyOf(c)), `repeat ${c.id}`).toBe(false);
      for (const c of fresh) families.add(familyOf(c));
      // The balance holds with the kept images counted in.
      const counts = registersOf(next);
      for (const r of REGISTERS) expect(counts[r], `${refresh} ${r}`).toBeGreaterThanOrEqual(4);
      shown = [...shown, ...next.map((c) => c.id)];
    }
  });

  it("prefers a variant this browser has not seen, and shows the chosen variant", () => {
    const first = sampleBalancedBatch(cards, { seed: "v" });
    const again = sampleBalancedBatch(cards, { seed: "v2", seen: first.map((c) => c.id) });
    const seen = new Set(first.map((c) => c.id));
    // Of the families that came up again, most show a variant that was not seen (families have three variants).
    const families = new Set(first.map(familyOf));
    const repeated = again.filter((c) => families.has(familyOf(c)));
    for (const c of repeated) expect(seen.has(c.id), c.id).toBe(false);
    const kept = sampleBalancedBatch(cards, { seed: "v", keep: [first[0].id] });
    expect(kept.some((c) => c.id === first[0].id)).toBe(true);
  });

  it("still fills a page when the pool is nearly used up", () => {
    const small = cards.filter((c) => ["places", "moments", "senses"].includes(c.round)).slice(0, 90);
    const exclude = small.slice(0, 60).map((c) => c.id);
    const batch = sampleBalancedBatch(small, { seed: "tiny", refresh: 3, exclude });
    expect(batch.length).toBeGreaterThan(0);
    expect(new Set(batch.map(familyOf)).size).toBe(batch.length);
  });
});

describe("the register mix of the chosen images", () => {
  it("counts per register and names the leader only when there is one", () => {
    expect(registerMix([{ register: "expressive" }, { register: "expressive" }, { register: "technical" }]).dominant).toBe("expressive");
    expect(registerMix([{ register: "expressive" }, { register: "technical" }]).dominant).toBeNull();
    expect(registerMix([]).dominant).toBeNull();
    expect(registerMix([{ register: "nature" }]).counts.nature).toBe(1);
  });
});

function pickImages(seed: string, leaning: Register | null, n: number) {
  const batch = sampleBalancedBatch(cards, { seed });
  const rnd = mulberry32(hashSeed(`pick:${seed}`));
  const preferred = leaning ? batch.filter((c) => c.register === leaning) : [];
  const others = shuffled(batch.filter((c) => !preferred.includes(c)), rnd);
  return [...shuffled(preferred, rnd), ...others].slice(0, n);
}

function page2(seed: string, picks: RegisteredCard[], extra: Partial<Parameters<typeof composeConcretePage>[1]> = {}) {
  const ids = picks.map((c) => c.id);
  return composeConcretePage(pool, {
    seed,
    profile: tagProfile(cards, ids),
    axes: averageAxes(cards, ids),
    genericTags: generic,
    mix: registerMix(picks),
    ...extra,
  });
}

describe("page 2: the concrete page that follows from page 1", () => {
  it("shows 18 different activities, three of them exploring, at least 4 domains, at most one per sub-domain among the matched ones", () => {
    const slots = page2("p", pickImages("p", "expressive", 6));
    expect(slots).toHaveLength(CONCRETE_PAGE_SIZE);
    expect(new Set(slots.map((s) => s.activity.id)).size).toBe(CONCRETE_PAGE_SIZE);
    expect(slots.filter((s) => s.explore)).toHaveLength(EXPLORE_SLOTS);
    expect(new Set(slots.map((s) => s.activity.domain)).size).toBeGreaterThanOrEqual(4);
    const matched = slots.filter((s) => !s.explore);
    expect(new Set(matched.map((s) => s.activity.sub)).size).toBe(matched.length);
  });

  it("gives every register at least two of 18 and a third of the page outside the most chosen register, over 1000 simulated visitors", () => {
    const leanings: (Register | null)[] = [...REGISTERS, null];
    for (let i = 0; i < 1000; i++) {
      const leaning = leanings[i % leanings.length];
      const picks = pickImages(`v${i}`, leaning, MIN_IMAGE_PICKS + (i % (MAX_IMAGE_PICKS - MIN_IMAGE_PICKS + 1)));
      const slots = page2(`v${i}`, picks);
      const counts = registersOf(slots.map((s) => s.activity));
      for (const r of REGISTERS) expect(counts[r], `visitor ${i} (${leaning}) ${r}`).toBeGreaterThanOrEqual(MIN_PER_REGISTER);
      const mix = registerMix(picks);
      const dominant = mix.dominant ?? REGISTERS.reduce((best, r) => (counts[r] > counts[best] ? r : best), REGISTERS[0]);
      expect(CONCRETE_PAGE_SIZE - counts[dominant], `visitor ${i} outside ${dominant}`).toBeGreaterThanOrEqual(CONCRETE_PAGE_SIZE / 3);
    }
  });

  it("follows the mix: a page 1 chosen almost entirely from one register leans to that register on page 2, without excluding the rest", () => {
    for (const r of REGISTERS) {
      let own = 0;
      let runs = 0;
      for (let i = 0; i < 40; i++) {
        const picks = pickImages(`lean-${r}-${i}`, r, 7);
        if (registerMix(picks).dominant !== r) continue;
        own += registersOf(page2(`lean-${r}-${i}`, picks).map((s) => s.activity))[r];
        runs += 1;
      }
      expect(runs).toBeGreaterThan(20);
      // Well above the even quarter (4.5 of 18): about half the page when ~70% of the images were from it (the plan's
      // example is 55%), and clearly less than everything.
      expect(own / runs, r).toBeGreaterThan(8);
      expect(own / runs, r).toBeLessThan(13);
    }
  });

  it("lies closer to the chosen images than a random page would, in the shared tags", () => {
    const picks = pickImages("close", "technical", 7);
    const profile = tagProfile(cards, picks.map((c) => c.id));
    const close = (a: ConcreteActivity) => a.tags.reduce((s, t) => s + (profile[t] ?? 0), 0) / Math.sqrt(a.tags.length);
    const slots = page2("close", picks).filter((s) => !s.explore);
    const matchedAvg = slots.reduce((s, x) => s + close(x.activity), 0) / slots.length;
    const poolAvg = pool.reduce((s, a) => s + close(a), 0) / pool.length;
    expect(matchedAvg).toBeGreaterThan(poolAvg * 1.3);
  });

  it("puts the exploring slots in other domains than the matched ones where the pool allows, and in other registers than the mix leans to", () => {
    let withNewDomain = 0;
    let outsideLean = 0;
    let total = 0;
    for (let i = 0; i < 100; i++) {
      const picks = pickImages(`ex${i}`, "technical", 7);
      const mix = registerMix(picks);
      const slots = page2(`ex${i}`, picks);
      const matchedDomains = new Set(slots.filter((s) => !s.explore).map((s) => s.activity.domain));
      for (const s of slots.filter((x) => x.explore)) {
        total += 1;
        if (!matchedDomains.has(s.activity.domain)) withNewDomain += 1;
        if (mix.dominant && s.activity.register !== mix.dominant) outsideLean += 1;
      }
    }
    expect(withNewDomain / total).toBeGreaterThan(0.9);
    expect(outsideLean / total).toBeGreaterThan(0.95);
  });

  it("is the same for the same seed, and 'show others' gives a page without repeats that keeps the chosen activities", () => {
    const picks = pickImages("again", "nurturing", 6);
    const a = page2("again", picks).map((s) => s.activity.id);
    expect(page2("again", picks).map((s) => s.activity.id)).toEqual(a);
    const keep = a.slice(0, 2);
    const next = page2("again", picks, { refresh: 1, exclude: a, keep }).map((s) => s.activity.id);
    expect(next).toHaveLength(CONCRETE_PAGE_SIZE);
    for (const id of keep) expect(next).toContain(id);
    const repeats = next.filter((id) => a.includes(id) && !keep.includes(id));
    expect(repeats).toEqual([]);
    // Still balanced with the kept ones counted in.
    const counts = registersOf(next.map((id) => pool.find((p) => p.id === id)!));
    for (const r of REGISTERS) expect(counts[r]).toBeGreaterThanOrEqual(MIN_PER_REGISTER);
  });

  it("copes with nothing chosen on page 1: an even page", () => {
    const slots = composeConcretePage(pool, { seed: "none", profile: {}, mix: registerMix([]), genericTags: generic });
    expect(slots).toHaveLength(CONCRETE_PAGE_SIZE);
    const counts = registersOf(slots.map((s) => s.activity));
    for (const r of REGISTERS) expect(counts[r]).toBeGreaterThanOrEqual(MIN_PER_REGISTER);
  });

  it("still fills a page from a small pool", () => {
    const small = pool.slice(0, 30);
    const slots = composeConcretePage(small, { seed: "small", profile: {}, mix: registerMix([]), exclude: small.slice(0, 15).map((a) => a.id) });
    expect(slots.length).toBeGreaterThan(10);
    expect(new Set(slots.map((s) => s.activity.id)).size).toBe(slots.length);
  });
});
