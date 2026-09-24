import { describe, expect, it } from "vitest";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { pickReminderIdea } from "./reminderIdea";

const idea = (title: string) => ({ title }) as IdeaBookEntry;

describe("pickReminderIdea", () => {
  const ideas = [idea("first"), idea("second"), idea("third")];
  const wildcard = idea("wild");

  it("falls back to the first idea when nothing was committed", () => {
    expect(pickReminderIdea(ideas, wildcard, null)?.title).toBe("first");
    expect(pickReminderIdea(ideas, wildcard, undefined)?.title).toBe("first");
  });

  it("uses the committed idea instead of the first one", () => {
    expect(pickReminderIdea(ideas, wildcard, "idea-2")?.title).toBe("third");
  });

  it("uses the wildcard when that is what was committed", () => {
    expect(pickReminderIdea(ideas, wildcard, "wildcard")?.title).toBe("wild");
  });

  it("falls back to the first idea when the stored key no longer resolves", () => {
    expect(pickReminderIdea(ideas, wildcard, "idea-9")?.title).toBe("first");
    expect(pickReminderIdea(ideas, null, "wildcard")?.title).toBe("first");
  });

  it("returns null for a plan without any ideas", () => {
    expect(pickReminderIdea([], null, null)).toBeNull();
  });
});
