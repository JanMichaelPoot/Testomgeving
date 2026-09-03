import { Resend } from "resend";

// Lazily constructed for the same reason as the Stripe client
// (src/lib/stripe.ts): validating the API key eagerly would throw while
// Next.js statically collects route data at build time.
let client: Resend | null = null;

export function getResend(): Resend {
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY!);
  }
  return client;
}

export const EMAIL_FROM = process.env.EMAIL_FROM!;
