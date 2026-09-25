import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { sendEmail } from "@/lib/resend";
import { escapeHtml, emailShell } from "@/lib/email/layout";
import { buildIdeaBookEmail } from "@/lib/email/windowPlan";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

describe("sendEmail", () => {
  beforeEach(() => send.mockReset());

  it("returns the message id when Resend accepts the mail", async () => {
    send.mockResolvedValue({ data: { id: "msg_1" }, error: null });
    await expect(sendEmail({ from: "a@b.nl", to: "c@d.nl", subject: "s", html: "<p>x</p>" })).resolves.toEqual({ id: "msg_1" });
  });

  it("throws when Resend answers with an error instead of throwing itself", async () => {
    // Resend's SDK resolves with { data: null, error } for e.g. an unverified
    // sender domain — without this, the mail would be recorded as delivered.
    send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "The windowinto.nl domain is not verified." },
    });
    await expect(sendEmail({ from: "a@b.nl", to: "c@d.nl", subject: "s", html: "x" })).rejects.toThrow(
      /validation_error.*not verified/
    );
  });

  it("throws when there is neither data nor an error", async () => {
    send.mockResolvedValue({ data: null, error: null });
    await expect(sendEmail({ from: "a@b.nl", to: "c@d.nl", subject: "s", html: "x" })).rejects.toThrow();
  });
});

describe("escapeHtml", () => {
  it("neutralises markup and quotes", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;"
    );
  });
});

const idea = (title: string, intro: string): IdeaBookEntry => ({ title, intro }) as IdeaBookEntry;

const book: GeneratedIdeaBook = {
  profile_summary: "Je zoekt <b>rust</b> & ruimte.",
  must_haves: [],
  preferences: [],
  ideas: [idea("Klei & meer", "Een <i>echte</i> workshop"), idea("Tweede", "Intro")],
  wildcard: idea("Wildcard <x>", "Gek idee"),
  labels: {
    steps_heading: "",
    first_action_heading: "",
    wildcard_heading: "",
    time_label: "",
    cost_label: "",
    location_heading: "",
    requirements_heading: "",
  },
};

describe("buildIdeaBookEmail", () => {
  const params = {
    title: "Jouw Window Idea Book",
    book,
    planUrl: "https://windowinto.nl/plan?checkout_session_id=cs_test_1",
    locale: "nl" as const,
    siteUrl: "https://windowinto.nl",
    order: { orderNumber: "W-0001", amountCents: 350, currency: "eur", orderDate: new Date("2026-09-25"), termsVersion: "1" },
  };

  it("escapes generated text so it can never become markup", () => {
    const { html } = buildIdeaBookEmail(params);
    expect(html).not.toContain("<b>rust</b>");
    expect(html).toContain("&lt;b&gt;rust&lt;/b&gt; &amp; ruimte.");
    expect(html).toContain("Klei &amp; meer");
    expect(html).toContain("Wildcard &lt;x&gt;");
  });

  it("states what was bought, links to the book, and shows the order data", () => {
    const { subject, html } = buildIdeaBookEmail(params);
    expect(subject).toBe("Jouw Window Idea Book: je mogelijkheden zijn klaar");
    expect(html).toContain("Je Idea Book staat klaar");
    expect(html).toContain("https://windowinto.nl/plan?checkout_session_id=cs_test_1");
    expect(html).toContain("W-0001");
    expect(html).toContain("€3,50");
    expect(html).toContain("bijlage");
  });

  it("renders in English too", () => {
    const { subject, html } = buildIdeaBookEmail({ ...params, locale: "en" });
    expect(subject).toContain("your possibilities are ready");
    expect(html).toContain("Your Idea Book is ready");
    expect(html).toContain("€3.50");
  });
});

describe("emailShell", () => {
  it("wraps content with a hidden preheader and optional footer", () => {
    const html = emailShell({ preheader: "Voorproef", bodyHtml: "<p>Hallo</p>", footerHtml: "voet" });
    expect(html).toContain("Voorproef");
    expect(html).toContain("<p>Hallo</p>");
    expect(html).toContain("voet");
    expect(html).toContain("display:none");
  });
});
