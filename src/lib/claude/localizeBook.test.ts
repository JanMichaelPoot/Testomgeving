import { describe, expect, it } from "vitest";
import { localizeShort } from "@/lib/claude/localizeBook";

describe("localizeShort", () => {
  it("turns Dutch cost habits into English in an English book", () => {
    expect(localizeShort("Gratis", "en")).toBe("Free");
    expect(localizeShort("Gratis (trial lesson)", "en")).toBe("Free (trial lesson)");
    expect(localizeShort("vanaf €10, prijs varieert", "en")).toBe("From €10, price varies");
  });

  it("turns English cost words into Dutch in a Dutch book, and leaves amounts alone", () => {
    expect(localizeShort("Free", "nl")).toBe("Gratis");
    expect(localizeShort("€25–40", "nl")).toBe("€25–40");
    expect(localizeShort("€25–40", "en")).toBe("€25–40");
  });
});
