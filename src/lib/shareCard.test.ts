import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { safeIllustrationPath, shareCardLine, sharedMetadata } from "@/lib/shareCard";

describe("share card text", () => {
  it("counts the doors in both languages and keeps the singular right", () => {
    expect(shareCardLine(getDictionary("nl").shared, 7)).toBe("7 deuren uit één venster");
    expect(shareCardLine(getDictionary("en").shared, 7)).toBe("7 doors from one window");
    expect(shareCardLine(getDictionary("nl").shared, 1)).toBe("Eén deur uit één venster");
  });

  it("never puts a person's name or answers in the card copy", () => {
    for (const locale of ["nl", "en"] as const) {
      const dict = getDictionary(locale).shared;
      const text = [dict.ogTitle, dict.cardLine, dict.cardLineOne, shareCardLine(dict, 7)].join(" ");
      expect(text).not.toMatch(/\{name\}/);
    }
  });
});

describe("sharedMetadata", () => {
  it("has an Open Graph block and a large Twitter card", () => {
    for (const locale of ["nl", "en"] as const) {
      const meta = sharedMetadata(getDictionary(locale).shared, 7);
      expect(meta.openGraph?.title).toBeTruthy();
      expect(meta.openGraph?.description).toContain(shareCardLine(getDictionary(locale).shared, 7));
      expect((meta.twitter as { card?: string }).card).toBe("summary_large_image");
    }
  });

  it("still has a description when the book has no doors", () => {
    const dict = getDictionary("nl").shared;
    expect(sharedMetadata(dict, 0).openGraph?.description).toBe(dict.intro);
  });
});

describe("safeIllustrationPath", () => {
  it("only lets our own illustrations into the card", () => {
    expect(safeIllustrationPath("/illustrations/associations/a-b_c.jpg")).toBe("/illustrations/associations/a-b_c.jpg");
    expect(safeIllustrationPath("/illustrations/../.env.jpg")).toBeNull();
    expect(safeIllustrationPath("/etc/passwd")).toBeNull();
    expect(safeIllustrationPath("https://example.com/x.jpg")).toBeNull();
    expect(safeIllustrationPath("/illustrations/x.png")).toBeNull();
  });
});
