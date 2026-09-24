import { describe, expect, it } from "vitest";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { ideaKey, resolveIdeaByKey } from "./ideaKeys";

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
