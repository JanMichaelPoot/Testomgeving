import Stripe from "stripe";

// Lazily constructed: Stripe's SDK validates the API key eagerly at
// construction time, which would otherwise throw while Next.js statically
// collects route data at build time (before runtime env vars are needed).
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-08-26.dahlia",
    });
  }
  return client;
}
