import { describe, expect, it } from "vitest";
import { checkFill, fillConflicts, fillContext, lineConflict, normalizeFill, withoutConflicts, type FillContext } from "@/lib/claude/ideaFill";
import { knowledgeEngineV2Enabled } from "@/lib/knowledgeFlags";
import { getActivity } from "@/lib/discovery/library";
import { kindCopy, type ActivityKind } from "@/lib/pdf/ideaContent";

const fill = (over: Record<string, unknown> = {}) => ({
  timeline: ["Aankomen", "Draaien", "Afwerken", "Napraten"],
  takeaways: ["Een vaas", "Rust", "Een verhaal"],
  suggestions: ["Foto maken", "Notitie", "Nog eens"],
  ...over,
});
const none: FillContext = { solo: false, onlineOnly: false, indoor: false };

describe("the feature flag", () => {
  it("is off unless it is set to something that clearly means on", () => {
    expect(knowledgeEngineV2Enabled(undefined)).toBe(false);
    expect(knowledgeEngineV2Enabled("")).toBe(false);
    expect(knowledgeEngineV2Enabled("0")).toBe(false);
    expect(knowledgeEngineV2Enabled("false")).toBe(false);
    expect(knowledgeEngineV2Enabled("maybe")).toBe(false);
    for (const on of ["1", "true", "TRUE", "yes", "on", ' "1" ', "'true'"]) expect(knowledgeEngineV2Enabled(on)).toBe(true);
  });
});

describe("checkFill", () => {
  it("accepts four timeline lines and three takeaways and suggestions", () => {
    expect(checkFill(fill()).fill).toEqual(fill());
  });
  it("squeezes whitespace", () => {
    expect(normalizeFill(fill({ takeaways: ["  Een   vaas ", "Rust", "Een verhaal"] }))?.takeaways[0]).toBe("Een vaas");
  });
  it("refuses anything incomplete and says why", () => {
    expect(checkFill(undefined).problem).toBe("missing");
    expect(checkFill("x").problem).toBe("not an object");
    expect(checkFill(fill({ timeline: ["a", "b", "c"] })).problem).toBe("timeline has 3 lines instead of 4");
    expect(checkFill(fill({ suggestions: "x" })).problem).toBe("suggestions is not a list");
    expect(checkFill(fill({ takeaways: ["a", "", "c"] })).problem).toBe("takeaways line 2 is empty");
    expect(checkFill(fill({ takeaways: ["a", "x".repeat(111), "c"] })).problem).toBe("takeaways line 2 is 111 characters");
  });
});

describe("fillContext", () => {
  const act = (formats: string[] | null, setting: "indoor" | "outdoor" | "both" | null) => ({ formats, setting }) as never;
  it("is solo when they lead with solo, or when the only company is themselves", () => {
    expect(fillContext(act(["solo"], null), "solo").solo).toBe(true);
    expect(fillContext(act(["solo", "duo"], null), null, ["alone"]).solo).toBe(true);
    expect(fillContext(act(["duo"], null), "duo", ["alone"]).solo).toBe(false);
    expect(fillContext(act(["drop_in_alone"], null), "drop_in_alone", ["alone"]).solo).toBe(false);
    expect(fillContext(act(["solo"], null), null, ["alone", "partner"]).solo).toBe(false);
    expect(fillContext(act(["solo"], null), null, []).solo).toBe(false);
  });
  it("knows online-only and indoor activities, and treats unknown as not so", () => {
    expect(fillContext(act(["online"], "indoor"), null)).toMatchObject({ onlineOnly: true, indoor: true });
    expect(fillContext(act(["online", "solo"], "both"), null)).toMatchObject({ onlineOnly: false, indoor: false });
    expect(fillContext(act(null, null), null)).toMatchObject({ onlineOnly: false, indoor: false });
  });
});

describe("contradictions", () => {
  const solo: FillContext = { ...none, solo: true };
  const online: FillContext = { ...none, onlineOnly: true };
  const indoor: FillContext = { ...none, indoor: true };

  it("catches the lines the audit found in real books (Z1), in Dutch and English", () => {
    expect(lineConflict("New faces or a new conversation", solo)).toBe("solo");
    expect(lineConflict("Bring someone you enjoy", solo)).toBe("solo");
    expect(lineConflict("Neem iemand mee die je graag mag", solo)).toBe("solo");
    expect(lineConflict("Neem een vriend of vriendin mee", solo)).toBe("solo");
    expect(lineConflict("Maak kennis met de andere deelnemers", solo)).toBe("solo");
    expect(lineConflict("Bring some cash or a bank card", online)).toBe("onlineOnly");
    expect(lineConflict("Neem je pinpas mee", online)).toBe("onlineOnly");
    expect(lineConflict("Zoek een parkeerplek vlakbij", online)).toBe("onlineOnly");
    expect(lineConflict("Neem een regenjas mee", indoor)).toBe("indoor");
    expect(lineConflict("Pack sunscreen and boots", indoor)).toBe("indoor");
  });

  it("does not fire when the fact is not known, or on ordinary lines", () => {
    expect(lineConflict("Bring someone you enjoy", none)).toBeNull();
    expect(lineConflict("Neem je pinpas mee", { ...none, solo: true, indoor: true })).toBeNull();
    for (const ok of ["Zet je telefoon op stil", "Maak na afloop een foto", "Neem een notitieboek mee", "Kies één ontwerp", "Wat heb je nodig? Een stille hoek"]) {
      expect(lineConflict(ok, { solo: true, onlineOnly: true, indoor: true })).toBeNull();
    }
  });

  it("lists every problem of a fill as block:rule", () => {
    const bad = checkFill(fill({ suggestions: ["Neem iemand mee", "Notitie", "Nog eens"], timeline: ["Rij erheen", "Draaien", "Afwerken", "Parkeer weer"] })).fill!;
    expect(fillConflicts(bad, solo)).toEqual(["suggestions:solo"]);
    expect(fillConflicts(bad, online)).toEqual(["timeline:onlineOnly"]);
    expect(fillConflicts(bad, none)).toEqual([]);
  });

  it("filters template lines, and keeps the original list rather than printing nothing", () => {
    expect(withoutConflicts(["Bring someone you enjoy", "Zet je telefoon op stil"], solo)).toEqual(["Zet je telefoon op stil"]);
    expect(withoutConflicts(["Bring someone you enjoy"], solo)).toEqual(["Bring someone you enjoy"]);
  });

  it("is what makes the shipped templates safe: for every kind, enough lines stay for a solo idea", () => {
    const kinds: ActivityKind[] = ["creative", "cultural", "outdoor", "active", "water", "food", "social", "restful", "adventure", "market"];
    for (const locale of ["nl", "en"] as const) {
      for (const kind of kinds) {
        const copy = kindCopy(kind, locale);
        for (const lines of [copy.takeaways, copy.suggestions]) {
          const kept = lines.filter((l) => !lineConflict(l, { solo: true, onlineOnly: true, indoor: true }));
          expect(kept.length, `${kind}/${locale}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it("applies to a real activity from the library", () => {
    const act = getActivity("pottenbakken")!;
    expect(fillContext(act, "solo").solo).toBe(true);
  });
});
