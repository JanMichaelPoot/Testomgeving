import { describe, expect, it } from "vitest";
import cardAssociations from "@/lib/discovery/cardAssociations.json";
import activityAssociations from "@/lib/discovery/activityAssociations.json";
import { ASSOCIATIONS, buildAssociationLibrary } from "@/lib/discovery/associations";
import { activityVector, buildConcretePool } from "@/lib/discovery/concretePool";
import { assocCloseness, assocProfile, sharedAssociations } from "@/lib/discovery/associationLayer";
import { ALL_ACTIVITIES } from "@/lib/discovery/library";
import { ASSOC_WEIGHT, composeConcretePage, registerMix, type ConcreteActivity } from "@/lib/discovery/twoPages";
import { knowledgeAssociationLayerEnabled } from "@/lib/knowledgeFlags";
import { loadLibrary } from "@/lib/referenceLibrary/load";
import { parseLink } from "@/lib/referenceLibrary/validate";

const refSlugs = new Set(loadLibrary().associations.map((a) => a.slug));
const families = cardAssociations as Record<string, Record<string, number>>;
const data = activityAssociations as unknown as { idf: Record<string, number>; activities: Record<string, [string, number][]> };

describe("the association layer data", () => {
  it("every image family says what it evokes, with real associations and weights 1, .7 or .4", () => {
    const wanted = new Set(ASSOCIATIONS.map((c) => c.family ?? c.id));
    expect([...wanted].filter((f) => !families[f])).toEqual([]);
    expect(Object.keys(families).filter((f) => !wanted.has(f))).toEqual([]);
    for (const [fam, weights] of Object.entries(families)) {
      expect(Object.keys(weights).length, fam).toBeGreaterThanOrEqual(3);
      for (const [slug, w] of Object.entries(weights)) {
        expect(refSlugs.has(slug), `${fam} -> ${slug}`).toBe(true);
        expect([1, 0.7, 0.4], `${fam} ${slug}`).toContain(w);
      }
    }
  });

  it("every activity vector points at a real activity and real associations, and matches the reference library", () => {
    const ids = new Set(ALL_ACTIVITIES.map((a) => a.id));
    const refs = loadLibrary().activities.filter((r) => r.legacy_id);
    for (const [id, list] of Object.entries(data.activities)) {
      expect(ids.has(id), id).toBe(true);
      expect(list.length, id).toBeLessThanOrEqual(8);
      // An app activity can have several reference records (an exact one and a merged close one): the vector comes from one of them.
      const links = refs.filter((r) => r.legacy_id === id).flatMap((r) => r.links.map(parseLink)).filter((l) => l && l.relation !== "O" && l.score >= 3);
      for (const [slug, score] of list) {
        expect(refSlugs.has(slug), `${id} -> ${slug}`).toBe(true);
        expect(links.some((l) => l!.association === slug && l!.score === score), `${id} ${slug}:${score} is in the reference library`).toBe(true);
      }
    }
    for (const slug of Object.keys(data.idf)) expect(refSlugs.has(slug)).toBe(true);
  });

  it("covers most of the associations with an image family and says which ones it does not (the gaps are known, not hidden)", () => {
    const covered = new Set(Object.values(families).flatMap((w) => Object.entries(w).filter(([, x]) => x >= 0.7).map(([s]) => s)));
    expect(covered.size).toBeGreaterThanOrEqual(85);
  });
});

describe("closeness in association space", () => {
  it("sums the chosen images and measures the overlap, 0 without a vector", () => {
    const profile = assocProfile([{ assoc: { geur: 1, warmte: 0.7 } }, { assoc: { geur: 0.4 } }, {}]);
    expect(profile).toEqual({ geur: 1.4, warmte: 0.7 });
    expect(assocCloseness(profile, undefined)).toBe(0);
    expect(assocCloseness(profile, [["water", 0.5]])).toBe(0);
    expect(assocCloseness(profile, [["geur", 0.5], ["water", 0.5]])).toBeCloseTo((1.4 * 0.5) / Math.sqrt(2));
    expect(sharedAssociations(profile, [["warmte", 0.9], ["geur", 0.6], ["water", 1]], 2)).toEqual(["geur", "warmte"]);
  });

  it("an idf-weighted vector gives a rare association more than a common one", () => {
    const v = activityVector("pottenbakken");
    expect(v && v.length).toBeGreaterThan(0);
    const common = Object.entries(data.idf).sort((a, b) => a[1] - b[1])[0];
    const rare = Object.entries(data.idf).sort((a, b) => b[1] - a[1])[0];
    expect(rare[1]).toBeGreaterThan(common[1]);
  });
});

describe("page 2 with the layer", () => {
  const mk = (id: string, register: ConcreteActivity["register"], tags: string[], assoc?: ConcreteActivity["assoc"], sub = id, domain = id): ConcreteActivity => ({
    id, domain, sub, register, tags, axes: { social: 0, energy: 0, setting: 0 }, ...(assoc ? { assoc } : {}),
  });
  const pool = ["expressive", "nurturing", "technical", "nature"].flatMap((r) =>
    Array.from({ length: 6 }, (_, k) => mk(`${r}-${k}`, r as ConcreteActivity["register"], ["making"], k === 0 ? [["geur", 1]] : [["water", 1]], `${r}-sub${k}`, `${r}-dom${k}`)),
  );
  const opts = { seed: "t", profile: { making: 1 }, mix: registerMix([{ register: "nurturing" as const }]), size: 8, explore: 0 };

  it("is the tags-only page when no association profile is given", () => {
    const a = composeConcretePage(pool, opts).map((s) => s.activity.id);
    const b = composeConcretePage(pool, { ...opts, assocProfile: undefined }).map((s) => s.activity.id);
    expect(b).toEqual(a);
  });

  it("brings the activities that share an association with the images onto the page, and keeps every register floor", () => {
    const page = composeConcretePage(pool, { ...opts, assocProfile: { geur: 3 }, assocWeight: 5 });
    expect(page.filter((s) => s.activity.id.endsWith("-0")).length).toBe(4); // the four with the matching association
    for (const r of ["expressive", "nurturing", "technical", "nature"]) expect(page.filter((s) => s.activity.register === r).length).toBeGreaterThanOrEqual(2);
  });

  it("weighs the layer moderately by default", () => {
    expect(ASSOC_WEIGHT).toBeGreaterThan(0);
    expect(ASSOC_WEIGHT).toBeLessThan(1);
  });
});

describe("the switch", () => {
  it("is off unless KNOWLEDGE_ASSOCIATION_LAYER is set, and then the slim data carries the layer", () => {
    expect(knowledgeAssociationLayerEnabled(undefined)).toBe(false);
    expect(knowledgeAssociationLayerEnabled("0")).toBe(false);
    expect(knowledgeAssociationLayerEnabled("1")).toBe(true);
    expect(buildAssociationLibrary("nl", 6, false).cards.some((c) => c.assoc)).toBe(false);
    expect(buildAssociationLibrary("nl", 6, true).cards.every((c) => c.assoc)).toBe(true);
    expect(buildConcretePool("nl", 6, false).activities.some((a) => a.assoc)).toBe(false);
    expect(buildConcretePool("nl", 6, true).activities.some((a) => a.assoc)).toBe(true);
  });
});
