// Free test orders (Jan, 16 Nov 2026): during the test phase the pay button skips Stripe altogether and starts the book at once, so testers are
// not confused by a second (sandbox) payment page. The order is still recorded like any other (terms and delivery consent, an order number,
// the delivery address), only with an amount of 0 and an id of its own instead of a Stripe Checkout Session id.
//
// Safe by construction: it is only ever on while Stripe runs in TEST mode (src/lib/stripeMode.ts), so a live site with live keys can never give
// a book away, whatever else is set. And since 23 Nov 2026 it is OFF unless FREE_TEST_ORDERS=1 says otherwise: a deployment that is still in test mode by
// mistake (the live keys not set for Production, not rebuilt) then asks for a payment at Stripe's test page, which is visible, instead of quietly giving
// every visitor a book. To give testers free books, set FREE_TEST_ORDERS=1 on the deployment that is meant for it.
//
// The id starts with "cs_test_" on purpose: the admin clean-up and every other place that tells test orders from real ones looks at that
// prefix, so a free order counts as a test order everywhere without any special case.

import { randomUUID } from "node:crypto";
import { keyMode, stripeModeInfo } from "@/lib/stripeMode";

type Env = Record<string, string | undefined>;

export const FREE_ORDER_PREFIX = "cs_test_free_";

/** Whether the pay button starts the book without Stripe: test mode only, and only when FREE_TEST_ORDERS=1 (or true, on, yes) says so. */
export function freeTestOrdersEnabled(env: Env = process.env): boolean {
  // A live secret key always wins over a (mis)typed STRIPE_MODE: with a live key nothing is ever free.
  if (keyMode(env.STRIPE_SECRET_KEY) === "live") return false;
  if (stripeModeInfo(env).mode !== "test") return false;
  const on = (env.FREE_TEST_ORDERS ?? "").trim().toLowerCase().replace(/^"|"$/g, "");
  return on === "1" || on === "true" || on === "on" || on === "yes";
}

export function isFreeOrderId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(FREE_ORDER_PREFIX) && id.length > FREE_ORDER_PREFIX.length + 8;
}

/** A new, unguessable id for a free order (it is also the key of the link to the book, like a Stripe session id is). */
export function newFreeOrderId(): string {
  return `${FREE_ORDER_PREFIX}${randomUUID().replace(/-/g, "")}`;
}
