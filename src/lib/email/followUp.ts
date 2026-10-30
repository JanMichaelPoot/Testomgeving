import { siteUrl as getSiteUrl } from "@/lib/siteUrl";
import { sendEmail } from "@/lib/resend";
import { EMAIL_COLORS as c, EMAIL_FONTS, emailButton, emailEyebrow, emailImages, emailShell, escapeHtml } from "@/lib/email/layout";
import { getGiftCopy } from "@/lib/i18n/gift";
import { COMPANY_LINE } from "@/lib/company";
import type { Locale } from "@/lib/locale";

// The one follow-up e-mail, about six weeks after a book (improvement brief B5): "Tijd voor een nieuw venster?". Sent only to the address of the person
// who ticked the box at checkout (window_plans.followup_email), once (followup_sent_at). The button opens a fresh intake that leaves out the ideas of
// the book they already have (src/app/nieuw-venster); the small link at the bottom takes the address out again.

export interface FollowUpEmailInput {
  locale: Locale;
  /** The link that opens a new intake (signed, see followup/token.ts). */
  openUrl: string;
  unsubscribeUrl: string;
  siteUrl?: string;
}

export function buildFollowUpEmail(input: FollowUpEmailInput): { subject: string; html: string; text: string } {
  const t = getGiftCopy(input.locale).followUp;
  const bodyHtml = `
    ${emailEyebrow("WindowInto", c.orangeText)}
    <h1 style="margin:0 0 14px;font-family:${EMAIL_FONTS.serif};font-size:28px;line-height:1.25;font-weight:400;color:${c.navy};">${escapeHtml(t.heading)}</h1>
    <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:${c.ink};">${escapeHtml(t.body)}</p>
    <p style="margin:0 0 26px;font-size:14px;line-height:1.6;color:${c.muted};">${escapeHtml(t.avoidNote)}</p>
    ${emailButton(input.openUrl, t.button)}`;
  const html = emailShell({
    preheader: t.preheader,
    bodyHtml,
    footerHtml: `${escapeHtml(t.footer)}<br><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:${c.blue};">${escapeHtml(t.unsubscribe)}</a><br>${escapeHtml(COMPANY_LINE[input.locale])}`,
    images: emailImages(input.siteUrl ?? getSiteUrl()),
    headerAlt: "",
  });
  const text = [t.heading, "", t.body, t.avoidNote, "", `${t.button}: ${input.openUrl}`, "", t.footer, `${t.unsubscribe}: ${input.unsubscribeUrl}`, COMPANY_LINE[input.locale]].join("\n");
  return { subject: t.subject, html, text };
}

export async function sendFollowUpEmail(params: FollowUpEmailInput & { to: string }): Promise<void> {
  const { to, ...input } = params;
  const mail = buildFollowUpEmail(input);
  await sendEmail({ from: process.env.EMAIL_FROM!, to, subject: mail.subject, html: mail.html, text: mail.text });
}
