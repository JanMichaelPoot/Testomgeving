import { describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("@/lib/resend", () => ({ sendEmail: (...args: unknown[]) => send(...args) }));

import { buildCompensationEmail, sendCompensationEmail } from "@/lib/email/compensation";
import { SUPPORT_EMAIL } from "@/lib/supportEmail";

const params = {
  code: "WI-ABCD-EFGH",
  amountCents: 250,
  expiresAt: new Date("2027-02-21T12:00:00Z"),
  orderNumber: "WI-2026-000069",
  siteUrl: "https://windowinto.nl",
};

describe("the compensation mail (Step 235)", () => {
  it("apologises, shows the code with its worth and date, and links to a new intake in the buyer's language", () => {
    const { subject, html, text } = buildCompensationEmail({ ...params, locale: "nl" });
    expect(subject).toBe("Onze excuses: een extra kortingscode voor je volgende Idea Book");
    expect(html).toContain("Een plek klopte niet");
    expect(html).toContain("WI-ABCD-EFGH");
    expect(html).toContain("€2,50");
    expect(html).toContain("21 februari 2027");
    expect(html).toContain("https://windowinto.nl/intake?lang=nl");
    expect(html).toContain("WI-2026-000069");
    expect(html).toContain(SUPPORT_EMAIL);
    expect(text).toContain("Jouw kortingscode: WI-ABCD-EFGH");
    expect(text).toContain("https://windowinto.nl/intake?lang=nl");
  });

  it("is written in English too", () => {
    const { subject, html, text } = buildCompensationEmail({ ...params, locale: "en" });
    expect(subject).toBe("Our apologies: an extra discount code for your next Idea Book");
    expect(html).toContain("A place was not right");
    expect(html).toContain("€2.50");
    expect(html).toContain("Valid until 21 February 2027");
    expect(html).toContain("https://windowinto.nl/intake?lang=en");
    expect(text).toContain("Your discount code: WI-ABCD-EFGH");
  });

  it("leaves out the order line without a number, and escapes the code like any other text", () => {
    const { html } = buildCompensationEmail({ ...params, locale: "nl", orderNumber: null, code: "<b>x</b>" });
    expect(html).not.toContain("Over je bestelling");
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("is sent from the site's address with replies going to the support address", async () => {
    send.mockReset();
    send.mockResolvedValue({ id: "msg_1", from: "x" });
    process.env.EMAIL_FROM = "WindowInto <hello@windowinto.nl>";
    await sendCompensationEmail({ ...params, locale: "nl", to: "buyer@example.com" });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ from: "WindowInto <hello@windowinto.nl>", to: "buyer@example.com", replyTo: SUPPORT_EMAIL, subject: expect.stringContaining("excuses") }));
  });
});
