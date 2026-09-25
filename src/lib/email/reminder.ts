import { sendEmail } from "@/lib/resend";
import { EMAIL_COLORS as c, EMAIL_FONTS, emailButton, emailShell, escapeHtml } from "@/lib/email/layout";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/locale";

// The Fase 3 "did you take your first step yet?" nudge — sent once, a few
// days after generation, by the cron job in
// src/app/api/cron/first-action-reminder/route.ts. Deliberately references
// just one idea (the one the buyer chose, else the first) rather than the
// whole book, so the email stays a quick, specific nudge instead of
// repeating the PDF.
export async function sendFirstActionReminderEmail(params: {
  to: string;
  ideaTitle: string;
  firstAction: string;
  planUrl: string;
  locale: Locale;
}) {
  const { to, ideaTitle, firstAction, planUrl, locale } = params;
  const dict = getDictionary(locale).email.reminder;

  // Escape first, then substitute — the placeholders themselves are ours.
  const intro = escapeHtml(dict.intro)
    .replace("{title}", `<strong>${escapeHtml(ideaTitle)}</strong>`)
    .replace("{action}", escapeHtml(firstAction));

  const bodyHtml = `
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${c.accent};">${escapeHtml(dict.heading)}</p>
    <p style="margin:0 0 24px;font-family:${EMAIL_FONTS.serif};font-size:20px;line-height:1.5;color:${c.ink};">${intro}</p>
    ${emailButton(planUrl, dict.ctaLabel)}`;

  await sendEmail({
    from: process.env.EMAIL_FROM!,
    to,
    subject: dict.subject,
    html: emailShell({ preheader: dict.subject, bodyHtml }),
  });
}
