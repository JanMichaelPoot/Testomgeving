// Which Stripe mode this deployment pays in. STRIPE_MODE=test|live says what is meant; the secret key says what is real. The two must
// agree: a live site with a test key (or the other way round) refuses to start a payment instead of quietly charging in the wrong
// mode. Without STRIPE_MODE the mode follows the key (sk_live_ = live, anything else = test), so older setups keep working.
//
// Server-side only (reads secrets' prefixes, never their values).

export type StripeMode = "test" | "live";

type Env = Record<string, string | undefined>;

export function keyMode(key: string | undefined): StripeMode | null {
  const k = (key ?? "").trim();
  if (/^(sk|rk)_live_/.test(k)) return "live";
  if (/^(sk|rk)_test_/.test(k)) return "test";
  return null;
}

export interface StripeModeInfo {
  mode: StripeMode;
  /** Something is wrong with the setup (mismatch, bad value, missing key); null when fine. */
  problem: string | null;
}

export function stripeModeInfo(env: Env = process.env): StripeModeInfo {
  const raw = (env.STRIPE_MODE ?? "").trim().toLowerCase();
  const declared: StripeMode | null = raw === "live" || raw === "test" ? raw : null;
  const fromKey = keyMode(env.STRIPE_SECRET_KEY);
  const mode = declared ?? fromKey ?? "test";

  let problem: string | null = null;
  if (raw && !declared) problem = `STRIPE_MODE must be "test" or "live", not "${raw}".`;
  else if (!(env.STRIPE_SECRET_KEY ?? "").trim()) problem = "STRIPE_SECRET_KEY is not set.";
  else if (declared && fromKey && declared !== fromKey) problem = `STRIPE_MODE is "${declared}" but STRIPE_SECRET_KEY is a ${fromKey} key.`;
  else if (!fromKey) problem = "STRIPE_SECRET_KEY is not a Stripe secret key (sk_test_ or sk_live_).";
  return { mode, problem };
}

export function isStripeTestMode(env: Env = process.env): boolean {
  return stripeModeInfo(env).mode === "test";
}

/** The tester notice ("pay with test card 4242 …"): only in test mode, never when real money is charged. */
export function stripeTestNotice(notice: string, env: Env = process.env): string | undefined {
  return isStripeTestMode(env) ? notice : undefined;
}
