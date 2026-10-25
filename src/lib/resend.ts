import { Resend, type CreateEmailOptions } from "resend";

// Lazily constructed for the same reason as the Stripe client
// (src/lib/stripe.ts): validating the API key eagerly would throw while
// Next.js statically collects route data at build time.
let client: Resend | null = null;

export function getResend(): Resend {
  if (!client) {
    // .trim() guards against a stray trailing newline/whitespace from
    // pasting the key into a dashboard env var field.
    client = new Resend((process.env.RESEND_API_KEY ?? "").trim());
  }
  return client;
}

export const EMAIL_FROM = process.env.EMAIL_FROM!;

// resend.emails.send() does NOT throw when the API rejects a message (unverified
// sender domain, invalid key, blocked recipient ...): it resolves with
// `{ data: null, error }`. Callers that only `await` it — and then record the
// mail as delivered — would silently lose the message. This wrapper turns an
// API error into a real exception so the existing try/catch handling (log +
// leave `email_sent_at` empty) actually runs.
//
// One more thing it handles: while the sending domain (windowinto.nl) is not verified in Resend, every mail from
// it is refused ("domain is not verified"). Resend's shared test sender (onboarding@resend.dev) works without
// a domain, but only to the e-mail address of the Resend account itself. So on exactly that refusal the mail is
// tried once more from the test sender: in a test setup it then arrives at the owner's address, and for anyone
// else Resend refuses it again and the error below is raised as before (nothing is lost or sent wrongly).
export const TEST_SENDER = "WINDOW <onboarding@resend.dev>";

export function isUnverifiedDomainError(error: { name?: string; message?: string } | null | undefined): boolean {
  return !!error && /domain/i.test(error.message ?? "") && /(not verified|not\s+registered|is not allowed)/i.test(error.message ?? "");
}

export async function sendEmail(payload: CreateEmailOptions): Promise<{ id: string }> {
  let { data, error } = await getResend().emails.send(payload);
  if ((error || !data) && isUnverifiedDomainError(error) && payload.from !== TEST_SENDER) {
    console.warn(`WINDOW: Resend refused the sender (${error?.message}); trying once from the test sender`);
    ({ data, error } = await getResend().emails.send({ ...payload, from: TEST_SENDER }));
  }
  if (error || !data) {
    throw new Error(`Resend rejected the e-mail: ${error?.name ?? "unknown"} — ${error?.message ?? "no response data"}`);
  }
  return { id: data.id };
}
