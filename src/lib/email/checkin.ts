import { siteUrl as getSiteUrl } from "@/lib/siteUrl";
import { sendEmail } from "@/lib/resend";
import { EMAIL_COLORS as c, EMAIL_FONTS, emailEyebrow, emailImages, emailShell, escapeHtml } from "@/lib/email/layout";
import { getCheckinCopy } from "@/lib/i18n/checkin";
import { COMPANY_LINE } from "@/lib/company";
import type { CheckinAnswer } from "@/lib/checkin";

// The check-in a week after a book (Step 243): "did you do anything with it?" and three buttons, one per answer. Sent once per book by the daily job
// (src/lib/checkin/run.ts). It is not a sales mail: no code, no offer, no new book. The buttons open /terugkoppeling with the answer, where the buyer
// can add a sentence; the small link at the bottom is the opt-out.

export interface CheckinEmailInput {
  locale: "nl" | "en";
  /** The title of the idea the buyer chose ("Dit ga ik doen"); without one the mail asks in general. */
  ideaTitle?: string | null;
  /** The address of each button, signed (followup/token.ts), by answer. */
  answerUrls: Record<CheckinAnswer, string>;
  optoutUrl: string;
  siteUrl?: string;
}

// Three buttons that look like three equal choices: the same outline, none of them the orange "buy" button, so nothing nudges one answer.
function answerButton(href: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;"><tr>
    <td align="center" bgcolor="${c.card}" style="background:${c.card};border:2px solid ${c.navy};border-radius:14px;">
      <a href="${escapeHtml(href)}" style="display:block;padding:14px 18px;font-family:${EMAIL_FONTS.sans};font-size:16px;font-weight:700;color:${c.navy};text-decoration:none;">${escapeHtml(label)}</a>
    </td>
  </tr></table>`;
}

export function buildCheckinEmail(input: CheckinEmailInput): { subject: string; html: string; text: string } {
  const t = getCheckinCopy(input.locale).mail;
  const title = (input.ideaTitle ?? "").trim();
  const lead = title ? t.leadChosen.replace("{title}", title) : t.lead;
  const bodyHtml = `
    ${emailEyebrow(t.eyebrow, c.orangeText)}
    <h1 style="margin:0 0 14px;font-family:${EMAIL_FONTS.serif};font-size:28px;line-height:1.25;font-weight:400;color:${c.navy};">${escapeHtml(t.heading)}</h1>
    <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:${c.ink};">${escapeHtml(lead)}</p>
    <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:${c.muted};">${escapeHtml(t.note)}</p>
    ${answerButton(input.answerUrls.done, t.done)}
    ${answerButton(input.answerUrls.planned, t.planned)}
    ${answerButton(input.answerUrls.not, t.not)}`;
  const html = emailShell({
    preheader: t.preheader,
    bodyHtml,
    footerHtml: `${escapeHtml(t.footer)}<br><a href="${escapeHtml(input.optoutUrl)}" style="color:${c.blue};">${escapeHtml(t.optout)}</a><br>${escapeHtml(COMPANY_LINE[input.locale])}`,
    images: emailImages(input.siteUrl ?? getSiteUrl()),
    headerAlt: "",
  });
  const text = [
    t.heading,
    "",
    lead,
    t.note,
    "",
    `${t.done}: ${input.answerUrls.done}`,
    `${t.planned}: ${input.answerUrls.planned}`,
    `${t.not}: ${input.answerUrls.not}`,
    "",
    t.footer,
    `${t.optout}: ${input.optoutUrl}`,
    COMPANY_LINE[input.locale],
  ].join("\n");
  return { subject: t.subject, html, text };
}

export async function sendCheckinEmail(params: CheckinEmailInput & { to: string }): Promise<void> {
  const { to, ...input } = params;
  const mail = buildCheckinEmail(input);
  await sendEmail({ from: process.env.EMAIL_FROM!, to, subject: mail.subject, html: mail.html, text: mail.text });
}
