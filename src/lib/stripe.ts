import Stripe from "stripe";
import { stripeModeInfo } from "@/lib/stripeMode";

// Lazily constructed: Stripe's SDK validates the API key eagerly at
// construction time, which would otherwise throw while Next.js statically
// collects route data at build time (before runtime env vars are needed).
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    // A test key on a live site (or the reverse) must never reach a payment: fail loudly instead.
    const { problem } = stripeModeInfo();
    if (problem) throw new Error(`Stripe is not set up correctly: ${problem}`);
    // .trim() guards against a stray trailing newline/whitespace from
    // pasting the key into a dashboard env var field.
    client = new Stripe((process.env.STRIPE_SECRET_KEY ?? "").trim(), {
      apiVersion: "2026-08-26.dahlia",
    });
  }
  return client;
}
