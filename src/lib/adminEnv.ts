// What the running deployment can actually see of its settings, for the admin overview. Only whether a
// variable is present (and, for harmless ones, what it says): never a secret value, not even a part of one
// beyond its public prefix (re_, sk_test_, ...). A setting that is added in the host's dashboard but is not
// in the environment this deployment runs in (wrong environment ticked, not redeployed) shows up here as missing.

import { stripeModeInfo } from "@/lib/stripeMode";
import { parsePriceTest, variantIds } from "@/lib/priceTest";
import { seasonalEditionEnabled } from "@/lib/seasonEdition";
import { isVercelHost, siteUrl } from "@/lib/siteUrl";
import { knowledgeAnchorEnabled, knowledgeRankingV2Enabled, knowledgeWritingV2Enabled } from "@/lib/knowledgeFlags";

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
  const effective = siteUrl(env);
  const siteIgnored = env.VERCEL_ENV === "production" && has(site) && isVercelHost(site!);
  add(
    "NEXT_PUBLIC_SITE_URL",
    has(site) && !/localhost/i.test(site ?? "") && !siteIgnored,
    siteIgnored
      ? `${site} wordt genegeerd op production (een vercel.app-adres hoort daar niet); de site gebruikt ${effective}. Zet hier het echte adres.`
      : has(site)
        ? /localhost/i.test(site!)
          ? `${site}: dit is localhost, de knoppen in de mail wijzen dan naar een adres dat niemand kan openen`
          : `${site!} (de site gebruikt: ${effective})`
        : env.VERCEL_ENV === "production"
          ? `niet ingesteld: de site gebruikt ${effective}`
          : "ontbreekt: links in de mail en bij het delen kloppen niet",
  );

  add("ANTHROPIC_API_KEY", has(env.ANTHROPIC_API_KEY), has(env.ANTHROPIC_API_KEY) ? "aanwezig" : "ontbreekt: boeken kunnen niet worden gemaakt");
  const stripe = env.STRIPE_SECRET_KEY?.trim();
  const stripeInfo = stripeModeInfo(env);
  add("STRIPE_MODE", !stripeInfo.problem, stripeInfo.problem ? `PROBLEEM: ${stripeInfo.problem} Betalen is geblokkeerd.` : `${stripeInfo.mode === "live" ? "LIVE" : "test"}${(env.STRIPE_MODE ?? "").trim() ? "" : " (volgt de sleutel; zet STRIPE_MODE=test of live)"}`);
  add("STRIPE_SECRET_KEY", has(stripe), has(stripe) ? (prefix(stripe, ["sk_test_"]) ? "aanwezig (testmodus)" : prefix(stripe, ["sk_live_"]) ? "aanwezig (LIVE-modus)" : "aanwezig") : "ontbreekt: betalen werkt niet");
  add("STRIPE_WEBHOOK_SECRET", has(env.STRIPE_WEBHOOK_SECRET), has(env.STRIPE_WEBHOOK_SECRET) ? "aanwezig" : "ontbreekt: betalingen blijven op 'pending' staan", false);
  // The app accepts Supabase's newer name for the same key too (src/lib/supabase/env.ts).
  const supabaseKey = has(env.SUPABASE_SERVICE_ROLE_KEY) ? "SUPABASE_SERVICE_ROLE_KEY" : has(env.SUPABASE_SECRET_KEY) ? "SUPABASE_SECRET_KEY" : null;
  add("Supabase-servicesleutel", supabaseKey !== null, supabaseKey ? `aanwezig (onder de naam ${supabaseKey})` : "ontbreekt (SUPABASE_SERVICE_ROLE_KEY of SUPABASE_SECRET_KEY): niets kan worden opgeslagen");
  add("IP_HASH_SECRET", has(env.IP_HASH_SECRET), has(env.IP_HASH_SECRET) ? "aanwezig" : "niet ingesteld: de IP-hash leunt dan op de Supabase-sleutel; zet een eigen lange willekeurige waarde", false);
  add("GEMINI_API_KEY", has(env.GEMINI_API_KEY), has(env.GEMINI_API_KEY) ? "aanwezig" : "niet nodig voor de site (alleen om beelden te maken)", false);
  add("NEXT_PUBLIC_POSTHOG_KEY", has(env.NEXT_PUBLIC_POSTHOG_KEY), has(env.NEXT_PUBLIC_POSTHOG_KEY) ? "aanwezig" : "ontbreekt: geen gedragsmeting", false);
  add("CRON_SECRET", has(env.CRON_SECRET), has(env.CRON_SECRET) ? "aanwezig" : "ontbreekt: de herinneringsmail-route is open voor iedereen", false);
  add("NEXT_PUBLIC_TEST_FEEDBACK", true, has(env.NEXT_PUBLIC_TEST_FEEDBACK) ? `ingesteld op "${env.NEXT_PUBLIC_TEST_FEEDBACK}" (vragenlijst onder het boek)` : "niet ingesteld (geen vragenlijst)", false);
  const limit = Number((env.TEST_MAX_BOOKS_PER_IP ?? "").trim());
  add("TEST_MAX_BOOKS_PER_IP", true, Number.isInteger(limit) && limit > 0 ? `${limit} boek(en) per internetverbinding (testlimiet aan; jij bent als ingelogde admin onbeperkt)` : "niet ingesteld: geen limiet", false);
  const exempt = (env.TEST_QUOTA_EXEMPT_IPS ?? "").split(/[,;\s]+/).filter(Boolean).length;
  add("TEST_QUOTA_EXEMPT_IPS", true, exempt ? `${exempt} adres(sen) zonder testlimiet` : "niet ingesteld: alleen ingelogd als admin ben je onbeperkt", false);
  add("Kennisengine: ranking (B4)", true, knowledgeRankingV2Enabled(env.KNOWLEDGE_RANKING_V2, env.KNOWLEDGE_ENGINE_V2) ? "aan (KNOWLEDGE_RANKING_V2 of het oude KNOWLEDGE_ENGINE_V2)" : "uit", false);
  add("Kennisengine: schrijven (B5)", true, knowledgeWritingV2Enabled(env.KNOWLEDGE_WRITING_V2, env.KNOWLEDGE_ENGINE_V2) ? "aan (KNOWLEDGE_WRITING_V2 of het oude KNOWLEDGE_ENGINE_V2)" : "uit", false);
  add("Kennisengine: eigen keuzes eerst (anker)", true, knowledgeAnchorEnabled(env.KNOWLEDGE_ANCHOR_PICKS) ? "aan (KNOWLEDGE_ANCHOR_PICKS): vier eigen keuzes in het boek" : "uit", false);
  const priceTest = parsePriceTest(env.PRICE_TEST);
  add("PRICE_TEST", !(has(env.PRICE_TEST) && !priceTest), has(env.PRICE_TEST) ? (priceTest ? `aan: ${variantIds(priceTest).join(", ")} (bezoekers krijgen na toestemming voor analytics een variant)` : "PROBLEEM: de waarde klopt niet (JSON met prijzen in centen, 100-10000), dus de test staat UIT") : "uit (iedereen betaalt de gewone prijs)", false);
  add("SEASONAL_EDITION", true, seasonalEditionEnabled(env.SEASONAL_EDITION) ? "aan (een follow-uplink met ?season= schrijft het boek voor dat seizoen)" : "uit", false);
  add("NEXT_PUBLIC_WINDOW_PRICE_CENTS", true, has(env.NEXT_PUBLIC_WINDOW_PRICE_CENTS) ? `${env.NEXT_PUBLIC_WINDOW_PRICE_CENTS} (wordt genegeerd: de prijs staat vast in de code, 750 cent)` : "vast in de code (750 cent)", false);
  return checks;
}
