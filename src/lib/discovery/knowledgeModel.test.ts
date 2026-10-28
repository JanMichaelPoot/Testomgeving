import { describe, expect, it } from "vitest";
import { ALL_ACTIVITIES, HYBRIDS, VOCABULARY } from "@/lib/discovery/library";
import type { Activity } from "@/lib/discovery/types";
import { validateLibrary } from "@/lib/discovery/validate";

// B2: the knowledge model on top of the existing activity model (aliases, provenance, source links, reviewer).

const base = (): Activity[] => ALL_ACTIVITIES.map((a) => ({ ...a }));
const check = (activities: Activity[]) => validateLibrary({ vocabulary: VOCABULARY, activities, hybrids: HYBRIDS });
const withChange = (id: string, change: Partial<Activity>) => base().map((a) => (a.id === id ? { ...a, ...change } : a));
const [A, B] = ALL_ACTIVITIES;

describe("the existing library under the knowledge model", () => {
  it("loads without errors and without any new field set", () => {
    expect(check(base()).errors).toEqual([]);
  });

  it("keeps unknown as null: no facet uses a stand-in value for 'not established'", () => {
    for (const a of ALL_ACTIVITIES) {
      for (const k of ["formats", "intensity", "level", "cost", "duration", "setting"] as const) {
        const v = a[k] as unknown;
        expect(v === "unknown" || v === "" || v === false || (Array.isArray(v) && v.length === 0), `${a.id}.${k}`).toBe(false);
      }
    }
  });
});

describe("aliases", () => {
  it("accepts a plain alias", () => {
    expect(check(withChange(A.id, { aliases: { nl: ["een andere naam voor dit"], en: [] } })).errors).toEqual([]);
  });

  it("refuses an alias that is the activity's own name, however it is written", () => {
    const r = check(withChange(A.id, { aliases: { nl: [` ${A.label.nl.toUpperCase()} `], en: [] } }));
    expect(r.errors.join("\n")).toContain("is the activity's own name");
  });

  it("refuses an alias that is the name of another activity (normalised: case, accents, punctuation)", () => {
    const r = check(withChange(A.id, { aliases: { nl: [], en: [B.label.en.toUpperCase() + "!"] } }));
    expect(r.errors.join("\n")).toContain(`is also a name or alias of "${B.id}"`);
  });

  it("refuses the same alias on two activities", () => {
    const list = base().map((a) => (a.id === A.id || a.id === B.id ? { ...a, aliases: { nl: ["gedeelde bijnaam"], en: [] } } : a));
    expect(check(list).errors.join("\n")).toContain("also a name or alias of");
  });

  it("does not compare across languages (the same word can mean different things in nl and en)", () => {
    const nlOnly = ALL_ACTIVITIES.find((a) => a.label.nl !== a.label.en && a.id !== A.id)!;
    const r = check(withChange(A.id, { aliases: { nl: [], en: [nlOnly.label.nl + " zzz"] } }));
    expect(r.errors).toEqual([]);
  });

  it("refuses empty aliases and duplicates inside one list", () => {
    expect(check(withChange(A.id, { aliases: { nl: ["  "], en: [] } })).errors.join("\n")).toContain("empty alias");
    expect(check(withChange(A.id, { aliases: { nl: ["x y", "X-Y"], en: [] } })).errors.join("\n")).toContain("duplicates");
  });
});

describe("provenance and source links", () => {
  it("needs a source_record_id when the method is 'source'", () => {
    const r = check(withChange(A.id, { provenance: { source_id: "S3", method: "source" } }));
    expect(r.errors.join("\n")).toContain("needs source_record_id");
    expect(check(withChange(A.id, { provenance: { source_id: "S3", method: "source", source_record_id: "Q1" } })).errors).toEqual([]);
  });

  it("only knows the three methods and real dates", () => {
    expect(check(withChange(A.id, { provenance: { source_id: "x", method: "guess" as never } })).errors.join("\n")).toContain("provenance.method");
    expect(check(withChange(A.id, { provenance: { source_id: "x", method: "curated", last_verified_at: "2026-02-30" } })).errors.join("\n")).toContain("real date");
    expect(check(withChange(A.id, { provenance: { source_id: "x", method: "inferred_ai", last_verified_at: "2026-10-28" } })).errors).toEqual([]);
  });

  it("lets one external record belong to one activity only", () => {
    const list = base().map((a) => (a.id === A.id || a.id === B.id ? { ...a, source_links: [{ source_id: "S3", source_record_id: "Q42" }] } : a));
    expect(check(list).errors.join("\n")).toContain("one record is one activity");
  });
});

describe("review", () => {
  it("a reviewed or live activity must say who reviewed it and when", () => {
    expect(check(withChange(A.id, { status: "reviewed" })).errors.join("\n")).toContain("needs reviewed_by");
    expect(check(withChange(A.id, { status: "live", reviewed_by: { by: "Jan", at: "not-a-date" } })).errors.join("\n")).toContain("needs reviewed_by");
    expect(check(withChange(A.id, { status: "live", reviewed_by: { by: "Jan", at: "2026-10-28" } })).errors).toEqual([]);
  });

  it("a concept needs no reviewer", () => {
    expect(check(withChange(A.id, { status: "concept" })).errors).toEqual([]);
  });
});
