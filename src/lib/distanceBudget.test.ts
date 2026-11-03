import { describe, expect, it, vi } from "vitest";
import { BUDGET_STEPS, BUDGET_VALUES, budgetStepIndex, currentBudget, describeBudget } from "@/lib/budgetOptions";
import { DEFAULT_DISTANCE_KM, DISTANCE_KM_STEPS, describeDistance, distanceClassFor, radiusText, sanitizeDistanceKm } from "@/lib/distanceOptions";
import { buildResearchPrompt, placeKey, researchSeeds } from "@/lib/claude/localResearch";
import { defaultEngineLibrary, passesConstraints, resolveConstraints, selectSeeds } from "@/lib/discovery/engine";
import type { EngineInput } from "@/lib/discovery/engine";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { parseMustHaves } from "@/lib/discovery/engine";
import { BUDGET_CAP } from "@/lib/pdf/ideaContent";

// The two sliders of the start page (distance in km, budget per person) must change what the search does, not only what the screen says.

const lib = defaultEngineLibrary();
const BASE: EngineInput = {
  interests: [],
  interestDomains: [],
  socialFormats: [],
  practicalToWild: "either",
  budget: "100",
  effort: "some",
  timeAvailable: "halfday",
  ageCategory: "35-44",
  mustHaves: "",
  history: [],
  seed: "slider-test",
  month: 6,
};

describe("the distance slider", () => {
  it("has the eight steps of the brief, and only those are accepted", () => {
    expect([...DISTANCE_KM_STEPS]).toEqual([5, 10, 15, 25, 50, 75, 100, 150]);
    expect(sanitizeDistanceKm(25)).toBe(25);
    for (const bad of [0, 7, -5, 1e9, "25", null, undefined, NaN]) expect(sanitizeDistanceKm(bad)).toBeUndefined();
    expect(DISTANCE_KM_STEPS).toContain(DEFAULT_DISTANCE_KM);
  });

  it("derives the older three-way class from the kilometres", () => {
    expect(distanceClassFor(5)).toBe("city");
    expect(distanceClassFor(15)).toBe("city");
    expect(distanceClassFor(25)).toBe("hour");
    expect(distanceClassFor(75)).toBe("hour");
    expect(distanceClassFor(100)).toBe("anywhere");
    expect(distanceClassFor(150)).toBe("anywhere");
  });

  it("gives every step its own research radius and cache key", () => {
    const keys = DISTANCE_KM_STEPS.map((km) => placeKey("Utrecht", "city", km));
    expect(new Set(keys).size).toBe(keys.length);
    expect(placeKey("Utrecht", "city", 25)).toBe("utrecht|25km");
    expect(placeKey("Gemeente Utrecht", "city", 150)).toBe("nl|nl");
    // Without kilometres the older classes still work.
    expect(placeKey("Utrecht", "hour")).toBe("utrecht|region");
  });

  it("puts the real distance in the researcher's instructions, and in the writer's profile", () => {
    expect(buildResearchPrompt(["yoga"], "Utrecht", "10km", "nl")).toContain("within about 10 km of the place");
    expect(buildResearchPrompt(["yoga"], "Utrecht", "75km", "nl")).toContain("within about 75 km of the place");
    expect(buildResearchPrompt(["yoga"], "Utrecht", "nl", "nl")).toContain("anywhere in the Netherlands");
    expect(radiusText("city", 5)).toContain("5 km");
    expect(describeDistance("city", 25)).toBe("up to 25 km from the starting place");
    expect(describeDistance("anywhere", 150)).toContain("more than 100 km");
    expect(describeDistance("hour", undefined)).toContain("hour");
  });

  it("passes the kilometres on to the search, so a 10 km search and a 75 km search are different searches", async () => {
    const radii: string[] = [];
    const search = vi.fn(async (ids: string[], _l: string, radius: string) => {
      radii.push(radius);
      return new Map(ids.map((id) => [id, []]));
    });
    const base = { location: "Utrecht", searchDistance: "city", locale: "nl" as const, verify: false as const, cache: null, activityIds: ["yoga"], search: search as never };
    await researchSeeds({ ...base, searchDistanceKm: 10 });
    await researchSeeds({ ...base, searchDistanceKm: 75 });
    await researchSeeds({ ...base, searchDistanceKm: 150 });
    expect(radii).toEqual(["10km", "75km", "nl"]);
  });
});

describe("the budget slider", () => {
  it("has six steps, per person, and every step is understood everywhere a budget is read", () => {
    expect([...BUDGET_VALUES]).toEqual(["10", "25", "50", "100", "200", "allin"]);
    for (const step of BUDGET_STEPS) {
      const c = resolveConstraints({ ...BASE, budget: step.value });
      expect(c.costCap).toBeGreaterThanOrEqual(1);
      expect(BUDGET_CAP[step.value]).toBe(step.euro ?? Infinity);
      for (const locale of ["nl", "en"] as const) {
        expect(getDictionary(locale).intake.budget.options.map((o) => o.value)).toContain(step.value);
        const seek = getDictionary(locale).venster.profile.seekLines.budget;
        if (step.value !== "allin") expect(seek[step.value], `${locale} ${step.value}`).toBeTruthy();
      }
    }
    expect(budgetStepIndex("")).toBe(-1);
    expect(budgetStepIndex("free")).toBe(1);
    expect(currentBudget("free")).toBe("25");
    expect(describeBudget("25")).toBe("up to €25 per person");
    expect(describeBudget("allin")).toBe("no limit");
  });

  it("filters on what an activity typically costs: the lower the budget, the fewer expensive activities pass", () => {
    const passing = (budget: string) => lib.activities.filter((a) => passesConstraints(a, resolveConstraints({ ...BASE, budget })).ok).length;
    const counts = BUDGET_VALUES.map(passing);
    // Never fewer activities when the budget goes up.
    for (let i = 1; i < counts.length; i++) expect(counts[i], BUDGET_VALUES[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    // And the extremes really differ (the slider is not decoration).
    expect(counts[0]).toBeLessThan(counts[counts.length - 1]);
    expect(counts[1]).toBeLessThan(counts[3]);
  });

  it("never picks an activity above the budget's cost class, for any step", () => {
    const COST_CAP: Record<string, number> = { "10": 1, "25": 2, "50": 2, "100": 3, "200": 3, allin: 3 };
    const byId = new Map(lib.activities.map((a) => [a.id, a]));
    for (const budget of BUDGET_VALUES) {
      for (const seed of ["a", "b", "c", "d"]) {
        const result = selectSeeds({ ...BASE, budget, seed }, lib);
        for (const s of result.seeds) {
          const cost = byId.get(s.activityId)?.cost;
          if (cost !== null && cost !== undefined) expect(cost, `${budget} ${seed} ${s.activityId}`).toBeLessThanOrEqual(COST_CAP[budget]);
        }
      }
    }
  });

  it("a lower budget gives a cheaper book on average", () => {
    const byId = new Map(lib.activities.map((a) => [a.id, a]));
    const mean = (budget: string) => {
      let total = 0;
      let n = 0;
      for (const seed of ["s1", "s2", "s3", "s4", "s5", "s6"]) {
        for (const s of selectSeeds({ ...BASE, budget, seed }, lib).seeds) {
          const cost = byId.get(s.activityId)?.cost;
          if (cost !== null && cost !== undefined) {
            total += cost;
            n++;
          }
        }
      }
      return total / n;
    };
    expect(mean("10")).toBeLessThan(mean("allin"));
  });
});

describe("the grouped 'what matters' chips", () => {
  for (const locale of ["nl", "en"] as const) {
    it(`cover every chip exactly once, under a heading (${locale})`, () => {
      const v = getDictionary(locale).venster;
      const grouped = v.start.limits.groups.flatMap((g) => g.chips);
      expect([...grouped].sort()).toEqual([...v.who.limitChips].sort());
      expect(new Set(grouped).size).toBe(grouped.length);
      for (const g of v.start.limits.groups) expect(g.title.trim().length).toBeGreaterThan(0);
      // Each one steers the search: the parser understands it.
      for (const chip of grouped) {
        const r = parseMustHaves(chip);
        expect(r.setting !== null || r.noGroups || r.verify.length > 0, chip).toBe(true);
      }
    });
  }

  it("'Wie gaat er mee?' is gone from the copy", () => {
    for (const locale of ["nl", "en"] as const) {
      const v = getDictionary(locale).venster;
      expect(JSON.stringify(v)).not.toMatch(/Wie gaat er mee|Who's coming along|Who would \{name\} go with|companyLabel/);
      expect("company" in v.nav.hint).toBe(false);
    }
  });
});
