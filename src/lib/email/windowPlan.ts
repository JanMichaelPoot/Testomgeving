import { getResend, EMAIL_FROM } from "@/lib/resend";
import type { GeneratedIdeaBook } from "@/lib/claude/generateIdeaBook";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/language";

export async function sendIdeaBookEmail(params: {
  to: string;
  title: string;
  book: GeneratedIdeaBook;
  pdfBytes: Uint8Array;
  planUrl: string;
  locale: Locale;
}) {
  const { to, title, book, pdfBytes, planUrl, locale } = params;
  const dict = getDictionary(locale).email;

  const ideasHtml = book.ideas
    .map(
      (idea) => `<li style="margin-bottom:12px;">
        <strong>${idea.title}</strong><br />
        <span style="color:#55555f;">${idea.intro}</span>
      </li>`
    )
    .join("");

  await getResend().emails.send({
    from: EMAIL_FROM,
    to,
    subject: `${title}: ${dict.subjectSuffix}`,
    html: `
      <div style="font-family: sans-serif; color: #1A1A2E; max-width: 560px; margin: 0 auto;">
        <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; color: #4B2AA6; font-weight: 600;">${title}</p>
        <p style="color: #55555f;">${book.profile_summary}</p>
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #4B2AA6; margin-top: 24px;">${dict.heading}</h2>
        <ol style="padding-left: 20px;">${ideasHtml}</ol>
        <div style="background: #F5F3EE; border: 1px solid #4B2AA6; border-radius: 12px; padding: 16px; margin-top: 16px;">
          <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #4B2AA6; font-weight: 600; margin: 0 0 4px;">${book.labels.wildcard_heading}</p>
          <p style="margin: 0;"><strong>${book.wildcard.title}</strong> — ${book.wildcard.intro}</p>
        </div>
        <p style="margin-top: 24px;">
          <a href="${planUrl}" style="color: #4B2AA6;">${dict.viewOnline}</a>
        </p>
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
