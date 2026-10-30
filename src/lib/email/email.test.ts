import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { TEST_SENDER, isUnverifiedDomainError, sendEmail } from "@/lib/resend";
import { escapeHtml, emailImages, emailShell } from "@/lib/email/layout";
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

  it("tries once more from the test sender when the sending domain is not verified, so a test setup still gets its mail", async () => {
    send
      .mockResolvedValueOnce({ data: null, error: { name: "validation_error", message: "The windowinto.nl domain is not verified. Please add and verify your domain." } })
      .mockResolvedValueOnce({ data: { id: "msg_2" }, error: null });
    await expect(sendEmail({ from: "WINDOW <hello@windowinto.nl>", to: "owner@d.nl", subject: "s", html: "x" })).resolves.toEqual({ id: "msg_2" });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0].from).toBe(TEST_SENDER);
    expect(send.mock.calls[1][0].to).toBe("owner@d.nl");
  });

  it("does not retry for other refusals, nor when it already was the test sender", async () => {
    send.mockResolvedValue({ data: null, error: { name: "invalid_api_key", message: "API key is invalid" } });
    await expect(sendEmail({ from: "a@b.nl", to: "c@d.nl", subject: "s", html: "x" })).rejects.toThrow(/invalid_api_key/);
    expect(send).toHaveBeenCalledTimes(1);
    send.mockReset();
    send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "You can only send testing emails to your own email address" } });
    await expect(sendEmail({ from: TEST_SENDER, to: "x@y.nl", subject: "s", html: "x" })).rejects.toThrow(/own email/);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("recognises the unverified-domain refusal only", () => {
    expect(isUnverifiedDomainError({ message: "The windowinto.nl domain is not verified." })).toBe(true);
    expect(isUnverifiedDomainError({ message: "You can only send testing emails to your own email address" })).toBe(false);
    expect(isUnverifiedDomainError(null)).toBe(false);
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

const idea = (title: string, intro: string, extra: Partial<IdeaBookEntry> = {}): IdeaBookEntry =>
  ({ title, intro, photo_category: "creative_workshop", ...extra }) as IdeaBookEntry;

const book: GeneratedIdeaBook = {
  profile_summary: "Je zoekt <b>rust</b> & ruimte.",
  must_haves: [],
  preferences: [],
  ideas: [idea("Klei & meer", "Een <i>echte</i> workshop"), idea("Tweede", "Intro", { first_action: "Open de site en boek een plek." })],
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
    expect(html).toContain("Je venster staat open");
    expect(html).toContain("https://windowinto.nl/plan?checkout_session_id=cs_test_1");
    expect(html).toContain("W-0001");
    expect(html).toContain("€3,50");
    expect(html).toContain("bijlage");
  });

  it("renders in English too", () => {
    const { subject, html } = buildIdeaBookEmail({ ...params, locale: "en" });
    expect(subject).toContain("your possibilities are ready");
    expect(html).toContain("Your window is open");
    expect(html).toContain("€3.50");
  });
});

describe("buildIdeaBookEmail: look and content", () => {
  const params = {
    title: "Jouw Window Idea Book",
    book,
    planUrl: "https://windowinto.nl/plan?checkout_session_id=cs_test_1",
    locale: "nl" as const,
    siteUrl: "https://windowinto.nl",
    order: { orderNumber: "W-0001", amountCents: 350, currency: "eur", orderDate: new Date("2026-09-25"), termsVersion: "1" },
  };

  it("is built in the logo's colours, with no walnut brown left", () => {
    const { html } = buildIdeaBookEmail(params);
    expect(html).toContain("#F5A623"); // the orange of the button
    expect(html).not.toMatch(/#5B3F2F|#3C2920|#B08A4A|#F2ECE1|#F7F5F0/i);
  });

  it("shows the header and a small photo per door when the site is public, and works without them", () => {
    const withImages = buildIdeaBookEmail(params).html;
    expect(withImages).toContain("https://windowinto.nl/email/header.jpg");
    expect(withImages).toContain("https://windowinto.nl/email/thumbs/categories/creative_workshop-1.jpg");
    const local = buildIdeaBookEmail({ ...params, siteUrl: "http://localhost:3000" }).html;
    expect(local).not.toContain("<img");
    expect(local).toContain("Klei &amp; meer");
  });

  it("offers a first step from the book and a plain-text twin", () => {
    const { html, text } = buildIdeaBookEmail(params);
    expect(html).toContain("Begin klein");
    expect(html).toContain("Open de site en boek een plek.");
    expect(text).toContain("https://windowinto.nl/plan?checkout_session_id=cs_test_1");
    expect(text).toContain("1. Klei & meer");
    expect(text).toContain("W-0001");
    expect(text).not.toMatch(/<\/?(table|td|tr|img|a|p|div|span|hr)[\s>]/i);
  });

  it("says how many doors there are, the wildcard included", () => {
    expect(buildIdeaBookEmail(params).html).toContain("3 deuren");
  });

  it("names the discovery level of each door, and shows nothing for a book without levels", () => {
    const withLevels: GeneratedIdeaBook = {
      ...book,
      ideas: [idea("Klei & meer", "Intro", { level: 1 }), idea("Tweede", "Intro", { level: 3 })],
      wildcard: idea("Wildcard", "Gek idee", { level: 7 }),
    };
    const nl = buildIdeaBookEmail({ ...params, book: withLevels });
    expect(nl.html).toContain("Niveau 1 · Vertrouwd");
    expect(nl.html).toContain("Niveau 3 · Verwant");
    expect(nl.html).toContain("Niveau 7 · Onontdekt");
    expect(nl.text).toContain("1. [Niveau 1 · Vertrouwd] Klei & meer");
    expect(nl.text).toContain("(Niveau 7 · Onontdekt)");
    expect(buildIdeaBookEmail({ ...params, book: withLevels, locale: "en" }).html).toContain("Level 7 · Undiscovered");
    expect(buildIdeaBookEmail(params).html).not.toMatch(/Niveau \d/);
  });
});

describe("emailImages", () => {
  it("only hands out public https addresses", () => {
    expect(emailImages("https://windowinto.nl")?.header).toBe("https://windowinto.nl/email/header.jpg");
    for (const bad of ["http://windowinto.nl", "http://localhost:3000", "https://localhost", "https://192.168.1.4", "", "nonsense", undefined]) {
      expect(emailImages(bad), String(bad)).toBeNull();
    }
  });

  it("maps an idea photo to its small twin and nothing else", () => {
    const img = emailImages("https://windowinto.nl")!;
    expect(img.thumb("/illustrations/discovery/escape-room.jpg")).toBe("https://windowinto.nl/email/thumbs/discovery/escape-room.jpg");
    expect(img.thumb("/illustrations/idea-book/categories/art_culture-2.jpg")).toBe("https://windowinto.nl/email/thumbs/categories/art_culture-2.jpg");
    expect(img.thumb("/somewhere/else.jpg")).toBeNull();
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
