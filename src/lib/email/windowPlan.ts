import { getResend, EMAIL_FROM } from "@/lib/resend";
import type { GeneratedIdeaBook } from "@/lib/claude/generateIdeaBook";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/language";
import { formatAmount } from "@/lib/pricing";

export async function sendIdeaBookEmail(params: {
  to: string;
  title: string;
  book: GeneratedIdeaBook;
  pdfBytes: Uint8Array;
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
}) {
  const { to, title, book, pdfBytes, planUrl, locale, siteUrl, order } = params;
  const dict = getDictionary(locale).email;

  const ideasHtml = book.ideas
    .map(
      (idea) => `<li style="margin-bottom:12px;">
        <strong>${idea.title}</strong><br />
        <span style="color:#55555f;">${idea.intro}</span>
      </li>`
    )
    .join("");

  const price = formatAmount(order.amountCents, order.currency, locale);
  const orderDateFormatted = new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    dateStyle: "long",
  }).format(order.orderDate);
  const termsUrl = `${siteUrl}/terms`;
  const legalInfoUrl = `${siteUrl}/herroepingsrecht`;

  await getResend().emails.send({
    from: EMAIL_FROM,
    to,
    subject: `${title}: ${dict.subjectSuffix}`,
    html: `
      <div style="font-family: sans-serif; color: #1A1A2E; max-width: 560px; margin: 0 auto;">
        <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; color: #4B2AA6; font-weight: 600;">${title}</p>
        <p style="color: #55555f;">${book.profile_summary}</p>

        <table style="width:100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; color: #55555f;">
          <tr>
            <td style="padding: 3px 0;">${dict.orderNumberLabel}</td>
            <td style="padding: 3px 0; text-align: right; font-weight: 600; color: #1A1A2E;">${order.orderNumber}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0;">${dict.priceLabel}</td>
            <td style="padding: 3px 0; text-align: right; font-weight: 600; color: #1A1A2E;">${price}</td>
          </tr>
          <tr>
            <td style="padding: 3px 0;">${dict.dateLabel}</td>
            <td style="padding: 3px 0; text-align: right;">${orderDateFormatted}</td>
          </tr>
        </table>

        <p style="font-size: 12px; line-height: 1.5; color: #55555f;">${dict.digitalDeliveryNote}</p>
        <p style="font-size: 12px; line-height: 1.5; color: #55555f;">${dict.consentConfirmation}</p>
        <p style="font-size: 12px; line-height: 1.5; color: #55555f;">
          ${dict.termsVersionLabel.replace("{termsVersion}", order.termsVersion)}
          &nbsp;·&nbsp;
          <a href="${termsUrl}" style="color: #4B2AA6;">${dict.termsLinkText}</a>
          &nbsp;·&nbsp;
          <a href="${legalInfoUrl}" style="color: #4B2AA6;">${dict.legalInfoLinkText}</a>
        </p>

        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #4B2AA6; margin-top: 24px;">${dict.heading}</h2>
        <ol style="padding-left: 20px;">${ideasHtml}</ol>
        <div style="background: #F5F3EE; border: 1px solid #4B2AA6; border-radius: 12px; padding: 16px; margin-top: 16px;">
          <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #4B2AA6; font-weight: 600; margin: 0 0 4px;">${book.labels.wildcard_heading}</p>
          <p style="margin: 0;"><strong>${book.wildcard.title}</strong> — ${book.wildcard.intro}</p>
        </div>
        <p style="margin-top: 24px;">
          <a href="${planUrl}" style="color: #4B2AA6;">${dict.viewOnline}</a>
        </p>

        <p style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #eee; font-size: 11px; line-height: 1.5; color: #9a9aa5;">${dict.companyInfo}</p>
      </div>
    `,
    attachments: [
      {
        filename: "idea-book.pdf",
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });
}
