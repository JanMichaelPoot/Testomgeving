import { sendEmail } from "@/lib/resend";
import { EMAIL_COLORS as c, EMAIL_FONTS, emailButton, emailEyebrow, emailImages, emailShell, escapeHtml } from "@/lib/email/layout";
import { getCompensationCopy, type CompensationLocale } from "@/lib/i18n/compensation";
import { formatAmount } from "@/lib/pricing";
import { SUPPORT_EMAIL } from "@/lib/supportEmail";

// The mail a buyer gets when a place in their book was wrong (Step 235): an apology and an extra one-time discount code, sent from the admin (the order page).
// Split from the sending so the exact HTML can be looked at without sending anything.
export function buildCompensationEmail(params: {
  locale: CompensationLocale;
  code: string;
  amountCents: number;
  expiresAt: Date;
  orderNumber?: string | null;
  siteUrl: string;
}): { subject: string; html: string; text: string } {
  const { locale, code, amountCents, expiresAt, orderNumber, siteUrl } = params;
  const copy = getCompensationCopy(locale);
  const amount = formatAmount(amountCents, "eur", locale);
  const until = new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { dateStyle: "long" }).format(expiresAt);
  const lead = copy.lead.replace("{amount}", amount);
  const valid = copy.valid.replace("{date}", until);
  const help = copy.help.replace("{email}", SUPPORT_EMAIL);
  const order = orderNumber ? copy.orderLine.replace("{order}", orderNumber) : "";
  const link = `${siteUrl}/intake?lang=${locale}`;

  const bodyHtml = `
    ${emailEyebrow(copy.eyebrow, c.orangeText)}
    <h1 style="margin:0 0 14px;font-family:${EMAIL_FONTS.serif};font-size:30px;line-height:1.2;font-weight:normal;color:${c.navy};letter-spacing:-0.01em;">${escapeHtml(copy.heading)}</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:${c.ink};">${escapeHtml(lead)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="${c.orangeSoft}" style="background:${c.orangeSoft};border-radius:16px;padding:20px 22px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${c.muted};">${escapeHtml(copy.codeLabel)}</p>
        <p style="margin:0 0 10px;font-family:'Courier New',Courier,monospace;font-size:26px;line-height:1.3;font-weight:bold;letter-spacing:0.08em;color:${c.navy};">${escapeHtml(code)}</p>
        <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${c.muted};">${escapeHtml(valid)}</p>
        ${emailButton(link, copy.button)}
      </td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:${c.muted};">${escapeHtml(help)}</p>`;

  const footerHtml = order ? `<p style="margin:0;">${escapeHtml(order)}</p>` : undefined;

  const text = [
    copy.eyebrow.toUpperCase(),
    copy.heading,
    "",
    lead,
    "",
    `${copy.codeLabel}: ${code}`,
    valid,
    `${copy.button}: ${link}`,
    "",
    help,
    order,
  ]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");

  return {
    subject: copy.subject,
    html: emailShell({ preheader: copy.preheader, bodyHtml, footerHtml, images: emailImages(siteUrl), headerAlt: "" }),
    text,
  };
}

/** Sends it from the address of the site, with replies going to the support address. */
export async function sendCompensationEmail(params: Parameters<typeof buildCompensationEmail>[0] & { to: string }): Promise<{ id: string; from: string }> {
  const { to, ...rest } = params;
  const { subject, html, text } = buildCompensationEmail(rest);
  return sendEmail({ from: process.env.EMAIL_FROM!, to, replyTo: SUPPORT_EMAIL, subject, html, text });
}
