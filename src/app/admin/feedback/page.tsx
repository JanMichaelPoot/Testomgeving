import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { feedbackSummary, percent, readScore, type FeedbackRow, type ScoreSummary } from "@/lib/adminStats";
import { AdminShell, BarList, Card, Section, Tile, TileGrid } from "../ui";

export const metadata: Metadata = {
  title: "Feedback — WINDOW admin",
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

const SCALE: Record<"flow" | "profile" | "doors", string[]> = {
  flow: ["Zwaar", "Matig", "Prima", "Fijn", "Heerlijk"],
  profile: ["Helemaal niet", "Niet echt", "Half", "Redelijk", "Volledig"],
  doors: ["Helemaal niet", "Niet echt", "Half", "Redelijk", "Volledig"],
};

function ScoreCard({ title, question, summary, scale }: { title: string; question: string; summary: ScoreSummary; scale: string[] }) {
  return (
    <Card>
      <p className="text-xs text-ink/50">{title}</p>
      <p className="mt-1 text-sm text-ink/70">{question}</p>
      <p className="mt-3 font-serif text-3xl text-ink">
        {summary.mean === null ? "—" : summary.mean.toFixed(1)}
        <span className="ml-1 text-sm text-ink/40">/ 5</span>
      </p>
      <p className="mt-1 text-xs text-ink/50">
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
              <strong>&quot;Zou je betalen?&quot;</strong> is een uitspraak, geen koop. Een &quot;ja&quot; wordt in het echt vaak maar de helft. Een prijs rond €3,50 is pas gezond als ruim de helft ja zegt en weinig mensen nee. De
              score hieronder telt &quot;misschien&quot; voor een halve ja.
            </li>
            <li>
              <strong>Welke deur?</strong> Kiest bijna iedereen de vertrouwde deur, dan staat het onverwachte misschien te ver af. Kiest bijna niemand de wildcard, dan is die te vreemd of te weinig uitgenodigd.
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
          <Tile label="Meest zwak" value={<span className="text-base">{s.weakest ?? "—"}</span>} sub="laagste gemiddelde van de drie scorevragen" />
        </TileGrid>
      </Section>

      <Section title="Scores">
        <div className="grid gap-4 md:grid-cols-3">
          <ScoreCard title="Het invullen" question="Hoe voelde het om je venster te vullen?" summary={s.flow} scale={SCALE.flow} />
          <ScoreCard title="Het profiel" question={'Voelde je je begrepen door "Zo kijken wij door jouw venster"?'} summary={s.profile} scale={SCALE.profile} />
          <ScoreCard title="De deuren" question="Snapte je waarom je deze deuren kreeg?" summary={s.doors} scale={SCALE.doors} />
        </div>
      </Section>

      <Section title="Welke deur zou men echt doen?" hint="Het soort deur van het idee dat een tester koos.">
        <Card>
          <BarList items={s.doorKinds.map(([k, v]) => ({ label: DOOR_KIND[k] ?? k, value: v }))} total={s.responses} />
        </Card>
      </Section>

      <Section title="Opmerkingen" hint={'"Waar twijfelde je of haakte je bijna af?" Nieuwste eerst.'}>
        {s.doubts.length === 0 ? (
          <p className="text-sm text-ink/50">Nog geen opmerkingen.</p>
        ) : (
          <ul className="space-y-2">
            {s.doubts.map((d, i) => (
              <li key={i} className="rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-sm text-ink">
                {d.text}
                <span className="mt-1 block text-xs text-ink/40">
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
