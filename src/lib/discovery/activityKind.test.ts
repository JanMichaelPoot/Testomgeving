import { describe, expect, it } from "vitest";
import { ALL_ACTIVITIES } from "@/lib/discovery/library";
import { KINDS, KIND_LABELS, KIND_TABLE, MODES, MODE_LABELS, deriveKind, deriveMode, kindOfActivity, modeOfActivity } from "@/lib/discovery/activityKind";

// B1 and B2 (docs/plan-activiteitenselectie.md): every activity has a kind (what you do) and a mode (how it can be done).

const ids = new Set(ALL_ACTIVITIES.map((a) => a.id));

describe("activity kind and execution mode", () => {
  it("has a valid line for every activity, and no line for an id that does not exist", () => {
    for (const a of ALL_ACTIVITIES) {
      expect(KINDS, `kind of ${a.id}`).toContain(KIND_TABLE.kinds[a.id]);
      expect(MODES, `mode of ${a.id}`).toContain(KIND_TABLE.modes[a.id]);
    }
    for (const id of [...Object.keys(KIND_TABLE.kinds), ...Object.keys(KIND_TABLE.modes)]) expect(ids.has(id), `unknown id ${id}`).toBe(true);
  });

  it("names every kind and mode in both languages", () => {
    for (const k of KINDS) expect(KIND_LABELS[k].nl && KIND_LABELS[k].en).toBeTruthy();
    for (const m of MODES) expect(MODE_LABELS[m].nl && MODE_LABELS[m].en).toBeTruthy();
  });

  it("spreads the library over the kinds and modes (no kind or mode is a handful of items)", () => {
    const kinds = new Map<string, number>();
    const modes = new Map<string, number>();
    for (const a of ALL_ACTIVITIES) {
      kinds.set(kindOfActivity(a), (kinds.get(kindOfActivity(a)) ?? 0) + 1);
      modes.set(modeOfActivity(a), (modes.get(modeOfActivity(a)) ?? 0) + 1);
    }
    for (const k of KINDS) expect(kinds.get(k) ?? 0, k).toBeGreaterThanOrEqual(20);
    for (const m of MODES) expect(modes.get(m) ?? 0, m).toBeGreaterThanOrEqual(30);
  });

  it("only calls an activity 'self' when it is safe, cheap, common and can be done alone or with people you know", () => {
    for (const a of ALL_ACTIVITIES.filter((x) => modeOfActivity(x) === "self")) {
      expect(a.safety.tier, a.id).toBe(0);
      expect(a.cost === null || a.cost <= 1, `${a.id} cost`).toBe(true);
      expect(a.supply ?? "common", a.id).toBe("common");
      expect(a.formats?.some((f) => f === "solo" || f === "duo" || f === "with_known"), `${a.id} formats`).toBe(true);
    }
  });

  it("never calls an activity under qualified supervision 'self'", () => {
    for (const a of ALL_ACTIVITIES.filter((x) => x.safety.tier === 2)) expect(modeOfActivity(a), a.id).not.toBe("self");
  });

  it("puts every trip and every organised event under 'organise'", () => {
    for (const a of ALL_ACTIVITIES.filter((x) => x.domain === "travel" || (x.domain === "together" && x.sub === "organise"))) {
      expect(modeOfActivity(a), a.id).toBe("organise");
    }
  });

  it("agrees with the rules for most activities, so a rule and the table do not drift apart (the table holds the exceptions)", () => {
    let kindSame = 0;
    let modeSame = 0;
    for (const a of ALL_ACTIVITIES) {
      if (kindOfActivity(a) === deriveKind(a)) kindSame++;
      if (modeOfActivity(a) === deriveMode(a, kindOfActivity(a))) modeSame++;
    }
    expect(kindSame / ALL_ACTIVITIES.length).toBeGreaterThan(0.8);
    expect(modeSame / ALL_ACTIVITIES.length).toBeGreaterThan(0.85);
  });

  it("falls back to the rules for an activity that is not in the table", () => {
    const a = { ...ALL_ACTIVITIES.find((x) => x.domain === "creative" && x.sub === "visual")!, id: "not-in-the-table" };
    expect(kindOfActivity(a)).toBe("make");
    expect(["self", "provider"]).toContain(modeOfActivity(a));
  });
});
