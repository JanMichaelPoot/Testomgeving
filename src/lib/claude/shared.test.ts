import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertMissingClosers, repairStringifiedFields } from "@/lib/claude/shared";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("repairStringifiedFields", () => {
  it("turns a list that came back as a JSON string into the list, and logs it", () => {
    const out = repairStringifiedFields({ ideas: '[{"title":"A"},{"title":"B"}]', wildcard: { title: "W" } }, "create_idea_book") as {
      ideas: { title: string }[];
      wildcard: { title: string };
    };
    expect(out.ideas.map((i) => i.title)).toEqual(["A", "B"]);
    expect(out.wildcard.title).toBe("W");
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it("drops stray text after a valid JSON list", () => {
    const out = repairStringifiedFields({ ideas: '[{"title":"A"}] Hope this helps!' }) as { ideas: { title: string }[] };
    expect(out.ideas.map((i) => i.title)).toEqual(["A"]);
  });

  it("parses an object given as a string too", () => {
    expect((repairStringifiedFields({ wildcard: '{"title":"W"}' }) as { wildcard: { title: string } }).wildcard.title).toBe("W");
  });

  it("leaves ordinary text alone, also text that starts with a bracket but is no JSON", () => {
    const input = { profile_summary: "Een stille zoeker.", note: "[nog invullen]", n: "[1, 2", flag: true };
    expect(repairStringifiedFields(input)).toEqual(input);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("does not turn a string into a number, a bare string or null", () => {
    const input = { a: "123", b: '"x"', c: "null" };
    expect(repairStringifiedFields(input)).toEqual(input);
  });

  it("passes anything that is not a plain object straight through", () => {
    expect(repairStringifiedFields(null)).toBeNull();
    expect(repairStringifiedFields([1, 2])).toEqual([1, 2]);
    expect(repairStringifiedFields("text")).toBe("text");
  });
});

describe("a list string that forgot a closing bracket (seen in a real generation: \"Unexpected token ']'\")", () => {
  const broken = '[{"title":"A","first_action":"Bel \\"De Poort\\"."},{"title":"B","first_action":"Loop ]binnen."]';

  it("puts the missing brace back and keeps what was written, also brackets inside text", () => {
    expect(insertMissingClosers(broken)).toBe('[{"title":"A","first_action":"Bel \\"De Poort\\"."},{"title":"B","first_action":"Loop ]binnen."}]');
    const out = repairStringifiedFields({ ideas: broken }, "create_idea_book") as { ideas: { title: string; first_action: string }[] };
    expect(out.ideas.map((i) => i.title)).toEqual(["A", "B"]);
    expect(out.ideas[1].first_action).toBe("Loop ]binnen.");
  });

  it("does not repair a text that just ends early, a closer with nothing open, or valid JSON", () => {
    expect(insertMissingClosers('[{"title":"A"')).toBeNull();
    expect(insertMissingClosers('{"a":1}]')).toBeNull();
    expect(insertMissingClosers('[{"title":"A"}]')).toBeNull();
    expect(repairStringifiedFields({ n: "[1, 2" })).toEqual({ n: "[1, 2" });
  });

  it("gives up when more than a few brackets are missing", () => {
    expect(insertMissingClosers('[{"a":{"b":{"c":{"d":1]')).toBeNull();
  });
});
