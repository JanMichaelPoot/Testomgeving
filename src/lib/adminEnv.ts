// What the running deployment can actually see of its settings, for the admin overview. Only whether a
// variable is present (and, for harmless ones, what it says): never a secret value, not even a part of one
// beyond its public prefix (re_, sk_test_, ...). A setting that is added in the host's dashboard but is not
// in the environment this deployment runs in (wrong environment ticked, not redeployed) shows up here as missing.

export interface EnvCheck {
  name: string;
  ok: boolean;
  /** What to tell the owner. For non-secret settings this is the value. */
  detail: string;
  /** A problem that breaks something now, as opposed to a setting that is merely optional. */
  required: boolean;
}

type Env = Record<string, string | undefined>;

const has = (v: string | undefined) => !!v && v.trim().length > 0;
const prefix = (v: string | undefined, known: string[]) => known.find((p) => (v ?? "").trim().startsWith(p)) ?? null;

export function envChecks(env: Env): EnvCheck[] {
  const checks: EnvCheck[] = [];
  const add = (name: string, ok: boolean, detail: string, required = true) => checks.push({ name, ok, detail, required });

  const where = env.VERCEL_ENV ? `Vercel-omgeving: ${env.VERCEL_ENV}` : "niet op Vercel (lokaal)";
  add("Omgeving", true, where, false);

  const resend = env.RESEND_API_KEY?.trim();
  add("RESEND_API_KEY", has(resend) && !!prefix(resend, ["re_"]), has(resend) ? (prefix(resend, ["re_"]) ? "aanwezig (begint met re_)" : "aanwezig maar begint niet met re_: klopt de waarde?") : "ontbreekt: er kan geen e-mail worden verstuurd");
  const from = env.EMAIL_FROM?.trim();
  add("EMAIL_FROM", has(from), has(from) ? from! : "ontbreekt: de afzender van de mail is onbekend");
  if (has(from) && /windowinto\.nl/i.test(from!)) add("Afzenderdomein", true, "windowinto.nl: moet in Resend geverifieerd zijn (anders probeert de app het opnieuw vanaf onboarding@resend.dev)", false);

  const site = env.NEXT_PUBLIC_SITE_URL?.trim();
  add("NEXT_PUBLIC_SITE_URL", has(site) && !/localhost/i.test(site ?? ""), has(site) ? (/localhost/i.test(site!) ? `${site}: dit is localhost, de knoppen in de mail wijzen dan naar een adres dat niemand kan openen` : site!) : "ontbreekt: links in de mail en bij het delen kloppen niet");

  add("ANTHROPIC_API_KEY", has(env.ANTHROPIC_API_KEY), has(env.ANTHROPIC_API_KEY) ? "aanwezig" : "ontbreekt: boeken kunnen niet worden gemaakt");
  const stripe = env.STRIPE_SECRET_KEY?.trim();
  add("STRIPE_SECRET_KEY", has(stripe), has(stripe) ? (prefix(stripe, ["sk_test_"]) ? "aanwezig (testmodus)" : prefix(stripe, ["sk_live_"]) ? "aanwezig (LIVE-modus)" : "aanwezig") : "ontbreekt: betalen werkt niet");
  add("STRIPE_WEBHOOK_SECRET", has(env.STRIPE_WEBHOOK_SECRET), has(env.STRIPE_WEBHOOK_SECRET) ? "aanwezig" : "ontbreekt: betalingen blijven op 'pending' staan", false);
  add("SUPABASE_SERVICE_ROLE_KEY", has(env.SUPABASE_SERVICE_ROLE_KEY), has(env.SUPABASE_SERVICE_ROLE_KEY) ? "aanwezig" : "ontbreekt: niets kan worden opgeslagen");
  add("GEMINI_API_KEY", has(env.GEMINI_API_KEY), has(env.GEMINI_API_KEY) ? "aanwezig" : "niet nodig voor de site (alleen om beelden te maken)", false);
  add("NEXT_PUBLIC_POSTHOG_KEY", has(env.NEXT_PUBLIC_POSTHOG_KEY), has(env.NEXT_PUBLIC_POSTHOG_KEY) ? "aanwezig" : "ontbreekt: geen gedragsmeting", false);
  add("CRON_SECRET", has(env.CRON_SECRET), has(env.CRON_SECRET) ? "aanwezig" : "ontbreekt: de herinneringsmail-route is open voor iedereen", false);
  add("NEXT_PUBLIC_TEST_FEEDBACK", true, has(env.NEXT_PUBLIC_TEST_FEEDBACK) ? `ingesteld op "${env.NEXT_PUBLIC_TEST_FEEDBACK}" (vragenlijst onder het boek)` : "niet ingesteld (geen vragenlijst)", false);
  const limit = Number((env.TEST_MAX_BOOKS_PER_IP ?? "").trim());
  add("TEST_MAX_BOOKS_PER_IP", true, Number.isInteger(limit) && limit > 0 ? `${limit} boek(en) per internetverbinding (testlimiet aan; jij bent als ingelogde admin onbeperkt)` : "niet ingesteld: geen limiet", false);
  add("NEXT_PUBLIC_WINDOW_PRICE_CENTS", true, has(env.NEXT_PUBLIC_WINDOW_PRICE_CENTS) ? `${env.NEXT_PUBLIC_WINDOW_PRICE_CENTS} cent` : "standaard (350 cent)", false);
  return checks;
}
