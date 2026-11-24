import { describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("@/lib/resend", () => ({ sendEmail: (...args: unknown[]) => send(...args) }));

import { buildRewardEmail, sendRewardEmail } from "@/lib/email/reward";
import { SUPPORT_EMAIL } from "@/lib/supportEmail";

const params = {
  code: "WI-ABCD-EFGH",
  amountCents: 250,
  expiresAt: new Date("2027-02-21T12:00:00Z"),
  orderNumber: "WI-2026-000069",
  siteUrl: "https://windowinto.nl",
};

describe("the reward mail (Step 239)", () => {
  it("thanks the buyer for sharing, shows the code with its worth and date, and links to a new intake", () => {
    const { subject, html, text } = buildRewardEmail({ ...params, locale: "nl" });
    expect(subject).toBe("Bedankt voor het delen: een kortingscode voor jou");
    expect(html).toContain("Een vriend heeft besteld");
    expect(html).toContain("WI-ABCD-EFGH");
    expect(html).toContain("€2,50");
    expect(html).toContain("21 februari 2027");
    expect(html).toContain("https://windowinto.nl/intake?lang=nl");
    expect(html).toContain("WI-2026-000069");
    expect(html).toContain(SUPPORT_EMAIL);
    expect(text).toContain("Jouw kortingscode: WI-ABCD-EFGH");
  });

  it("is written in English for an English buyer", () => {
    const { subject, html, text } = buildRewardEmail({ ...params, locale: "en" });
    expect(subject).toBe("Thank you for sharing: a discount code for you");
    expect(html).toContain("A friend has ordered");
    expect(html).toContain("€2.50");
    expect(html).toContain("21 February 2027");
    expect(html).toContain("https://windowinto.nl/intake?lang=en");
    expect(text).toContain("Your discount code: WI-ABCD-EFGH");
  });

  it("does not look like the apology mail", () => {
    const { html } = buildRewardEmail({ ...params, locale: "nl" });
    expect(html).not.toContain("excuses");
    expect(html).not.toContain("klopte niet");
  });

  it("never names a friend, and escapes the code like any other text", () => {
    const { html, text } = buildRewardEmail({ ...params, locale: "nl", code: "<b>x</b>" });
    expect(html).not.toContain("<b>x</b>");
    // the only address in it is the support address: nobody else is named
    expect(text.match(/[\w.-]+@[\w.-]+\.[a-z]+/g)).toEqual([SUPPORT_EMAIL]);
  });

  it("is sent from the address of the site, with replies going to the support address", async () => {
    send.mockResolvedValue({ id: "msg", from: "x" });
    process.env.EMAIL_FROM = "WindowInto <hello@windowinto.nl>";
    await sendRewardEmail({ ...params, locale: "nl", to: "buyer@example.com" });
    expect(send.mock.calls[0][0]).toMatchObject({ to: "buyer@example.com", replyTo: SUPPORT_EMAIL, from: "WindowInto <hello@windowinto.nl>" });
  });
});
