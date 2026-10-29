import { describe, expect, it } from "vitest";
import { knowledgeEngineV2Enabled, knowledgeRankingV2Enabled, knowledgeWritingV2Enabled } from "@/lib/knowledgeFlags";

describe("the knowledge flags (D9: ranking and writing are separate)", () => {
  it("are off by default", () => {
    expect(knowledgeRankingV2Enabled(undefined, undefined)).toBe(false);
    expect(knowledgeWritingV2Enabled(undefined, undefined)).toBe(false);
    expect(knowledgeEngineV2Enabled(undefined)).toBe(false);
  });

  it("switch on separately: ranking without writing and the other way round", () => {
    expect(knowledgeRankingV2Enabled("1", undefined)).toBe(true);
    expect(knowledgeWritingV2Enabled(undefined, undefined)).toBe(false);
    expect(knowledgeWritingV2Enabled("true", undefined)).toBe(true);
    expect(knowledgeRankingV2Enabled(undefined, undefined)).toBe(false);
  });

  it("accept 1/true/yes/on in any case with stray quotes or spaces, and nothing else", () => {
    for (const v of ["1", "TRUE", " yes ", '"on"', "'On'"]) expect(knowledgeRankingV2Enabled(v, undefined), v).toBe(true);
    for (const v of ["0", "false", "", "maybe", "no"]) expect(knowledgeRankingV2Enabled(v, undefined), v).toBe(false);
  });

  it("let the old KNOWLEDGE_ENGINE_V2 mean both on, so an existing deployment behaves as before", () => {
    expect(knowledgeRankingV2Enabled(undefined, "1")).toBe(true);
    expect(knowledgeWritingV2Enabled(undefined, "1")).toBe(true);
    expect(knowledgeRankingV2Enabled("0", "1")).toBe(true); // the legacy switch still wins when set
  });
});
