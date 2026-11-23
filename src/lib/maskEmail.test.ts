import { describe, expect, it } from "vitest";
import { maskEmail } from "@/lib/maskEmail";

describe("maskEmail", () => {
  it("keeps the first letter and the whole domain, so a wrong address can be spotted and a right one is not readable", () => {
    expect(maskEmail("jan.poot@arconacapital.com")).toBe("j***@arconacapital.com");
    expect(maskEmail("  A@b.nl ")).toBe("A***@b.nl");
  });

  it("gives nothing for what is not an address", () => {
    for (const bad of [null, undefined, "", "no-at-sign", "a@b", "two words@x.nl", "a@@b.nl"]) expect(maskEmail(bad)).toBeNull();
  });
});
