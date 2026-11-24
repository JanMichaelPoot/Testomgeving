import { sendEmail } from "@/lib/resend";
import { buildCodeEmail, type CodeMailParams } from "@/lib/email/codeMail";
import { getCompensationCopy } from "@/lib/i18n/compensation";
import { SUPPORT_EMAIL } from "@/lib/supportEmail";

// The mail a buyer gets when a place in their book was wrong (Step 235): an apology and an extra one-time discount code, sent from the admin (the order page).
// Split from the sending so the exact HTML can be looked at without sending anything. The layout is shared with the reward mail (src/lib/email/codeMail.ts).
export function buildCompensationEmail(params: CodeMailParams): { subject: string; html: string; text: string } {
  return buildCodeEmail(getCompensationCopy(params.locale), params);
}

/** Sends it from the address of the site, with replies going to the support address. */
export async function sendCompensationEmail(params: Parameters<typeof buildCompensationEmail>[0] & { to: string }): Promise<{ id: string; from: string }> {
  const { to, ...rest } = params;
  const { subject, html, text } = buildCompensationEmail(rest);
  return sendEmail({ from: process.env.EMAIL_FROM!, to, replyTo: SUPPORT_EMAIL, subject, html, text });
}
