import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { costOverview, overview, percent, ratio, type PaymentRow, type PlanRow } from "@/lib/adminStats";
import { envChecks } from "@/lib/adminEnv";
import { loadCapacity, type ClosedReason } from "@/lib/capacity";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isExemptIp, parseExemptIps, quotaOverview, requestIp } from "@/lib/testQuota";
import { AdminShell, BarList, Card, Section, Tile, TileGrid, formatEuro, formatSeconds } from "./ui";

export const metadata: Metadata = {
  title: "Overzicht — WindowInto admin",
  robots: { index: false, follow: false },
};

// Always fresh: this page is for looking at what happened a minute ago.
export const dynamic = "force-dynamic";

// Why the pay button is closed, in words for the owner (src/lib/capacity.ts).
const CLOSED_TEXT: Record<ClosedReason, string> = {
  daily: "het dagmaximum aan boeken is bereikt (WINDOW_DAILY_BOOK_LIMIT). Morgen na middernacht gaat het vanzelf weer open; wil je eerder verder, verhoog dan de waarde in Vercel.",
  paused: "je hebt het met de hand uitgezet (WINDOW_CHECKOUT_PAUSED=1 in Vercel). Haal die variabele weg om te heropenen.",
  failing: "de laatste drie boeken mislukten achter elkaar, bij minstens twee bezoekers. Controleer het Anthropic-tegoed en de rate limits. Het gaat vanzelf weer open als die mislukkingen een half uur oud zijn.",
};

export default async function AdminOverviewPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const supabase = createServiceRoleClient();
  const [{ data: plans, error: planError }, { data: payments }, { data: feedback }] = await Promise.all([
    supabase
      .from("window_plans")
      .select("id, created_at, generated_at, status, language, email_sent_at, payment_id, pdf_version, progress_meta, ideas_json, wildcard_json, feedback_json, committed_idea_key")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("payments").select("id, status, amount, currency, created_at").order("created_at", { ascending: false }).limit(2000),
    supabase.from("test_feedback").select("id").limit(2000),
  ]);

  const o = overview((plans ?? []) as unknown as PlanRow[], (payments ?? []) as unknown as PaymentRow[], new Date());
  const maxDay = Math.max(1, ...o.perDay.map((d) => d.count));
  const costs = costOverview((plans ?? []) as unknown as PlanRow[], new Date());
  const usd = (n: number | null) => (n === null ? "—" : `$${n.toFixed(2)}`);
  const emailRate = ratio(o.email.sent, o.email.expected);
  const checks = envChecks(process.env);
  const quota = await quotaOverview(supabase);
  const capacity = await loadCapacity(supabase);
  // The reward for a buyer whose friend ordered (Step 239): needs migration 0030, and a reward code whose mail did not go out is the owner's to send by hand.
  const loose = supabase as unknown as SupabaseClient;
  const tenMinutesAgo = new Date();
  tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
  const rewardProbe = await loose.from("discount_codes").select("rewarded_at, mailed_at").limit(1);
  const unmailedRewards = rewardProbe.error
    ? 0
    : ((await loose.from("discount_codes").select("id", { count: "exact", head: true }).eq("kind", "reward").is("mailed_at", null).lt("created_at", tenMinutesAgo.toISOString())).count ?? 0);
  if (rewardProbe.error) o.attention.push({ level: "amber", text: "De beloning voor kopers wier vriend bestelt wordt nog niet gegeven: draai migratie 0030_discount_reward_codes.sql in Supabase." });
  if (unmailedRewards > 0) {
    o.attention.push({
      level: "red",
      text: `${unmailedRewards} beloningscode${unmailedRewards === 1 ? "" : "s"} voor een koper is gemaakt maar niet verstuurd (mailfout of geen adres). Zoek de bestelling in Orders, de code staat daar bij "beloning"; stuur de koper een compensatiecode of de code zelf.`,
    });
  }
  const myIp = await requestIp();
  const myIpExempt = isExemptIp(myIp, parseExemptIps(process.env.TEST_QUOTA_EXEMPT_IPS));
  const broken = checks.filter((c) => c.required && !c.ok);

  return (
    <AdminShell
      active="/admin"
      title="Overzicht"
      intro="Wat er gebeurt in WindowInto: hoeveel boeken, of ze aankomen, hoe snel ze klaar zijn en of mensen er iets mee doen. Alles is geaggregeerd; er staan geen namen of e-mailadressen op deze pagina."
    >
      {planError && <p className="text-sm text-red-600">Kon de gegevens niet laden: {planError.message}</p>}

      <Section title="Aandacht nodig" hint="Dingen die nu iets van jou vragen. Leeg is goed.">
        {capacity.open ? (
          <p className="mb-3 text-sm text-ink/70">
            Bestellen staat open: {capacity.startedToday} {capacity.startedToday === 1 ? "boek" : "boeken"} vandaag{capacity.limit !== null ? ` van maximaal ${capacity.limit}` : " (geen maximum)"}.
          </p>
        ) : (
          <p className="mb-3 rounded-2xl border border-red-800/20 bg-red-50 px-4 py-3 text-sm text-red-900" role="status">
            <strong>Bestellen is dicht voor bezoekers:</strong> {CLOSED_TEXT[capacity.reason as ClosedReason]} Jij zelf kunt nog gewoon bestellen om te testen.
          </p>
        )}
        {o.attention.length === 0 && broken.length === 0 ? (
          <p className="rounded-2xl border border-emerald-900/15 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Niets dat aandacht vraagt.</p>
        ) : (
          <ul className="space-y-2">
            {broken.map((c) => (
              <li key={c.name} className="rounded-2xl border border-red-800/20 bg-red-50 px-4 py-3 text-sm text-red-900">
                Instelling <code>{c.name}</code>: {c.detail}
              </li>
            ))}
            {o.attention.map((a, i) => (
              <li key={i} className={`rounded-2xl border px-4 py-3 text-sm ${a.level === "red" ? "border-red-800/20 bg-red-50 text-red-900" : "border-amber-800/20 bg-amber-50 text-amber-900"}`}>
                {a.text}
                {a.planId && (
                  <>
                    {" "}
                    <Link href="/admin/orders" className="font-medium underline">
                      Bekijk orders
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Instellingen van deze deployment" hint="Wat de draaiende site van zijn instellingen ziet (alleen of iets aanwezig is, nooit de geheime waarde). Staat hier iets als ontbrekend terwijl je het in Vercel hebt toegevoegd, dan is het niet in deze omgeving terechtgekomen: controleer of Production of Preview is aangevinkt en deploy opnieuw.">
        <Card>
          <ul className="space-y-1.5 text-sm">
            {checks.map((c) => (
              <li key={c.name} className="grid grid-cols-[1.5rem_minmax(0,15rem)_1fr] items-baseline gap-2">
                <span className={c.ok ? "text-emerald-700" : c.required ? "text-red-700" : "text-amber-700"} aria-hidden="true">
                  {c.ok ? "✓" : c.required ? "✗" : "–"}
                </span>
                <code className="truncate text-xs text-ink">{c.name}</code>
                <span className={c.ok ? "text-ink/70" : c.required ? "text-red-800" : "text-ink/70"}>{c.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section title="Boeken" hint="Een boek telt als gemaakt zodra het klaar staat. Testboeken (zonder betaling) staan apart.">
        <TileGrid>
          <Tile label="Gemaakt, in totaal" value={o.ready} sub={`${o.paidReady} betaald · ${o.testReady} test`} />
          <Tile label="Laatste 24 uur" value={o.last24h} sub={`${o.last7d} in de laatste 7 dagen`} />
          <Tile label="Mislukt of blijven hangen" value={o.failed + o.stuck} tone={o.failed + o.stuck > 0 ? "bad" : "good"} sub={`${o.failed} mislukt · ${o.stuck} blijven hangen`} />
          <Tile label="Typische duur" value={formatSeconds(o.medianSeconds)} sub={o.slowest ? `traagste: ${formatSeconds(o.slowest)}` : undefined} />
        </TileGrid>
        <Card className="mt-4">
          <p className="mb-3 text-xs text-ink/70">Boeken per dag, laatste 14 dagen</p>
          <div className="flex h-28 items-end gap-1.5" role="img" aria-label="Boeken per dag">
            {o.perDay.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${d.count}`}>
                <span className="text-[10px] tabular-nums text-ink/70">{d.count || ""}</span>
                <span className="w-full rounded-t bg-accent" style={{ height: `${d.count ? Math.max(4, (d.count / maxDay) * 80) : 2}px`, opacity: d.count ? 1 : 0.2 }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5 text-[10px] text-ink/70">
            {o.perDay.map((d) => (
              <span key={d.day} className="flex-1 text-center">
                {d.day.slice(8)}
              </span>
            ))}
          </div>
        </Card>
      </Section>

      <Section
        title="Kosten per boek"
        hint="Wat het maken van een boek aan modelaanroepen kostte (onderzoek, schrijven, kwaliteitscontrole), laatste 30 dagen, uit de kosten die elk boek bewaart. Boeken van vóór de meting staan er niet in. De Google-opzoekingen (gratis tot 1.000 per maand) en de opwarmstap tijdens het betalen (alleen in de Vercel-log) zijn niet meegeteld. Leg het totaal naast de Anthropic-factuur van de maand."
      >
        {costs.books === 0 ? (
          <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink/70">Nog geen boek met kostenmeting. Elk nieuw boek bewaart zijn kosten; ze verschijnen hier zodra het eerste klaar is.</p>
        ) : (
          <>
            <TileGrid>
              <Tile label="Gemiddeld per boek" value={usd(costs.averageUsd)} sub={`mediaan ${usd(costs.medianUsd)} · hoogste ${usd(costs.maxUsd)}`} />
              <Tile label="Totaal, 30 dagen" value={usd(costs.totalUsd)} sub={`${costs.books} boeken met kostenmeting`} />
              <Tile label="Antwoorden uit de cache" value={percent(costs.cacheShare)} sub="van alle onderzoeksantwoorden" />
              <Tile label="Aan de kostengrens gehouden" value={costs.cappedBooks} sub={`${costs.classicBooks} met de klassieke terugval · ${costs.placesLookups} Google-opzoekingen`} />
            </TileGrid>
            <Card className="mt-4">
              <p className="mb-2 text-xs text-ink/70">Gemiddeld per soort aanroep</p>
              <ul className="space-y-1 text-sm">
                {costs.perKind.map(([kind, v]) => (
                  <li key={kind} className="flex justify-between gap-4">
                    <span>{kind}</span>
                    <span className="tabular-nums text-ink/70">{usd(v)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </Section>

      <Section title="E-mail" hint="Van elk betaald boek hoort een mail met de PDF te komen. Een mislukte mail bewaart zijn reden; die staat hieronder en bij de order.">
        <TileGrid>
          <Tile label="Verstuurd" value={percent(emailRate)} tone={emailRate === null ? undefined : emailRate >= 0.95 ? "good" : "bad"} sub={`${o.email.sent} van ${o.email.expected} betaalde boeken`} />
        </TileGrid>
        {o.email.errors.length > 0 && (
          <Card className="mt-4">
            <p className="mb-2 text-xs text-ink/70">Laatste foutmeldingen</p>
            <ul className="space-y-1.5 text-sm">
              {o.email.errors.map((e) => (
                <li key={e.planId} className="text-ink/80">
                  <span className="tabular-nums text-ink/70">{e.at.slice(0, 16).replace("T", " ")}</span> — {e.message}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink/70">
              &quot;Missing API key&quot; = <code>RESEND_API_KEY</code> ontbreekt in Vercel. &quot;Domain is not verified&quot; = <code>windowinto.nl</code> nog niet geverifieerd in Resend.
            </p>
          </Card>
        )}
      </Section>

      <Section title="Betalingen" hint="Alleen betalingen die Stripe als gelukt heeft gemeld tellen mee voor de omzet. In de testomgeving blijven ze op 'pending' staan zolang de Stripe-webhook niet is ingesteld.">
        <TileGrid>
          <Tile label="Bestellingen" value={o.payments.total} sub={`${o.payments.succeeded} gelukt · ${o.payments.pending} pending · ${o.payments.failed} mislukt`} />
          <Tile label="Omzet (gelukt)" value={formatEuro(o.payments.revenueCents)} />
        </TileGrid>
      </Section>

      {quota && quota.limit !== null && (
        <Section title="Testlimiet per internetverbinding" hint="Hoeveel verschillende verbindingen (IP-adressen) hebben een boek gemaakt, en hoeveel hebben hun limiet bereikt. Wie een boek maakt terwijl hij als admin is ingelogd, telt niet mee.">
          <TileGrid>
            <Tile label="Limiet per verbinding" value={quota.limit} />
            <Tile label="Verbindingen die meededen" value={quota.addresses} sub={`${quota.books} boeken geteld`} />
            <Tile label="Limiet bereikt" value={quota.atLimit} sub="deze mensen kunnen geen nieuw boek meer maken" />
          </TileGrid>
          <p className="mt-3 text-sm text-ink/70">
            Jouw adres zoals de server het ziet: <strong>{myIp ?? "niet leesbaar"}</strong>
            {myIpExempt ? " (staat in TEST_QUOTA_EXEMPT_IPS: onbeperkt)" : ". Zet dit in TEST_QUOTA_EXEMPT_IPS in Vercel om ook zonder inloggen onbeperkt te zijn."}
          </p>
        </Section>
      )}

      <Section title="Doen mensen er iets mee?" hint="Het sterkste signaal dat het boek waarde heeft: een idee waarderen ('hartje') of kiezen ('dit ga ik doen').">
        <TileGrid>
          <Tile label="Boeken met minstens één hartje" value={percent(ratio(o.engagement.liked, o.engagement.ready))} sub={`${o.engagement.liked} van ${o.engagement.ready}`} />
          <Tile label="Boeken met een gekozen idee" value={percent(ratio(o.engagement.committed, o.engagement.ready))} sub={`${o.engagement.committed} van ${o.engagement.ready}`} />
          <Tile label="Testfeedback ontvangen" value={feedback?.length ?? 0} sub="Zie het tabblad Feedback" />
        </TileGrid>
      </Section>

      <Section title="Taal">
        <Card>
          <BarList
            items={[
              { label: "Nederlands", value: o.languages.nl },
              { label: "Engels", value: o.languages.en },
            ]}
            total={o.ready}
          />
        </Card>
      </Section>

      <p className="text-xs text-ink/70">
        Meer: het tabblad <Link href="/admin/inhoud" className="underline">Inhoud</Link> toont wát mensen kiezen en wat er wordt voorgesteld, en <Link href="/admin/feedback" className="underline">Feedback</Link> de antwoorden van testers.
        Gedrag op de site (waar mensen afhaken in de intake) staat in PostHog.
      </p>
    </AdminShell>
  );
}
