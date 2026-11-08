import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_ACTIVITIES, VOCABULARY } from "@/lib/discovery/library";
import { normalizeName } from "@/lib/discovery/names";
import { registerOfActivity } from "@/lib/discovery/register";
import type { Activity } from "@/lib/discovery/types";
import { addAliases, addSourceLink, buildActivity, planImport, SOURCE_ID, type Crosswalk, type CrosswalkActivity } from "./appImport";
import { loadLibrary } from "./load";
import type { RefActivity } from "./types";

const crosswalk = JSON.parse(readFileSync(path.join(process.cwd(), "reference-library", "crosswalk", "app-import.json"), "utf8")) as Crosswalk;
const lib = loadLibrary();
const byId = new Map<string, Activity>(ALL_ACTIVITIES.map((a) => [a.id, a]));

describe("the reference library in the app", () => {
  it("every record with a crosswalk entry is written into the app, every decided merge is linked, and nothing is left over", () => {
    const plan = planImport(lib.activities, crosswalk, byId);
    expect(plan.notes).toEqual([]);
    expect(plan.create.map((a) => a.id)).toEqual([]); // the import has been run: running it again adds nothing
    const bySlug = new Map(lib.activities.map((r) => [r.slug, r]));
    for (const slug of Object.keys(crosswalk.activities)) {
      const ref = bySlug.get(slug);
      expect(ref, slug).toBeDefined();
      // After the import the reference record points at the app activity like at any other.
      expect(ref!.match, slug).toBe("exact");
      expect(ref!.legacy_id, slug).toBe(slug);
      expect(byId.get(slug)?.provenance?.source_record_id, slug).toBe(ref!.id);
    }
    for (const [id, merged] of Object.entries(crosswalk.decisions)) {
      const ref = lib.activities.find((r) => r.id === id);
      expect(ref?.legacy_id, id).toBe(merged.app_id);
      expect(byId.has(merged.app_id), id).toBe(true);
    }
    // Nothing is waiting: no reference record is still "new" to the app.
    expect(lib.activities.filter((r) => r.match === "new").map((r) => r.id)).toEqual([]);
  });

  it("every exact or close reference record is linked from the app activity it matches", () => {
    for (const ref of lib.activities.filter((r) => r.match === "exact" || r.match === "close")) {
      const app = byId.get(ref.legacy_id!);
      expect(app, `${ref.id} -> ${ref.legacy_id}`).toBeDefined();
      // Linked by a source link, or (for an activity this import wrote) by its own provenance.
      const linked = app!.source_links?.some((l) => l.source_id === SOURCE_ID && l.source_record_id === ref.id) || app!.provenance?.source_record_id === ref.id;
      expect(linked, `${ref.id} link`).toBe(true);
    }
  });

  it("imported activities carry their origin, a register and valid app tags; none is shown without a photo", () => {
    const tags = new Set(VOCABULARY.tags.map((t) => t.id));
    for (const a of ALL_ACTIVITIES.filter((x) => x.provenance?.source_id === SOURCE_ID)) {
      expect(a.provenance?.method).toBe("curated");
      expect(a.provenance?.source_record_id).toMatch(/^RA-\d{3}$/);
      expect(a.tags.every((t) => tags.has(t)), a.id).toBe(true);
      expect(registerOfActivity(a), `${a.id} register`).toBeTruthy();
      // Written as a concept: a human has not reviewed it yet. (It is also hidden while its photo is missing; see taxonomy:check.)
      expect(a.status, a.id).toBe("concept");
    }
    expect(ALL_ACTIVITIES.filter((x) => x.provenance?.source_id === SOURCE_ID).length).toBe(Object.keys(crosswalk.activities).length);
  });

  it("writes one reference record the way the app expects, and refuses tier 2 without a note", () => {
    const ref = lib.activities.find((r) => r.slug === "klifduiken") as RefActivity;
    const cw = crosswalk.activities["klifduiken"] as CrosswalkActivity;
    const a = buildActivity(ref, cw, crosswalk.safety_notes["klifduiken"]);
    expect(a).toMatchObject({ id: "klifduiken", status: "concept", image_pending: true, safety: { tier: 2 } });
    expect(a.provenance).toEqual({ source_id: "RL", source_record_id: "RA-046", method: "curated" });
    expect(() => buildActivity(ref, cw, undefined)).toThrow(/tier 2 needs a note/);
  });

  it("adds source links and aliases once, and never an alias another activity already has", () => {
    const a = structuredClone(byId.get("tekenen")!);
    expect(addSourceLink(a, "RA-999")).toBe(true);
    expect(addSourceLink(a, "RA-999")).toBe(false);
    const taken = new Set([normalizeName("Pottenbakken")]);
    expect(addAliases(a, ["Pottenbakken", "Een eigen alias"], [], taken)).toBe(true);
    expect(a.aliases?.nl).toContain("Een eigen alias");
    expect(a.aliases?.nl).not.toContain("Pottenbakken");
    expect(addAliases(a, ["Een eigen alias"], [], taken)).toBe(false);
  });
});
