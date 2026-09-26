import { describe, expect, it } from "vitest";
import { describeDiscoveryForPrompt, sanitizeDiscoveryAnswers } from "@/lib/discovery/answers";
import { ALL_ACTIVITIES, DOMAINS } from "@/lib/discovery/library";

const realId = ALL_ACTIVITIES[0].id;
const realDomain = DOMAINS[0].id;

describe("sanitizeDiscoveryAnswers", () => {
  it("keeps real ids and drops everything else", () => {
    const out = sanitizeDiscoveryAnswers({
      interests: [realId, "not-a-thing", 42, "<script>alert(1)</script>"],
      interestDomains: [realDomain, "nowhere"],
      socialFormats: ["solo", "hacked"],
      surpriseMe: true,
    });
    expect(out.interests).toEqual([realId]);
    expect(out.interestDomains).toEqual([realDomain]);
    expect(out.socialFormats).toEqual(["solo"]);
    expect(out.surpriseMe).toBe(true);
  });

  it("de-duplicates and caps the number of interests", () => {
    const many = ALL_ACTIVITIES.map((a) => a.id);
    const out = sanitizeDiscoveryAnswers({ interests: [realId, realId, ...many] });
    expect(out.interests.filter((id) => id === realId)).toHaveLength(1);
    expect(out.interests.length).toBeLessThanOrEqual(60);
  });

  it("lets 'no preference' and 'depends on the day' stand alone", () => {
    expect(sanitizeDiscoveryAnswers({ socialFormats: ["solo", "any", "duo"] }).socialFormats).toEqual(["any"]);
    expect(sanitizeDiscoveryAnswers({ socialFormats: ["varies", "any"] }).socialFormats).toEqual(["varies"]);
  });

  it("copes with missing or malformed input", () => {
    expect(sanitizeDiscoveryAnswers({})).toEqual({ interests: [], interestDomains: [], socialFormats: [], surpriseMe: false });
    expect(sanitizeDiscoveryAnswers({ interests: "hardlopen", surpriseMe: "yes" })).toEqual({
      interests: [],
      interestDomains: [],
      socialFormats: [],
      surpriseMe: false,
    });
  });
});

describe("describeDiscoveryForPrompt", () => {
  it("is empty for someone who did not use the card wizard", () => {
    expect(describeDiscoveryForPrompt({})).toBe("");
  });

  it("names the picked activities and worlds in English", () => {
    const text = describeDiscoveryForPrompt({ interests: ["hardlopen", "yoga"], interestDomains: ["movement"] });
    expect(text).toContain("Running");
    expect(text).toContain("Yoga");
    expect(text).toContain("Sport, movement & adventure");
  });

  it("presents the social answer as an explicit preference, not a trait", () => {
    const text = describeDiscoveryForPrompt({ socialFormats: ["drop_in_alone", "solo"] });
    expect(text).toContain("their explicit answer");
    expect(text).toContain("coming alone and doing it together");
    expect(text).not.toMatch(/introvert|shy|extrovert/i);
  });

  it("treats 'surprise me' as a choice rather than missing data", () => {
    expect(describeDiscoveryForPrompt({ surpriseMe: true })).toContain("a choice, not missing data");
  });
});
