// A mail that cannot be sent leaves the raw provider message in window_plans.progress_meta.email_error. This turns the
// messages we have actually seen into a cause and a fix in plain Dutch for the admin, so "mails komen niet aan" does not
// need a search through the logs. Pure; unknown messages return null and are shown as they are.

export interface EmailErrorHelp {
  /** What is wrong, in one sentence. */
  cause: string;
  /** What to do about it. */
  fix: string;
}

export function explainEmailError(message: string | null | undefined): EmailErrorHelp | null {
  const m = message ?? "";
  if (/only send testing emails to your own email address|domain is not verified|not\s+registered|is not allowed/i.test(m)) {
    return {
      cause: "Resend verstuurt alleen naar het adres van het eigen Resend-account zolang het afzenderdomein niet is geverifieerd, dus niet naar de koper of ontvanger.",
      fix: "Verifieer het domein van EMAIL_FROM op resend.com/domains (DNS-records bij je domeinhost), zet EMAIL_FROM daarna op een adres van dat domein in Vercel en deploy opnieuw.",
    };
  }
  if (/missing api key|api key is invalid|restricted_api_key|invalid_api_key/i.test(m)) {
    return {
      cause: "De Resend-sleutel ontbreekt of is ongeldig in deze omgeving.",
      fix: "Zet RESEND_API_KEY (een sleutel met verzendrechten) in Vercel voor de juiste omgeving en deploy opnieuw.",
    };
  }
  if (/attachment|payload too large|too large|exceeds/i.test(m)) {
    return {
      cause: "De PDF-bijlage is te groot voor de mail.",
      fix: "Controleer de grootte van de PDF (hoort rond 1-3 MB te zijn) of stuur een downloadlink in plaats van een bijlage.",
    };
  }
  if (/invalid.*(to|email)|validation_error.*(to|email)/i.test(m)) {
    return {
      cause: "Het ingevulde e-mailadres is ongeldig.",
      fix: "Vraag de koper om het adres te controleren.",
    };
  }
  return null;
}
