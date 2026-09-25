import { sendEmail } from "@/lib/resend";
import { EMAIL_COLORS as c, EMAIL_FONTS, emailButton, emailShell, escapeHtml } from "@/lib/email/layout";
import type { GeneratedIdeaBook } from "@/lib/claude/generateIdeaBook";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/language";
import { formatAmount } from "@/lib/pricing";

// Builds the order confirmation + delivery e-mail: what was bought, a way to
// open it (button + the PDF attached), the six ideas and the wildcard at a
// glance, the order data, and the legal re-statements a digital sale needs.
// Split from the sending so the exact HTML can be reviewed without sending.
export function buildIdeaBookEmail(params: {
  title: string;
  book: GeneratedIdeaBook;
  planUrl: string;
  locale: Locale;
  siteUrl: string;
  // Model C digital sale compliance (section 17: "correcte orderbevestiging").
  // A real order confirmation needs the order itself, not just the
  // generated content: the order number, the amount actually charged for
  // *this* order (not the live price constant — a past order keeps
  // showing what it actually cost even if the price changes later), the
  // checkout date, and a re-statement of the consent given at checkout, so
  // the digital-delivery consent and the resulting loss of the statutory
  // withdrawal right are demonstrable from the e-mail itself, not only
  // from the database.
  order: {
    orderNumber: string;
    amountCents: number;
    currency: string;
    orderDate: Date;
    termsVersion: string;
  };
}): { subject: string; html: string } {
  const { title, book, planUrl, locale, siteUrl, order } = params;
  const fullDict = getDictionary(locale);
  const dict = fullDict.email;

  const price = formatAmount(order.amountCents, order.currency, locale);
  const orderDateFormatted = new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    dateStyle: "long",
  }).format(order.orderDate);
  const termsUrl = `${siteUrl}/terms`;
  const legalInfoUrl = `${siteUrl}/herroepingsrecht`;
  const wildcardHeading = book.labels.wildcard_heading || fullDict.pdfChrome.wildcardFallbackHeading;

  const eyebrow = (text: string) =>
    `<p style="margin:0 0 8px;font-family:${EMAIL_FONTS.sans};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${c.accent};">${escapeHtml(text)}</p>`;

  const ideasHtml = book.ideas
    .map(
      (idea, i) => `<tr>
        <td valign="top" style="padding:0 14px 16px 0;width:26px;font-family:${EMAIL_FONTS.serif};font-size:20px;color:${c.gold};">${i + 1}</td>
        <td valign="top" style="padding:0 0 16px;">
          <p style="margin:0;font-family:${EMAIL_FONTS.serif};font-size:17px;line-height:1.3;color:${c.ink};font-weight:bold;">${escapeHtml(idea.title)}</p>
          <p style="margin:4px 0 0;font-size:14px;line-height:1.55;color:${c.muted};">${escapeHtml(idea.intro)}</p>
        </td>
      </tr>`
    )
    .join("");

  const orderRow = (label: string, value: string, bold = false) => `<tr>
      <td style="padding:5px 0;font-size:13px;color:${c.muted};">${escapeHtml(label)}</td>
      <td align="right" style="padding:5px 0;font-size:13px;color:${c.ink};${bold ? "font-weight:600;" : ""}">${escapeHtml(value)}</td>
    </tr>`;

  const bodyHtml = `
    ${eyebrow(title)}
    <h1 style="margin:0 0 14px;font-family:${EMAIL_FONTS.serif};font-size:30px;line-height:1.2;font-weight:normal;color:${c.ink};letter-spacing:-0.01em;">${escapeHtml(dict.readyHeading)}</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:${c.muted};">${escapeHtml(book.profile_summary)}</p>

    ${emailButton(planUrl, dict.viewOnline)}
    <p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:${c.muted};">${escapeHtml(dict.attachmentNote)}</p>

    <hr style="border:0;border-top:1px solid ${c.border};margin:28px 0 22px;">
    ${eyebrow(dict.heading)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">${ideasHtml}</table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">
      <tr><td bgcolor="${c.panel}" style="background:${c.panel};border:1px solid ${c.gold};border-radius:12px;padding:16px 18px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${c.gold};">${escapeHtml(wildcardHeading)}</p>
        <p style="margin:0;font-size:14px;line-height:1.55;color:${c.ink};"><strong>${escapeHtml(book.wildcard.title)}</strong> — ${escapeHtml(book.wildcard.intro)}</p>
      </td></tr>
    </table>

    <hr style="border:0;border-top:1px solid ${c.border};margin:28px 0 18px;">
    ${eyebrow(dict.orderHeading)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${orderRow(dict.orderNumberLabel, order.orderNumber, true)}
      ${orderRow(dict.priceLabel, price, true)}
      ${orderRow(dict.dateLabel, orderDateFormatted)}
    </table>
    <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${c.muted};">${escapeHtml(dict.digitalDeliveryNote)}</p>
    <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:${c.muted};">${escapeHtml(dict.consentConfirmation)}</p>
    <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:${c.muted};">
      ${escapeHtml(dict.termsVersionLabel.replace("{termsVersion}", order.termsVersion))}
      &nbsp;·&nbsp; <a href="${escapeHtml(termsUrl)}" style="color:${c.accent};">${escapeHtml(dict.termsLinkText)}</a>
      &nbsp;·&nbsp; <a href="${escapeHtml(legalInfoUrl)}" style="color:${c.accent};">${escapeHtml(dict.legalInfoLinkText)}</a>
    </p>`;

  return {
    subject: `${title}: ${dict.subjectSuffix}`,
    html: emailShell({
      preheader: `${dict.readyHeading} — ${dict.attachmentNote}`,
      bodyHtml,
      footerHtml: escapeHtml(dict.companyInfo),
    }),
  };
}

export async function sendIdeaBookEmail(
  params: Parameters<typeof buildIdeaBookEmail>[0] & { to: string; pdfBytes: Uint8Array }
) {
  const { to, pdfBytes, ...rest } = params;
  const { subject, html } = buildIdeaBookEmail(rest);

  await sendEmail({
    from: process.env.EMAIL_FROM!,
    to,
    subject,
    html,
    attachments: [
      {
        filename: "idea-book.pdf",
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });
}
