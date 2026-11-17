import { describe, expect, it } from "vitest";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { ideaKey, ideaUrl, parseIdeaParam, resolveIdeaByKey } from "./ideaKeys";

const idea = (title: string) => ({ title }) as IdeaBookEntry;

describe("resolveIdeaByKey", () => {
  const ideas = [idea("a"), idea("b"), idea("c")];
  const wildcard = idea("wild");

  it("resolves an idea by its stored index", () => {
    expect(resolveIdeaByKey(ideaKey(1), ideas, wildcard)?.title).toBe("b");
  });

  it("resolves the wildcard", () => {
    expect(resolveIdeaByKey("wildcard", ideas, wildcard)?.title).toBe("wild");
  });

  it("returns null when the wildcard is requested but the plan has none", () => {
    expect(resolveIdeaByKey("wildcard", ideas, null)).toBeNull();
  });

  it("returns null for empty, malformed or out-of-range keys", () => {
    expect(resolveIdeaByKey(null, ideas, wildcard)).toBeNull();
    expect(resolveIdeaByKey("", ideas, wildcard)).toBeNull();
    expect(resolveIdeaByKey("idea-x", ideas, wildcard)).toBeNull();
    expect(resolveIdeaByKey("idea-3", ideas, wildcard)).toBeNull();
    expect(resolveIdeaByKey("idea-1; drop", ideas, wildcard)).toBeNull();
  });
});

describe("links to one idea", () => {
  it("adds the idea to a plan address with or without a query", () => {
    expect(ideaUrl("https://windowinto.nl/plan?checkout_session_id=cs_1", "idea-2")).toBe("https://windowinto.nl/plan?checkout_session_id=cs_1&idee=idea-2");
    expect(ideaUrl("https://windowinto.nl/plan", "wildcard")).toBe("https://windowinto.nl/plan?idee=wildcard");
  });

  it("accepts an idea key from an address and nothing else", () => {
    expect(parseIdeaParam("idea-0")).toBe("idea-0");
    expect(parseIdeaParam("idea-12")).toBe("idea-12");
    expect(parseIdeaParam("wildcard")).toBe("wildcard");
    for (const bad of ["idea-", "idea-x", "idea-123", "../x", "<script>", "", ["idea-1", "idea-2"], undefined, null, 3]) {
      expect(parseIdeaParam(bad), String(bad)).toBeNull();
    }
  });
});
