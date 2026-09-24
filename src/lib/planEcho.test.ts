import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildPlanEcho, formatSituationForEcho, truncateAtWord } from "./planEcho";

describe("formatSituationForEcho", () => {
  it("returns null for empty or whitespace-only input", () => {
    expect(formatSituationForEcho("")).toBeNull();
    expect(formatSituationForEcho("   \n ")).toBeNull();
    expect(formatSituationForEcho(undefined)).toBeNull();
  });

  it("keeps the person's own words and adds a closing period", () => {
    expect(formatSituationForEcho("Ik verveel me al weken")).toBe("Ik verveel me al weken.");
  });

  it("does not double up terminal punctuation", () => {
    expect(formatSituationForEcho("Ik weet het niet?")).toBe("Ik weet het niet?");
    expect(formatSituationForEcho("Wat een week!")).toBe("Wat een week!");
  });

  it("collapses inner whitespace and newlines", () => {
    expect(formatSituationForEcho("een  zware\nweek")).toBe("een zware week.");
  });

  it("cuts long text at a word boundary with an ellipsis", () => {
    const long = "Ik ben al heel lang aan het zoeken naar iets wat me weer energie geeft, maar ik weet niet waar ik moet beginnen met kijken";
    const result = formatSituationForEcho(long)!;
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(91);
    // The cut never lands mid-word: what precedes the ellipsis is a
    // prefix of the original that ends right before a space.
    const body = result.slice(0, -1);
    expect(long.startsWith(body)).toBe(true);
    expect(long[body.length]).toBe(" ");
  });
});

describe("truncateAtWord", () => {
  it("leaves short text untouched", () => {
    expect(truncateAtWord("kort", 90)).toBe("kort");
  });

  it("hard-cuts a single token that has no space", () => {
    expect(truncateAtWord("a".repeat(120), 90)).toBe(`${"a".repeat(90)}…`);
  });
});

describe("buildPlanEcho", () => {
  const dict = getDictionary("nl").intake;

  it("maps stored values to localised chip labels", () => {
    const echo = buildPlanEcho(
      {
        situation: "Ik verveel me al weken",
        location: "Haarlem",
        timeAvailable: "halfday",
        budget: "25",
        company: ["alone"],
      },
      dict
    );
    expect(echo.situation).toBe("Ik verveel me al weken.");
    expect(echo.chips).toEqual(["Haarlem", "Een halve dag", "Tot €25", "Alleen ik"]);
  });

  it("uses the other locale's labels for the same stored values", () => {
    const echo = buildPlanEcho({ timeAvailable: "halfday" }, getDictionary("en").intake);
    expect(echo.chips).toHaveLength(1);
    expect(echo.chips[0]).not.toBe("Een halve dag");
  });

  it("skips empty and unknown values instead of showing raw ones", () => {
    const echo = buildPlanEcho(
      { location: "  ", timeAvailable: "nonsense", budget: "", company: ["ghost"] },
      dict
    );
    expect(echo.chips).toEqual([]);
  });

  it("joins several company answers into one chip", () => {
    const echo = buildPlanEcho({ company: ["partner", "friends"] }, dict);
    expect(echo.chips).toEqual(["Een partner, Vrienden"]);
  });

  it("handles a missing intake", () => {
    expect(buildPlanEcho(null, dict)).toEqual({ situation: null, chips: [] });
  });
});
