import { describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("@/lib/resend", () => ({ sendEmail: (...args: unknown[]) => send(...args) }));

import { buildCheckinEmail, sendCheckinEmail } from "@/lib/email/checkin";
import { COMPANY_LINE } from "@/lib/company";

const params = {
  answerUrls: { done: "https://windowinto.nl/terugkoppeling?t=T&a=done", planned: "https://windowinto.nl/terugkoppeling?t=T&a=planned", not: "https://windowinto.nl/terugkoppeling?t=T&a=not" },
  optoutUrl: "https://windowinto.nl/afmelden?c=O",
  siteUrl: "https://windowinto.nl",
};

describe("the check-in mail (Step 243)", () => {
  it("asks in Dutch, with the idea the buyer chose, three equal buttons and an opt-out", () => {
    const { subject, html, text } = buildCheckinEmail({ ...params, locale: "nl", ideaTitle: "Mahjong leren spelen" });
    expect(subject).toBe("Heb je al iets gedaan met je Idea Book?");
    expect(html).toContain("Mahjong leren spelen");
    for (const answer of ["done", "planned", "not"]) expect(html).toContain(`terugkoppeling?t=T&amp;a=${answer}`);
    expect(html).toContain("afmelden?c=O");
    expect(html).toContain(COMPANY_LINE.nl);
    expect(text).toContain("Ja, ik ben ermee aan de slag: https://windowinto.nl/terugkoppeling?t=T&a=done");
    expect(text).toContain("https://windowinto.nl/afmelden?c=O");
  });

  it("asks in general when the buyer chose no idea", () => {
    const { html } = buildCheckinEmail({ ...params, locale: "nl", ideaTitle: null });
    expect(html).toContain("Heb je er al iets uit gedaan, hoe klein ook?");
    expect(html).not.toContain("Je koos");
  });

  it("is written in English for an English book", () => {
    const { subject, html } = buildCheckinEmail({ ...params, locale: "en", ideaTitle: "Learning mahjong" });
    expect(subject).toBe("Have you done anything with your Idea Book yet?");
    expect(html).toContain("You chose");
    expect(html).toContain("Yes, I&#39;m on it");
    expect(html).toContain(COMPANY_LINE.en);
  });

  it("escapes the title like any other text", () => {
    const { html } = buildCheckinEmail({ ...params, locale: "nl", ideaTitle: "<script>x</script> & Co" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("is not a sales mail: no code, no discount, no order button", () => {
    for (const locale of ["nl", "en"] as const) {
      const { html, text } = buildCheckinEmail({ ...params, locale, ideaTitle: null });
      expect(`${html} ${text}`).not.toMatch(/korting|discount|WI-[A-Z0-9]{4}-|intake/i);
    }
  });

  it("is sent from the address of the site", async () => {
    send.mockResolvedValue({ id: "msg", from: "x" });
    process.env.EMAIL_FROM = "WindowInto <hello@windowinto.nl>";
    await sendCheckinEmail({ ...params, locale: "nl", to: "buyer@example.com" });
    expect(send.mock.calls[0][0]).toMatchObject({ to: "buyer@example.com", from: "WindowInto <hello@windowinto.nl>" });
  });
});
