import { sendEmail } from "@/lib/resend";
import { buildCodeEmail, type CodeMailParams } from "@/lib/email/codeMail";
import { getRewardCopy } from "@/lib/i18n/reward";
import { SUPPORT_EMAIL } from "@/lib/supportEmail";

// The mail a buyer gets when a friend ordered a book with a code the buyer passed on (Step 239): a thank-you and a code of their own. It never says who the friend is.
export function buildRewardEmail(params: CodeMailParams): { subject: string; html: string; text: string } {
  return buildCodeEmail(getRewardCopy(params.locale), params);
}

/** Sends it from the address of the site, with replies going to the support address. */
export async function sendRewardEmail(params: Parameters<typeof buildRewardEmail>[0] & { to: string }): Promise<{ id: string; from: string }> {
  const { to, ...rest } = params;
  const { subject, html, text } = buildRewardEmail(rest);
  return sendEmail({ from: process.env.EMAIL_FROM!, to, replyTo: SUPPORT_EMAIL, subject, html, text });
}
