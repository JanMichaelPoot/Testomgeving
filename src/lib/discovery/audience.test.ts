import { describe, expect, it } from "vitest";
import type { StoredIntake } from "@/app/intake/actions";
import { applyImageIntake } from "@/lib/discovery/imageIntake";
import { runEngine } from "@/lib/discovery/engine";
import { ASSOCIATIONS, activityAxes, hasOwnImage } from "@/lib/discovery/associations";
import { TAGS, getActivities } from "@/lib/discovery/library";
import { registerOfActivity, registerOfCard } from "@/lib/discovery/register";
import { REGISTERS, countRegisters } from "@/lib/discovery/registerTypes";
import { IMAGES_PAGE_SIZE, composeConcretePage, sampleBalancedBatch, type ConcreteActivity, type RegisteredCard } from "@/lib/discovery/twoPages";
import {
  MINOR_UNSUITABLE,
  activityContextLean,
  allowedForContext,
  audienceBias,
  buildAudienceProfile,
  cardContextLean,
  describeAudienceForPrompt,
  effectiveAgeCategory,
  imagePreference,
  isForOther,
  normalizeSearchContext,
} from "@/lib/discovery/audience";
import { TWO_PAGE_LAYOUT, TWO_PAGE_PAGES, migrateTwoPageDraft } from "@/lib/vensterPages";
import { passesConstraints, resolveConstraints, engineInputFromIntake } from "@/lib/discovery/engine";

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

const base = {
  situation: "",
  purpose: "self",
  purposeFollowUp: "",
  ageCategory: "",
  location: "Utrecht",
  searchDistance: "hour",
  freeTimePattern: "",
  practicalToWild: "either",
  timeAvailable: "",
  budget: "",
  effort: "some",
  solutionTypes: [],
  mustHaves: "",
  preferences: "",
  company: [],
  personalReflection: "",
  socialFormats: [],
  surpriseMe: false,
  intakeVariant: "associations",
  intakeFlow: "images2",
  associations: ["place-forest-edge", "place-still-water", "moment-stillness", "sense-grass"],
  associationCorrections: [],
  locale: "nl",
} as unknown as StoredIntake;

describe("the search context", () => {
  it("normalises anything unknown to 'unknown' and supports every context of the brief", () => {
    for (const c of ["self", "child", "adult", "group", "unknown"]) expect(normalizeSearchContext(c)).toBe(c);
    // "senior" was a choice until Step 135; an old draft or session that holds it reads as another adult.
    expect(normalizeSearchContext("senior")).toBe("adult");
    for (const bad of [undefined, null, "", "teenager", 7, "CHILD"]) expect(normalizeSearchContext(bad)).toBe("unknown");
  });

  it("separates the context from the age: 'for myself' says nothing about age, only 'child' gives a soft default, an explicit age wins", () => {
    expect(effectiveAgeCategory({ searchContext: "self" })).toBe("");
    expect(effectiveAgeCategory({ searchContext: "adult" })).toBe("");
    expect(effectiveAgeCategory({ searchContext: "group" })).toBe("");
    expect(effectiveAgeCategory({ searchContext: "child" })).toBe("under18");
    expect(effectiveAgeCategory({ searchContext: "senior" })).toBe("");
    expect(effectiveAgeCategory({ searchContext: "child", ageCategory: "18-24" })).toBe("18-24");
  });

  it("is 'for somebody else' for a gift and for every context but 'self' and 'unknown'", () => {
    expect(isForOther({ purpose: "gift" })).toBe(true);
    expect(isForOther({ purpose: "self", searchContext: "child" })).toBe(true);
    expect(isForOther({ purpose: "self", searchContext: "group" })).toBe(true);
    expect(isForOther({ purpose: "self", searchContext: "self" })).toBe(false);
    expect(isForOther({ purpose: "self" })).toBe(false);
    expect(isForOther({ purpose: "self", searchContext: "unknown" })).toBe(false);
  });
});

describe("what is offered to whom", () => {
  it("keeps alcohol, gambling, weapons and heavy tools away from a search for a child or young person, and only then", () => {
    const activities = getActivities();
    for (const id of MINOR_UNSUITABLE) expect(activities.some((a) => a.id === id), `${id} is not in the library`).toBe(true);
    for (const a of activities) {
      const blocked = !allowedForContext(a, "child");
      expect(blocked).toBe(MINOR_UNSUITABLE.has(a.id));
      expect(allowedForContext(a, "group")).toBe(true);
      expect(allowedForContext(a, undefined)).toBe(true);
    }
  });

  it("makes the engine refuse such an activity for a child, even when it was picked", () => {
    const wine = getActivities().find((a) => a.id === "wijnproeverij")!;
    const input = { ...engineInputFromIntake({ ...base, ageCategory: "", interests: [], searchContext: "child", budget: "allin" } as StoredIntake, { seed: "s" }), searchContext: "child" };
    expect(passesConstraints(wine, resolveConstraints(input)).ok).toBe(false);
    expect(passesConstraints(wine, resolveConstraints({ ...input, searchContext: "adult" })).ok).toBe(true);
  });

  it("never selects an activity that is not for minors in a book for a child (200 different visitors)", () => {
    for (let i = 0; i < 200; i++) {
      const out = applyImageIntake({ ...base, searchContext: "child", associations: cards.slice(i % 40, (i % 40) + 4).map((c) => c.id) }, "nl", `seed-${i}`, 6);
      const result = runEngine(engineInputFromIntake(out, { seed: `seed-${i}`, month: 6 }));
      for (const s of result.seeds) expect(allowedForContext({ id: s.activityId, tags: getActivities().find((a) => a.id === s.activityId)!.tags }, "child"), s.activityId).toBe(true);
    }
  });

  it("nudges a group to things that can be done together, and nothing else", () => {
    expect(audienceBias({ formats: ["small_group"] }, "group")).toBeLessThan(0);
    expect(audienceBias({ formats: ["solo"] }, "group")).toBeGreaterThan(0);
    expect(audienceBias({ formats: null }, "group")).toBe(0);
    expect(audienceBias({ formats: ["solo"] }, "adult")).toBe(0);
  });
});

describe("the first and the follow-up images", () => {
  const lean = (ctx: string) => (card: { tagWeights: Record<string, number> }, index: number) => imagePreference(card, { context: ctx, chosenTags: {}, refresh: 0, index });
  const meanLean = (ids: string[], ctx: string) => ids.reduce((s, id) => s + cardContextLean(cards.find((c) => c.id === id)!.tagWeights, ctx), 0) / ids.length;

  it("leans the first page to the context without making it one-sided: every register keeps its floor, and part of the page does not lean at all", () => {
    for (const ctx of ["child", "group"]) {
      let leanMore = 0;
      let spreadTotal = 0;
      for (let i = 0; i < 40; i++) {
        const plain = sampleBalancedBatch(cards, { seed: `s${i}` }).map((c) => c.id);
        const leaned = sampleBalancedBatch(cards, { seed: `s${i}`, prefer: lean(ctx) });
        expect(leaned).toHaveLength(IMAGES_PAGE_SIZE);
        const counts = countRegisters(leaned.map((c) => c.register));
        for (const r of REGISTERS) expect(counts[r], `${ctx} ${r}`).toBeGreaterThanOrEqual(Math.floor(IMAGES_PAGE_SIZE / 4));
        if (meanLean(leaned.map((c) => c.id), ctx) > meanLean(plain, ctx)) leanMore++;
        // Diversity: every other place is left to chance, so on average at least six and a half (never fewer than three) of the eighteen lie below the top quarter of the pool for that lean.
        const sorted = cards.map((c) => cardContextLean(c.tagWeights, ctx)).sort((x, y) => x - y);
        const top = sorted[Math.floor(sorted.length * 0.75)];
        const spread = leaned.filter((c) => cardContextLean(c.tagWeights, ctx) < top).length;
        expect(spread, `${ctx} seed ${i}`).toBeGreaterThanOrEqual(3);
        spreadTotal += spread;
      }
      expect(leanMore, ctx).toBeGreaterThan(30);
      expect(spreadTotal / 40, ctx).toBeGreaterThanOrEqual(6.5);
    }
  });

  it("is deterministic for a seed, and 'for myself' / 'another adult' / unknown have no lean at all", () => {
    const a = sampleBalancedBatch(cards, { seed: "x", prefer: lean("child") }).map((c) => c.id);
    const b = sampleBalancedBatch(cards, { seed: "x", prefer: lean("child") }).map((c) => c.id);
    expect(a).toEqual(b);
    for (const ctx of ["self", "adult", "unknown"]) for (const c of cards) expect(cardContextLean(c.tagWeights, ctx)).toBe(0);
  });

  it("deepens what was chosen on one card and opens something new on the next (the follow-up page)", () => {
    const chosenTags = { making: 3, craft: 2 };
    const near: { tagWeights: Record<string, number> } = { tagWeights: { making: 1 } };
    const far: { tagWeights: Record<string, number> } = { tagWeights: { speed: 1 } };
    const at = (card: typeof near, index: number) => imagePreference(card, { context: "adult", chosenTags, refresh: 1, index });
    expect(at(near, 0)).toBeGreaterThan(at(far, 0)); // even positions: close to the choices
    expect(at(far, 1)).toBeGreaterThan(at(near, 1)); // odd positions: something not chosen yet
    // The first page has no choices to deepen: only the context counts.
    expect(imagePreference(near, { context: "adult", chosenTags, refresh: 0, index: 0 })).toBe(0.5);
  });

  it("leans the activities page to the context too, as a small addition and never a filter", () => {
    const prefer = (a: ConcreteActivity) => 0.5 + activityContextLean(a.tags, "child");
    const page = composeConcretePage(pool.filter((a) => allowedForContext(a, "child")), { seed: "z", profile: { making: 3 }, mix: { counts: { expressive: 2, nurturing: 2, technical: 2, nature: 2 }, total: 8, dominant: null }, prefer });
    expect(page).toHaveLength(18);
    for (const s of page) expect(MINOR_UNSUITABLE.has(s.activity.id)).toBe(false);
  });
});

describe("the Dynamic Audience & Interest Profile", () => {
  const generic = new Set(TAGS.filter((t) => t.generic).map((t) => t.id));
  const none = { imageProfile: {}, imageCount: 0, pickTags: [], pickCount: 0, genericTags: generic };

  it("forces no conclusions without evidence: everything but the context stays unknown", () => {
    const p = buildAudienceProfile({ ...none, searchContext: "self" });
    expect(p.searchContext).toEqual({ value: "self", source: "explicit", confidence: 1 });
    expect(p.audience.source).toBe("unknown");
    expect(p.lifeWorld.source).toBe("unknown");
    expect(p.interests.source).toBe("unknown");
    expect(p.interests.value).toEqual([]);
    expect(p.orientation.value).toEqual([]);
    expect(p.preferences.value).toEqual([]);
  });

  it("supports an unknown context", () => {
    const p = buildAudienceProfile({ ...none, searchContext: undefined });
    expect(p.searchContext).toEqual({ value: "unknown", source: "unknown", confidence: 0 });
  });

  it("marks where each reading comes from: the context and an age are explicit, the age phase from a context is inferred and weaker", () => {
    expect(buildAudienceProfile({ ...none, searchContext: "child" }).audience).toMatchObject({ value: "child_or_youth", source: "inferred" });
    expect(buildAudienceProfile({ ...none, searchContext: "group" }).audience).toMatchObject({ value: "mixed", source: "inferred" });
    const explicit = buildAudienceProfile({ ...none, searchContext: "self", ageCategory: "35-44" });
    expect(explicit.audience).toMatchObject({ value: "adult", source: "explicit" });
    expect(explicit.audience.confidence).toBeGreaterThan(buildAudienceProfile({ ...none, searchContext: "adult" }).audience.confidence);
    // "For myself" is not an adult, and "a child" is not a young child: neither gets a stronger reading than the context gives.
    expect(buildAudienceProfile({ ...none, searchContext: "self" }).audience.value).toBe("unknown");
  });

  it("reads the life setting from who goes along (stated), never from the images", () => {
    expect(buildAudienceProfile({ ...none, company: ["family"] }).lifeWorld).toMatchObject({ value: "family", source: "explicit" });
    expect(buildAudienceProfile({ ...none, company: ["colleagues"] }).lifeWorld).toMatchObject({ value: "work", source: "explicit" });
  });

  it("builds interests, orientation and leanings from the choices: chosen activities count as explicit, themes read from images as inferred", () => {
    const imageProfile = { making: 6, craft: 4, color: 3, nature: 2, stillness: 1 };
    const fromImages = buildAudienceProfile({ ...none, imageProfile, imageCount: 6, axes: { social: 0, energy: -0.4, setting: 0.2, novelty: 0 } });
    expect(fromImages.interests.source).toBe("inferred");
    expect(fromImages.interests.value).toContain("craft");
    expect(fromImages.orientation.value).toContain("creative");
    const withPicks = buildAudienceProfile({ ...none, imageProfile, imageCount: 6, pickTags: ["craft", "craft", "history"], pickCount: 3 });
    expect(withPicks.interests.source).toBe("explicit");
    expect(withPicks.interests.confidence).toBeGreaterThan(fromImages.interests.confidence);
  });

  it("keeps a weak reading unknown instead of guessing (one image is not a profile)", () => {
    const weak = buildAudienceProfile({ ...none, imageProfile: { making: 1 }, imageCount: 1 });
    expect(weak.interests.value).toEqual([]);
    expect(weak.preferences.value).toEqual([]);
  });

  it("does not hold, ask for or infer gender", () => {
    const p = buildAudienceProfile({ ...none, imageProfile: { style: 5, performance: 4, making: 3 }, imageCount: 8, searchContext: "adult" });
    expect(JSON.stringify(p).toLowerCase()).not.toMatch(/gender|female|male|woman|man\b|vrouw|man\b/);
  });

  it("tells the writer what is stated and what is inferred, and keeps room for the unexpected", () => {
    const text = describeAudienceForPrompt(
      buildAudienceProfile({ ...none, searchContext: "group", imageProfile: { teamwork: 5, play: 4, food: 3 }, imageCount: 8 }),
    );
    expect(text).toContain("Search context (stated)");
    expect(text).toContain("group");
    expect(text).toMatch(/inferred from their choices/);
    expect(text).toMatch(/outside the stated or inferred interests/);
    expect(text).toMatch(/never assume gender/);
  });
});

describe("what the server stores for the start page", () => {
  it("stores the context, builds the profile on the server and keeps a first name for somebody else (not for a group)", () => {
    const child = applyImageIntake({ ...base, searchContext: "child", recipientName: "  Emma  ", audienceProfile: { forged: true } as never }, "nl", "s", 6);
    expect(child.searchContext).toBe("child");
    expect(child.recipientName).toBe("Emma");
    expect(child.audienceProfile?.searchContext.value).toBe("child");
    expect((child.audienceProfile as unknown as Record<string, unknown>).forged).toBeUndefined();
    expect(applyImageIntake({ ...base, searchContext: "group", recipientName: "Club" }, "nl", "s", 6).recipientName).toBe("");
    expect(applyImageIntake({ ...base, searchContext: "self", recipientName: "Jan" }, "nl", "s", 6).recipientName).toBe("");
  });

  it("treats a missing or invented context as unknown and a gift can never be 'for myself'", () => {
    expect(applyImageIntake({ ...base }, "nl", "s", 6).searchContext).toBe("unknown");
    expect(applyImageIntake({ ...base, searchContext: "teen" }, "nl", "s", 6).searchContext).toBe("unknown");
    expect(applyImageIntake({ ...base, purpose: "gift", searchContext: "self" }, "nl", "s", 6).searchContext).toBe("unknown");
    expect(applyImageIntake({ ...base, purpose: "gift", searchContext: "adult", recipientName: "Oma" }, "nl", "s", 6).recipientName).toBe("Oma");
  });

  it("carries place, distance and limits through unchanged (they are asked once, first)", () => {
    const out = applyImageIntake({ ...base, location: "Haarlem", searchDistance: "hour", mustHaves: "Moet buiten zijn; Zonder auto bereikbaar", budget: "25", timeAvailable: "halfday", searchContext: "adult" }, "nl", "s", 6);
    expect(out.location).toBe("Haarlem");
    expect(out.searchDistance).toBe("hour");
    expect(out.mustHaves).toBe("Moet buiten zijn; Zonder auto bereikbaar");
    expect(out.budget).toBe("25");
    expect(out.timeAvailable).toBe("halfday");
  });

  it("works with nothing but a place (no context, no limits)", () => {
    const out = applyImageIntake({ ...base, searchContext: undefined, budget: "", timeAvailable: "", company: [] }, "nl", "s", 6);
    const result = runEngine(engineInputFromIntake({ ...out, interests: [] }, { seed: "s", month: 6 }));
    expect(result.seeds.length).toBeGreaterThanOrEqual(6);
  });
});

describe("the start page in the page order and the drafts", () => {
  it("opens the two-page intake with the start page", () => {
    expect(TWO_PAGE_PAGES[0]).toBe("start");
    expect(TWO_PAGE_PAGES).not.toContain("situation");
  });

  it("moves a draft or link from before the start page to the matching page, and leaves a current one alone", () => {
    // old: images, concrete, situation, profile
    expect(migrateTwoPageDraft(0, undefined)).toBe(1);
    expect(migrateTwoPageDraft(1, undefined)).toBe(2);
    expect(migrateTwoPageDraft(2, undefined)).toBe(0);
    expect(migrateTwoPageDraft(3, undefined)).toBe(3);
    expect(migrateTwoPageDraft(9, undefined)).toBe(3);
    expect(migrateTwoPageDraft(2, TWO_PAGE_LAYOUT)).toBe(2);
    expect(migrateTwoPageDraft(9, TWO_PAGE_LAYOUT)).toBe(3);
    expect(migrateTwoPageDraft(Number.NaN, undefined)).toBe(0);
  });
});
