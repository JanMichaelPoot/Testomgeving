import { siteUrl as getSiteUrl } from "@/lib/siteUrl";
import { sendEmail } from "@/lib/resend";
import { EMAIL_COLORS as c, EMAIL_FONTS, emailButton, emailEyebrow, emailImages, emailShell, escapeHtml } from "@/lib/email/layout";
import { fill, getGiftCopy } from "@/lib/i18n/gift";
import { formatAmount } from "@/lib/pricing";
import type { Locale } from "@/lib/locale";
import { COMPANY_LINE } from "@/lib/company";
import { formatCardDate } from "@/lib/pdf/giftCard";

// The mail the giver gets right after paying for a gift voucher: the code, the card to print (PDF attached) and the link to share.
// Built apart from sending so the content is tested without Resend. The footer carries the legal line of the order: the right of
// withdrawal that a voucher still has until it is redeemed.

export interface VoucherEmailInput {
  locale: Locale;
  code: string;
  recipientName: string | null;
  expiresAt: Date;
  /** The link the recipient opens, e.g. https://www.windowinto.nl/cadeau/WIN-...; */
  redeemUrl: string;
  /** Link to the page where the giver can download the card again. */
  readyUrl: string;
  order: { orderNumber: string; amountCents: number; currency: string; orderDate: Date };
  siteUrl?: string;
}

export function buildVoucherEmail(input: VoucherEmailInput): { subject: string; html: string; text: string } {
  const { locale } = input;
  const t = getGiftCopy(locale);
  const date = formatCardDate(input.expiresAt, locale);
  const recipient = input.recipientName?.trim() || "";
  const subject = recipient ? fill(t.email.subject, { name: recipient }) : t.email.subjectAnon;
  const intro = recipient ? fill(t.email.intro, { recipient }) : t.email.introAnon;
  const price = formatAmount(input.order.amountCents, input.order.currency, locale);
  const orderDate = new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(input.order.orderDate);
  const orderLine = `${input.order.orderNumber} · ${price} · ${orderDate}`;

  const bodyHtml = `
    ${emailEyebrow(t.buy.kicker, c.orangeText)}
    <h1 style="margin:0 0 14px;font-family:${EMAIL_FONTS.serif};font-size:28px;line-height:1.25;font-weight:400;color:${c.navy};">${escapeHtml(t.email.heading)}</h1>
    <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:${c.ink};">${escapeHtml(intro)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td bgcolor="${c.orangeSoft}" style="background:${c.orangeSoft};border-radius:14px;padding:20px 22px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${c.orangeText};">${escapeHtml(t.email.codeLabel)}</p>
        <p style="margin:0 0 8px;font-family:'Courier New',Courier,monospace;font-size:26px;font-weight:700;letter-spacing:0.06em;color:${c.navy};">${escapeHtml(input.code)}</p>
        <p style="margin:0;font-size:13px;color:${c.muted};">${escapeHtml(fill(t.email.validUntil, { date }))}</p>
      </td>
    </tr></table>
    <p style="margin:22px 0 22px;font-size:14px;line-height:1.6;color:${c.muted};">${escapeHtml(t.email.attachNote)}</p>
    ${emailButton(input.redeemUrl, t.email.linkButton)}
    <h2 style="margin:34px 0 8px;font-family:${EMAIL_FONTS.serif};font-size:19px;font-weight:400;color:${c.navy};">${escapeHtml(t.email.shareHeading)}</h2>
    <p style="margin:0 0 6px;font-size:14px;line-height:1.65;color:${c.ink};">${escapeHtml(t.email.shareBody)}</p>
    <h2 style="margin:28px 0 6px;font-family:${EMAIL_FONTS.serif};font-size:19px;font-weight:400;color:${c.navy};">${escapeHtml(t.email.orderHeading)}</h2>
    <p style="margin:0;font-size:13px;color:${c.muted};">${escapeHtml(orderLine)}</p>`;

  const html = emailShell({
    preheader: t.email.preheader,
    bodyHtml,
    footerHtml: `${escapeHtml(t.email.footer)}<br>${escapeHtml(COMPANY_LINE[locale])}`,
    images: emailImages(input.siteUrl ?? getSiteUrl()),
    headerAlt: "",
  });

  const text = [
    t.email.heading,
    "",
    intro,
    "",
    `${t.email.codeLabel}: ${input.code}`,
    fill(t.email.validUntil, { date }),
    "",
    t.email.attachNote,
    `${t.email.linkButton}: ${input.redeemUrl}`,
    "",
    t.email.shareHeading,
    t.email.shareBody,
    "",
    `${t.email.orderHeading}: ${orderLine}`,
    "",
    t.email.footer,
    COMPANY_LINE[locale],
  ].join("\n");

  return { subject, html, text };
}

/** Sends the mail with the card attached. Throws when Resend refuses it (see sendEmail), so the caller can leave email_sent_at empty. */
export async function sendVoucherEmail(params: VoucherEmailInput & { to: string; cardPdf: Uint8Array }): Promise<void> {
  const { to, cardPdf, ...input } = params;
  const mail = buildVoucherEmail(input);
  await sendEmail({
    from: process.env.EMAIL_FROM!,
    to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments: [{ filename: input.locale === "nl" ? "WindowInto-cadeaubon.pdf" : "WindowInto-gift-voucher.pdf", content: Buffer.from(cardPdf) }],
  });
}
