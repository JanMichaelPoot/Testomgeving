import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import path from "node:path";
import {
  ALL_ACTIVITIES,
  DOMAINS,
  HYBRIDS,
  TAGS,
  VOCABULARY,
  activityImage,
  filterByStatus,
  getActivities,
  getActivity,
} from "@/lib/discovery/library";
import { validateLibrary } from "@/lib/discovery/validate";
import type { Activity } from "@/lib/discovery/types";

const input = { vocabulary: VOCABULARY, activities: ALL_ACTIVITIES, hybrids: HYBRIDS };

describe("discovery library", () => {
  it("has no validation errors", () => {
    const { errors } = validateLibrary(input);
    expect(errors).toEqual([]);
  });

  it("holds the agreed first version: 150-250 activities over the domains", () => {
    expect(ALL_ACTIVITIES.length).toBeGreaterThanOrEqual(150);
    expect(ALL_ACTIVITIES.length).toBeLessThanOrEqual(250);
    for (const d of DOMAINS) {
      expect(ALL_ACTIVITIES.filter((a) => a.domain === d.id).length).toBeGreaterThanOrEqual(10);
    }
  });

  it("imports every data file, so a new domain file is never silently ignored", () => {
    const dir = path.join(__dirname, "data");
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    const domainsInData = new Set(files.map((f) => f.replace(".json", "")));
    const domainsLoaded = new Set(ALL_ACTIVITIES.map((a) => a.domain));
    expect([...domainsInData].sort()).toEqual([...domainsLoaded].sort());
  });

  it("offers a way to take part without company in every domain", () => {
    for (const d of DOMAINS) {
      const ok = ALL_ACTIVITIES.some(
        (a) => a.domain === d.id && (a.formats?.includes("solo") || a.formats?.includes("drop_in_alone")),
      );
      expect(ok, d.id).toBe(true);
    }
  });

  it("gives every tier-2 activity a supervised, legal way in", () => {
    for (const a of ALL_ACTIVITIES.filter((x) => x.safety.tier === 2)) {
      expect(a.safety.note?.nl, a.id).toBeTruthy();
      expect(a.safety.note?.en, a.id).toBeTruthy();
    }
  });

  it("marks unknown facets as null instead of guessing", () => {
    const unknowns = ALL_ACTIVITIES.filter((a) => a.cost === null);
    expect(unknowns.length).toBeGreaterThan(0); // the concept has a few "varies widely" costs
    for (const a of unknowns) expect(a.cost).toBeNull();
  });

  it("has a bridge tag vocabulary that is used", () => {
    expect(TAGS.filter((t) => !t.generic).length).toBeGreaterThan(20);
  });

  it("hides retired activities from listings but resolves every real id", () => {
    const retired: Activity = { ...ALL_ACTIVITIES[0], id: "retired-example", status: "retired" };
    const list = [...ALL_ACTIVITIES, retired];
    expect(filterByStatus(list).some((a) => a.id === "retired-example")).toBe(false);
    expect(filterByStatus(list, "live")).toEqual([]);
    expect(getActivity(ALL_ACTIVITIES[0].id)).toBe(ALL_ACTIVITIES[0]);
    expect(getActivity("does-not-exist")).toBeUndefined();
  });

  it("filters by review status", () => {
    expect(getActivities({ minStatus: "live" })).toEqual([]); // nothing reviewed yet
    expect(getActivities().length).toBe(ALL_ACTIVITIES.length);
  });

  it("derives a stable image path from the id", () => {
    expect(activityImage("hardlopen")).toBe("/illustrations/discovery/hardlopen.jpg");
  });
});

describe("validateLibrary", () => {
  const base = ALL_ACTIVITIES[0];
  const run = (patch: Partial<Activity>, extra: Activity[] = []) =>
    validateLibrary({ ...input, activities: [{ ...base, ...patch }, ...ALL_ACTIVITIES.slice(1), ...extra] }).errors.join("\n");

  it("rejects an unknown tag, an unknown domain and a bad slug", () => {
    expect(run({ tags: ["precision", "nope"] })).toContain('unknown tag "nope"');
    expect(run({ domain: "nowhere" })).toContain('unknown domain "nowhere"');
    expect(run({ id: "Bad Id" })).toContain("lowercase slug");
  });

  it("rejects duplicate ids", () => {
    expect(run({}, [{ ...base }])).toContain("duplicate id");
  });

  it("requires a note for tier 2 and a scene without people", () => {
    expect(run({ safety: { tier: 2 } })).toContain("tier 2 needs safety.note");
    expect(run({ scene: "a crowd of people laughing at a long table by the sea" })).toContain("people/faces");
  });

  it("requires a non-generic tag so an item can connect to something", () => {
    expect(run({ tags: ["focus", "discovery"] })).toContain("non-generic tag");
  });

  it("treats unknown (null) facets as valid and flags a sub-domain from another domain", () => {
    expect(run({ cost: null, formats: null })).toBe("");
    expect(run({ sub: "science" })).toContain("belongs to");
  });
});
