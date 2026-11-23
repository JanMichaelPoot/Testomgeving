import { describe, expect, it } from "vitest";
import { SUPPORT_EMAIL } from "@/lib/supportEmail";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { vensterEn, vensterNl } from "@/lib/i18n/venster";
import { getHomeCopy, CONTACT_EMAIL } from "@/lib/i18n/home";
import { getFollowUpCopy } from "@/lib/i18n/followUp";
import { getCompensationCopy } from "@/lib/i18n/compensation";

// A visitor is sent to one address wherever the site tells them to write (23 Nov 2026): the support address of the company behind WindowInto. The sending address
// of the mails (EMAIL_FROM, on the verified domain windowinto.nl) is a setting, not page copy, and is not this.
describe("the address a visitor is sent to", () => {
  it("is info@vantagelabs.nl, and the home page uses the same constant", () => {
    expect(SUPPORT_EMAIL).toBe("info@vantagelabs.nl");
    expect(CONTACT_EMAIL).toBe(SUPPORT_EMAIL);
  });

  it("is the only address in the text of the site: no page, in either language, still names hello@windowinto.nl", () => {
    for (const locale of ["nl", "en"] as const) {
      const all = JSON.stringify([getDictionary(locale), getHomeCopy(locale), getFollowUpCopy(locale), getCompensationCopy(locale)]) + JSON.stringify(locale === "nl" ? vensterNl : vensterEn);
      expect(all, locale).not.toContain("hello@windowinto.nl");
    }
  });

  it("is what the privacy and terms pages and the unsubscribe page tell a visitor to write to", () => {
    for (const locale of ["nl", "en"] as const) {
      const d = getDictionary(locale);
      const legal = JSON.stringify(d.legal);
      expect(legal).toContain(SUPPORT_EMAIL);
      expect(getFollowUpCopy(locale).unsubscribe.invalid).toContain(SUPPORT_EMAIL);
    }
  });
});
