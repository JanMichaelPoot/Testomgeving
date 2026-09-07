import { getResend, EMAIL_FROM } from "@/lib/resend";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/locale";

// The Fase 3 "did you take your first step yet?" nudge — sent once, a few
// days after generation, by the cron job in
// src/app/api/cron/first-action-reminder/route.ts. Deliberately references
// just one idea (the first one) rather than the whole book, so the email
// stays a quick, specific nudge instead of repeating the PDF.
export async function sendFirstActionReminderEmail(params: {
  to: string;
  ideaTitle: string;
  firstAction: string;
  planUrl: string;
  locale: Locale;
}) {
  const { to, ideaTitle, firstAction, planUrl, locale } = params;
  const dict = getDictionary(locale).email.reminder;

  const intro = dict.intro
    .replace("{title}", `<strong>${ideaTitle}</strong>`)
    .replace("{action}", firstAction);

  await getResend().emails.send({
    from: EMAIL_FROM,
    to,
    subject: dict.subject,
    html: `
      <div style="font-family: sans-serif; color: #1A1A2E; max-width: 560px; margin: 0 auto;">
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #4B2AA6; margin-top: 0;">${dict.heading}</h2>
        <p style="color: #55555f;">${intro}</p>
        <p style="margin-top: 24px;">
          <a href="${planUrl}" style="color: #4B2AA6;">${dict.ctaLabel}</a>
        </p>
      </div>
    `,
  });
}
