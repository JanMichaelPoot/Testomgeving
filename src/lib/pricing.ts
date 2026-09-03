// Single price point for the MVP — adjust anywhere in the €2-5 range from
// the product brief. Kept in cents since that's what Stripe expects.
export const WINDOW_PLAN_PRICE = {
  currency: "eur",
  amountCents: 350,
} as const;
