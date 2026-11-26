import type { Metadata } from "next";
import { formatPrice } from "@/lib/pricing";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { feedbackSummary, percent, readScore, type FeedbackRow, type ScoreSummary } from "@/lib/adminStats";
import type { SupabaseClient } from "@supabase/supabase-js";
import { summarizeBookFeedback, type BookFeedbackRow } from "@/lib/bookFeedback";
import { summarizeCheckins, type CheckinRow } from "@/lib/checkin";
import { AdminShell, BarList, Card, Section, Tile, TileGrid } from "../ui";

export const metadata: Metadata = {
  title: "Feedback — WindowInto admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DOOR_KIND: Record<string, string> = {
  natural: "Vertrouwd",
  discovery: "Ontdekking",
  unexpected: "Onverwacht",
  stretch: "Stretch",
  wildcard: "Wildcard",
};

const SCALE: Record<"flow" | "profile" | "doors" | "places", string[]> = {
  flow: ["Zwaar", "Matig", "Prima", "Fijn", "Heerlijk"],
  profile: ["Helemaal niet", "Niet echt", "Half", "Redelijk", "Volledig"],
  doors: ["Helemaal niet", "Niet echt", "Half", "Redelijk", "Volledig"],
  places: ["Helemaal niet", "Niet echt", "Half", "Redelijk", "Volledig"],
};

function ScoreCard({ title, question, summary, scale }: { title: string; question: string; summary: ScoreSummary; scale: string[] }) {
  return (
    <Card>
      <p className="text-xs text-ink/70">{title}</p>
      <p className="mt-1 text-sm text-ink/70">{question}</p>
      <p className="mt-3 font-serif text-3xl text-ink">
        {summary.mean === null ? "—" : summary.mean.toFixed(1)}
        <span className="ml-1 text-sm text-ink/70">/ 5</span>
      </p>
      <p className="mt-1 text-xs text-ink/70">
        {readScore(summary.mean, summary.n)} · {summary.n} antwoord{summary.n === 1 ? "" : "en"}
      </p>
      <div className="mt-3">
        <BarList items={summary.distribution.map((v, i) => ({ label: `${i + 1} · ${scale[i]}`, value: v }))} />
      </div>
    </Card>
  );
}

export default async function AdminFeedbackPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("test_feedback").select("*").order("created_at", { ascending: false }).limit(2000);
  const rows = (data ?? []) as unknown as FeedbackRow[];
  const s = feedbackSummary(rows);

  // What buyers rated their own book (Step 241). Not in the generated types (migration 0031), and missing until that migration has run.
  const loose = supabase as unknown as SupabaseClient;
  const ratingResult = await loose.from("book_feedback").select("rating, comment, quote_consent, locale, created_at").order("created_at", { ascending: false }).limit(2000);
  const ratings = summarizeBookFeedback(ratingResult.error ? [] : ((ratingResult.data ?? []) as BookFeedbackRow[]));

  // What buyers did with the book a week later (Step 243): the answers to the check-in mail, and how many mails went out. Missing until migration 0032 has run.
  const checkinResult = await loose.from("book_checkins").select("answer, comment, quote_consent, locale, created_at").order("created_at", { ascending: false }).limit(2000);
  const sentResult = await loose.from("window_plans").select("id", { count: "exact", head: true }).not("checkin_sent_at", "is", null);
  const checkins = summarizeCheckins(checkinResult.error ? [] : ((checkinResult.data ?? []) as CheckinRow[]), sentResult.error ? 0 : (sentResult.count ?? 0));

  return (
    <AdminShell
      active="/admin/feedback"
      title="Feedback van testers"
      intro={
        <>
          De korte vragenlijst onder het boek (alleen zichtbaar op de testomgeving). Alles is anoniem.{" "}
          <a href="/api/admin/feedback/export" className="font-medium text-accent-dark hover:underline">
            Download als CSV
          </a>
        </>
      }
    >
      {error && <p className="text-sm text-red-600">Kon de feedback niet laden: {error.message}</p>}

      <Section title="Waardering van kopers" hint={'"Hoe waardevol was dit boek voor je?" (1-5), onderaan het boek. Wie 4 of 5 geeft, ziet de vriendcodes en mag een zin achterlaten.'}>
        {ratingResult.error ? (
          <p className="text-sm text-amber-700">Nog niet beschikbaar: draai migratie 0031_book_feedback.sql in Supabase. Tot dan wordt de waardering niet opgeslagen (de knoppen werken wel).</p>
        ) : (
          <>
            <TileGrid>
              <Tile label="Waarderingen" value={ratings.n} sub={ratings.n < 20 ? "nog weinig: lees de zinnen" : undefined} />
              <Tile label="Gemiddeld" value={ratings.mean === null ? "—" : ratings.mean.toFixed(1)} sub="van 5" />
              <Tile
                label="Enthousiast (4 of 5)"
                value={percent(ratings.enthusiastic)}
                tone={ratings.enthusiastic === null ? undefined : ratings.enthusiastic >= 0.6 ? "good" : ratings.enthusiastic < 0.4 ? "bad" : undefined}
              />
            </TileGrid>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card>
                <BarList items={ratings.distribution.map((v, i) => ({ label: `${i + 1}`, value: v }))} total={ratings.n} />
              </Card>
              <Card>
                {ratings.comments.length === 0 ? (
                  <p className="text-sm text-ink/70">Nog geen zinnen.</p>
                ) : (
                  <ul className="space-y-3">
                    {ratings.comments.slice(0, 12).map((c, i) => (
                      <li key={i} className="text-sm text-ink">
                        {c.text}
                        <span className="mt-1 block text-xs text-ink/70">
                          {c.rating} van 5 · {c.at.slice(0, 10)}
                          {c.locale ? ` · ${c.locale.toUpperCase()}` : ""} ·{" "}
                          {c.consent ? <strong className="text-emerald-700">mag anoniem op de site</strong> : "niet voor de site"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </Section>

      <Section title="Wat deden kopers ermee?" hint={"De check-inmail een week na het boek: \"Heb je er al iets mee gedaan?\" met drie knoppen. Eén klik is het antwoord; wie \"ja\" kiest mag een zin achterlaten."}>
        {checkinResult.error ? (
          <p className="text-sm text-amber-700">Nog niet beschikbaar: draai migratie 0032_book_checkins.sql in Supabase. Tot dan wordt de mail niet verstuurd en worden antwoorden niet opgeslagen.</p>
        ) : (
          <>
            <TileGrid>
              <Tile label="Mails verstuurd" value={checkins.sent} />
              <Tile label="Antwoorden" value={checkins.answered} sub={checkins.responseRate === null ? undefined : `${percent(checkins.responseRate)} van de mails`} />
              <Tile
                label="Ja, ermee aan de slag"
                value={percent(checkins.doneShare)}
                tone={checkins.doneShare === null ? undefined : checkins.doneShare >= 0.4 ? "good" : undefined}
                sub={`${checkins.counts.done} ja · ${checkins.counts.planned} van plan · ${checkins.counts.not} nee`}
              />
            </TileGrid>
            <Card>
              <div className="mt-1">
                <BarList
                  items={[
                    { label: "Ja, ermee aan de slag", value: checkins.counts.done },
                    { label: "Nog niet, staat op de lijst", value: checkins.counts.planned },
                    { label: "Nee, het is er niet van gekomen", value: checkins.counts.not },
                  ]}
                  total={checkins.answered}
                />
              </div>
            </Card>
            {checkins.comments.length > 0 && (
              <Card>
                <ul className="space-y-3">
                  {checkins.comments.slice(0, 12).map((c, i) => (
                    <li key={i} className="text-sm text-ink">
                      {c.text}
                      <span className="mt-1 block text-xs text-ink/70">
                        {c.answer === "done" ? "ja" : c.answer === "planned" ? "van plan" : "nee, dit hield hen tegen"} · {c.at.slice(0, 10)}
                        {c.locale ? ` · ${c.locale.toUpperCase()}` : ""} ·{" "}
                        {c.usable ? <strong className="text-emerald-700">mag anoniem op de site</strong> : "niet voor de site"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </Section>

      <Section title="Zo lees je dit" hint="Een paar vuistregels, zodat een getal niet te veel of te weinig zegt.">
        <Card>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink/75">
            <li>
              <strong>Eerst het aantal.</strong> Onder de ± 20 antwoorden zegt een gemiddelde weinig: één kritische tester kan het beeld omgooien. Lees dan vooral de opmerkingen.
            </li>
            <li>
              <strong>Scores 1-5:</strong> 4,2 of hoger is sterk, 3,6 tot 4,2 goed, 3 tot 3,6 wisselend, onder de 3 een probleem. Kijk liever naar de verdeling dan naar het gemiddelde: veel 5&apos;s en veel 1&apos;s samen (een
              &quot;tweespalt&quot;) is iets anders dan een rij 3&apos;s.
            </li>
            <li>
              <strong>&quot;Zou je betalen?&quot;</strong> is een uitspraak, geen koop. Een &quot;ja&quot; wordt in het echt vaak maar de helft. Een prijs rond {formatPrice("nl")} is pas gezond als ruim de helft ja zegt en weinig mensen nee. De
              score hieronder telt &quot;misschien&quot; voor een halve ja.
            </li>
            <li>
              <strong>Welke deur?</strong> Kiest bijna iedereen de vertrouwde deur, dan staat het onverwachte misschien te ver af. Kiest bijna niemand de wildcard, dan is die te vreemd of te weinig uitgenodigd.
            </li>
            <li>
              <strong>De plekken</strong> zijn de eerlijkste meting van de inhoud: een lage score hier betekent dat de aanbieders niet bestaan, te ver liggen of niet bij de persoon passen, ook al leest het boek goed. Controleer dan zelf
              twee of drie plekken uit dat boek.
            </li>
            <li>
              <strong>De opmerkingen</strong> (&quot;waar twijfelde je&quot;) zijn het waardevolst: hier staat waarom iemand afhaakt. Zie je hetzelfde twee keer, dan is het een echt probleem.
            </li>
            <li>
              <strong>Per taal en per boek</strong> vind je in de CSV. Wat mensen op de site <em>doen</em> (waar ze afhaken in de intake, of ze de PDF openen) staat in PostHog, niet hier.
            </li>
          </ul>
        </Card>
      </Section>

      <Section title="Samengevat">
        <TileGrid>
          <Tile label="Ingevuld" value={s.responses} sub={s.responses < 20 ? "nog weinig: lees de opmerkingen" : undefined} />
          <Tile
            label="Zou betalen (ja + ½ misschien)"
            value={percent(s.payScore)}
            tone={s.payScore === null ? undefined : s.payScore >= 0.6 ? "good" : s.payScore < 0.4 ? "bad" : undefined}
            sub={`${s.wouldPay.yes} ja · ${s.wouldPay.maybe} misschien · ${s.wouldPay.no} nee`}
          />
          <Tile label="Meest zwak" value={<span className="text-base">{s.weakest ?? "—"}</span>} sub="laagste gemiddelde van de scorevragen" />
        </TileGrid>
      </Section>

      <Section title="Scores">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ScoreCard title="Het invullen" question="Hoe voelde het om je venster te vullen?" summary={s.flow} scale={SCALE.flow} />
          <ScoreCard title="Het profiel" question={'Voelde je je begrepen door "Dit zien wij in jouw keuzes"?'} summary={s.profile} scale={SCALE.profile} />
          <ScoreCard title="De deuren" question="Snapte je waarom je deze deuren kreeg?" summary={s.doors} scale={SCALE.doors} />
          <ScoreCard title="De plekken" question="Klopten de plekken en aanbieders in je boek met jouw omgeving?" summary={s.places} scale={SCALE.places} />
        </div>
      </Section>

      <Section title="Is de mail aangekomen?" hint="Antwoord van de tester zelf: dit meet wat in de inbox terechtkwam, niet wat de server verstuurde (dat staat op het Overzicht).">
        <Card>
          <BarList
            items={[
              { label: "Ja, in de inbox", value: s.mail.inbox },
              { label: "Ja, maar in de spam", value: s.mail.spam },
              { label: "Nog niet", value: s.mail.missing },
            ]}
            total={s.mail.answered}
          />
          {s.mail.answered > 0 && s.mail.spam + s.mail.missing > 0 && (
            <p className="mt-3 text-xs text-ink/70">Spam of niet aangekomen bij meer dan één tester: controleer het domein van EMAIL_FROM in Resend (SPF en DKIM).</p>
          )}
        </Card>
      </Section>

      <Section title="Welke deur zou men echt doen?" hint="Het soort deur van het idee dat een tester koos.">
        <Card>
          <BarList items={s.doorKinds.map(([k, v]) => ({ label: DOOR_KIND[k] ?? k, value: v }))} total={s.responses} />
        </Card>
      </Section>

      <Section title="Opmerkingen" hint={'"Waar twijfelde je of haakte je bijna af?" Nieuwste eerst.'}>
        {s.doubts.length === 0 ? (
          <p className="text-sm text-ink/70">Nog geen opmerkingen.</p>
        ) : (
          <ul className="space-y-2">
            {s.doubts.map((d, i) => (
              <li key={i} className="rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink">
                {d.text}
                <span className="mt-1 block text-xs text-ink/70">
                  {d.at.slice(0, 16).replace("T", " ")} UTC{d.locale ? ` · ${d.locale.toUpperCase()}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </AdminShell>
  );
}
