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
export async function sendEmail(payload: CreateEmailOptions): Promise<{ id: string }> {
  const { data, error } = await getResend().emails.send(payload);
  if (error || !data) {
    throw new Error(`Resend rejected the e-mail: ${error?.name ?? "unknown"} — ${error?.message ?? "no response data"}`);
  }
  return { id: data.id };
}
