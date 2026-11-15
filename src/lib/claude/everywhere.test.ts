import { describe, expect, it } from "vitest";
import { EVERYWHERE_IDS, everywhereCandidates } from "@/lib/claude/everywhere";
import { getActivity } from "@/lib/discovery/library";
import { resolveConstraints } from "@/lib/discovery/engine/constraints";
import { searchHint } from "@/lib/discovery/searchHints";

describe("the activities almost every town has", () => {
  it("are all in the library, once, and each one has search hints", () => {
    expect(new Set(EVERYWHERE_IDS).size).toBe(EVERYWHERE_IDS.length);
    for (const id of EVERYWHERE_IDS) {
      expect(getActivity(id), id).toBeTruthy();
      expect(searchHint(id), id).toBeTruthy();
    }
  });

  it("are offered in season, one per sub-domain, without what is excluded or known to be quiet", () => {
    const constraints = resolveConstraints({ budget: "", timeAvailable: "", mustHaves: "", socialFormats: [], interests: [] } as never);
    const got = everywhereCandidates({ constraints, month: 7, exclude: new Set(["wandelgroep"]), quiet: new Set(["musea"]), max: 6 });
    expect(got.length).toBeGreaterThan(0);
    expect(got.length).toBeLessThanOrEqual(6);
    const ids = got.map((a) => a.id);
    expect(ids).not.toContain("wandelgroep");
    expect(ids).not.toContain("musea");
    expect(new Set(got.map((a) => a.sub)).size).toBe(got.length);
  });
});
