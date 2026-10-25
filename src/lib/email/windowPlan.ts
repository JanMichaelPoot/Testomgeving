import { sendEmail } from "@/lib/resend";
import { EMAIL_COLORS as c, EMAIL_FONTS, emailButton, emailEyebrow, emailImages, emailShell, escapeHtml } from "@/lib/email/layout";
import type { GeneratedIdeaBook } from "@/lib/claude/generateIdeaBook";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/language";
import { formatAmount } from "@/lib/pricing";
import { ideaPhoto } from "@/lib/illustrations";
import { pickOneThingIndex } from "@/lib/possibilityMap";

// The same pick as the book's "if you only choose one" (easiest to start), and for an older book without
// scores simply the first idea that has a first step: a mail must never fail because of a missing field.
function pickStartIdea(ideas: GeneratedIdeaBook["ideas"]) {
  try {
    const index = pickOneThingIndex(ideas);
    if (index !== null && ideas[index]?.first_action?.trim()) return ideas[index];
  } catch {
    // fall through to the plain choice
  }
  return ideas.find((idea) => idea.first_action?.trim()) ?? null;
}

// Builds the order confirmation + delivery e-mail: a friendly opening, a way to open the book (button +
// the PDF attached), one small first step, the doors at a glance (with a small photo each), the
// wildcard, and underneath, quietly, the order data and the legal re-statements a digital sale needs.
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
}): { subject: string; html: string; text: string } {
  const { title, book, planUrl, locale, siteUrl, order } = params;
  const fullDict = getDictionary(locale);
  const dict = fullDict.email;
  const images = emailImages(siteUrl);

  const price = formatAmount(order.amountCents, order.currency, locale);
  const orderDateFormatted = new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    dateStyle: "long",
  }).format(order.orderDate);
  const termsUrl = `${siteUrl}/terms`;
  const legalInfoUrl = `${siteUrl}/herroepingsrecht`;
  const wildcardHeading = book.labels.wildcard_heading || dict.wildcardTag;
  const count = book.ideas.length + 1; // the wildcard is a door too
  const lead = dict.lead.replace("{count}", String(count));

  // The idea the buyer can start with: the one that is easiest to do, same pick as the book's own "one thing".
  const start = pickStartIdea(book.ideas);
  const startAction = start?.first_action?.trim();

  const ideasHtml = book.ideas
    .map((idea, i) => {
      const thumb = images?.thumb(ideaPhoto(idea, i)) ?? null;
      const visual = thumb
        ? `<img src="${escapeHtml(thumb)}" width="96" height="72" alt="" style="display:block;width:96px;height:72px;border:0;border-radius:12px;">`
        : `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="32" height="32" align="center" valign="middle" bgcolor="${c.orangeSoft}" style="width:32px;height:32px;border-radius:16px;background:${c.orangeSoft};font-family:${EMAIL_FONTS.serif};font-size:16px;color:${c.orangeText};font-weight:bold;">${i + 1}</td></tr></table>`;
      return `<tr>
        <td valign="top" width="${thumb ? 108 : 48}" style="padding:0 ${thumb ? 14 : 12}px 18px 0;">${visual}</td>
        <td valign="top" style="padding:0 0 18px;">
          <p style="margin:0;font-family:${EMAIL_FONTS.serif};font-size:18px;line-height:1.3;color:${c.navy};font-weight:bold;">${escapeHtml(idea.title)}</p>
          <p style="margin:4px 0 0;font-size:14px;line-height:1.55;color:${c.muted};">${escapeHtml(idea.intro)}</p>
        </td>
      </tr>`;
    })
    .join("");

  const startHtml =
    start && startAction
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;">
      <tr><td bgcolor="${c.orangeSoft}" style="background:${c.orangeSoft};border-radius:16px;padding:20px 22px;">
        ${emailEyebrow(dict.firstStepHeading, c.orangeText)}
        <p style="margin:0 0 6px;font-size:14px;line-height:1.5;color:${c.muted};">${escapeHtml(dict.firstStepLead)}</p>
        <p style="margin:0 0 6px;font-family:${EMAIL_FONTS.serif};font-size:18px;line-height:1.35;color:${c.navy};font-weight:bold;">${escapeHtml(start.title)}</p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:${c.ink};">${escapeHtml(startAction)}</p>
      </td></tr>
    </table>`
      : "";

  const wildcardThumb = images?.thumb(ideaPhoto(book.wildcard, book.ideas.length)) ?? null;
  const wildcardHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
      <tr><td bgcolor="${c.skySoft}" style="background:${c.skySoft};border-radius:16px;padding:18px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          ${wildcardThumb ? `<td valign="top" width="108" style="padding:0 14px 0 0;"><img src="${escapeHtml(wildcardThumb)}" width="96" height="72" alt="" style="display:block;width:96px;height:72px;border:0;border-radius:12px;"></td>` : ""}
          <td valign="top">
            ${emailEyebrow(wildcardHeading)}
            <p style="margin:0;font-family:${EMAIL_FONTS.serif};font-size:18px;line-height:1.3;color:${c.navy};font-weight:bold;">${escapeHtml(book.wildcard.title)}</p>
            <p style="margin:4px 0 0;font-size:14px;line-height:1.55;color:${c.ink};">${escapeHtml(book.wildcard.intro)}</p>
          </td>
        </tr></table>
      </td></tr>
    </table>`;

  const quoteHtml = book.profile_summary.trim()
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">
      <tr>
        <td width="4" bgcolor="${c.orange}" style="width:4px;background:${c.orange};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding:2px 0 2px 16px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${c.orangeText};">${escapeHtml(dict.quoteLabel)}</p>
          <p style="margin:0;font-family:${EMAIL_FONTS.serif};font-size:17px;line-height:1.55;font-style:italic;color:${c.ink};">${escapeHtml(book.profile_summary)}</p>
        </td>
      </tr>
    </table>`
    : "";

  const bodyHtml = `
    ${emailEyebrow(title, c.orangeText)}
    <h1 style="margin:0 0 14px;font-family:${EMAIL_FONTS.serif};font-size:32px;line-height:1.2;font-weight:normal;color:${c.navy};letter-spacing:-0.01em;">${escapeHtml(dict.readyHeading)}</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:${c.ink};">${escapeHtml(lead)}</p>
    ${quoteHtml}
    ${emailButton(planUrl, dict.viewOnline)}
    <p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:${c.muted};">${escapeHtml(dict.attachmentNote)}</p>

    ${startHtml}

    <hr style="border:0;border-top:1px solid ${c.border};margin:32px 0 24px;">
    ${emailEyebrow(dict.heading)}
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:${c.muted};">${escapeHtml(dict.doorsLead)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${ideasHtml}</table>
    ${wildcardHtml}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;"><tr><td>
      <a href="${escapeHtml(planUrl)}" style="font-family:${EMAIL_FONTS.sans};font-size:15px;font-weight:700;color:${c.blue};text-decoration:underline;">${escapeHtml(dict.viewOnline)} &rarr;</a>
    </td></tr></table>`;

  const orderRow = (label: string, value: string, bold = false) => `<tr>
      <td style="padding:3px 0;font-size:12px;color:${c.muted};">${escapeHtml(label)}</td>
      <td align="right" style="padding:3px 0;font-size:12px;color:${c.ink};${bold ? "font-weight:600;" : ""}">${escapeHtml(value)}</td>
    </tr>`;

  // Underneath the card, small and quiet: the order and what the law wants restated.
  const footerHtml = `
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${c.muted};">${escapeHtml(dict.orderHeading)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:320px;">
      ${orderRow(dict.orderNumberLabel, order.orderNumber, true)}
      ${orderRow(dict.priceLabel, price, true)}
      ${orderRow(dict.dateLabel, orderDateFormatted)}
    </table>
    <p style="margin:12px 0 0;">${escapeHtml(dict.digitalDeliveryNote)}</p>
    <p style="margin:6px 0 0;">${escapeHtml(dict.consentConfirmation)}</p>
    <p style="margin:6px 0 0;">
      ${escapeHtml(dict.termsVersionLabel.replace("{termsVersion}", order.termsVersion))}
      &nbsp;·&nbsp; <a href="${escapeHtml(termsUrl)}" style="color:${c.blue};">${escapeHtml(dict.termsLinkText)}</a>
      &nbsp;·&nbsp; <a href="${escapeHtml(legalInfoUrl)}" style="color:${c.blue};">${escapeHtml(dict.legalInfoLinkText)}</a>
    </p>
    <p style="margin:14px 0 0;">${escapeHtml(dict.companyInfo)}</p>`;

  // The same mail as plain text: some clients and spam filters want it, and it reads fine on its own.
  const text = [
    title.toUpperCase(),
    dict.readyHeading,
    "",
    lead,
    "",
    book.profile_summary.trim() ? `${dict.quoteLabel}: ${book.profile_summary.trim()}\n` : "",
    `${dict.viewOnline}: ${planUrl}`,
    dict.attachmentNote,
    "",
    start && startAction ? `${dict.firstStepHeading.toUpperCase()}\n${dict.firstStepLead}\n${start.title}: ${startAction}\n` : "",
    dict.heading.toUpperCase(),
    ...book.ideas.map((idea, i) => `${i + 1}. ${idea.title}: ${idea.intro}`),
    `${wildcardHeading}: ${book.wildcard.title}: ${book.wildcard.intro}`,
    "",
    `${dict.orderHeading}: ${dict.orderNumberLabel} ${order.orderNumber}, ${dict.priceLabel} ${price}, ${dict.dateLabel} ${orderDateFormatted}`,
    dict.digitalDeliveryNote,
    dict.consentConfirmation,
    `${dict.termsLinkText}: ${termsUrl}`,
    `${dict.legalInfoLinkText}: ${legalInfoUrl}`,
    dict.companyInfo,
  ]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");

  return {
    subject: `${title}: ${dict.subjectSuffix}`,
    html: emailShell({
      preheader: `${dict.readyHeading}. ${lead}`,
      bodyHtml,
      footerHtml,
      images,
      headerAlt: dict.headerAlt,
    }),
    text,
  };
}

export async function sendIdeaBookEmail(
  params: Parameters<typeof buildIdeaBookEmail>[0] & { to: string; pdfBytes: Uint8Array }
) {
  const { to, pdfBytes, ...rest } = params;
  const { subject, html, text } = buildIdeaBookEmail(rest);

  await sendEmail({
    from: process.env.EMAIL_FROM!,
    to,
    subject,
    html,
    text,
    attachments: [
      {
        filename: "idea-book.pdf",
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });
}
