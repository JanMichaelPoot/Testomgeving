import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { CONFIRM_WORD, parseScope, previewCleanup, type CleanupCounts, type CleanupScope } from "@/lib/adminCleanup";
import { AdminShell, Card, Section } from "../ui";
import { cleanupAction } from "./actions";

export const metadata: Metadata = {
  title: "Opruimen — WINDOW admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ROWS: { key: keyof CleanupCounts; label: string }[] = [
  { key: "books", label: "Boeken" },
  { key: "orders", label: "Orders (alleen testbetalingen)" },
  { key: "sessions", label: "Sessies" },
  { key: "intakes", label: "Ingevulde intakes" },
  { key: "pdfs", label: "PDF-bestanden" },
  { key: "feedback", label: "Testfeedback" },
  { key: "log", label: "Logboekregels" },
  { key: "users", label: "E-mailadressen van testers" },
];

function CountTable({ counts, verb }: { counts: CleanupCounts; verb: string }) {
  return (
    <table className="w-full max-w-md text-sm">
      <tbody>
        {ROWS.map((r) => (
          <tr key={r.key} className="border-t border-ink/10 first:border-0">
            <td className="py-1.5 text-ink/80">{r.label}</td>
            <td className="py-1.5 text-right tabular-nums text-ink">{counts[r.key]}</td>
          </tr>
        ))}
        <tr className="border-t border-ink/10">
          <td className="py-1.5 text-ink/60">Echte orders die blijven staan</td>
          <td className="py-1.5 text-right tabular-nums text-emerald-800">{counts.keptReal}</td>
        </tr>
      </tbody>
      <caption className="sr-only">Aantallen {verb}</caption>
    </table>
  );
}

function hidden(scope: CleanupScope) {
  return (
    <>
      <input type="hidden" name="before" value={scope.before} />
      {scope.books && <input type="hidden" name="books" value="1" />}
      {scope.unfinished && <input type="hidden" name="unfinished" value="1" />}
      {scope.feedback && <input type="hidden" name="feedback" value="1" />}
      {scope.log && <input type="hidden" name="log" value="1" />}
    </>
  );
}

export default async function AdminCleanupPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const params = await props.searchParams;
  const get = (name: string) => {
    const v = params[name];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
  const today = new Date().toISOString().slice(0, 10);
  const scope = parseScope({ get });
  const done = get("done") === "1";
  const error = get("error");

  let preview: CleanupCounts | null = null;
  let previewError: string | null = null;
  if (scope && get("preview") === "1") {
    try {
      preview = await previewCleanup(createServiceRoleClient(), scope);
    } catch (err) {
      previewError = err instanceof Error ? err.message : "onbekende fout";
    }
  }

  const checked = (name: string, fallback: boolean) => (scope || done ? get(name) === "1" : fallback);

  return (
    <AdminShell
      active="/admin/opruimen"
      title="Testgegevens opruimen"
      intro="Verwijder de gegevens uit de testfase, zodat de cijfers op het overzicht over echt gebruik gaan. Je ziet eerst precies wat verdwijnt, en verwijderen kan alleen door het woord VERWIJDER te typen. Verwijderd is weg: er is geen herstel."
    >
      {done && (
        <div className="rounded-2xl border border-emerald-900/15 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-medium">Klaar: de testgegevens tot en met {get("before")} zijn verwijderd.</p>
          <div className="mt-2">
            <CountTable
              verb="verwijderd"
              counts={Object.fromEntries(ROWS.map((r) => [r.key, Number(get(r.key) ?? 0)]).concat([["keptReal", Number(get("keptReal") ?? 0)]])) as unknown as CleanupCounts}
            />
          </div>
        </div>
      )}
      {error === "scope" && <p className="text-sm text-red-700">Kies een datum en minstens één soort gegevens.</p>}
      {error === "confirm" && <p className="text-sm text-red-700">Typ het woord {CONFIRM_WORD} om te bevestigen. Er is niets verwijderd.</p>}
      {error === "failed" && <p className="text-sm text-red-700">Het verwijderen is onderbroken: {get("message") ?? "onbekende fout"}. Een deel kan al zijn verwijderd; kijk het resultaat na en probeer opnieuw.</p>}
      {previewError && <p className="text-sm text-red-700">Kon niet bepalen wat er zou verdwijnen: {previewError}</p>}

      <Section
        title="1. Kies wat weg mag"
        hint="Echte orders (betaald met een echte kaart) worden nooit verwijderd, welke datum je ook kiest: die bewaar je om fiscale en juridische redenen. Als testorder telt alleen een betaling die Stripe als testsessie (cs_test_...) kent, of een boek zonder betaling."
      >
        <Card>
          <form method="get" className="space-y-4 text-sm">
            <input type="hidden" name="preview" value="1" />
            <label className="block">
              <span className="font-medium text-ink">Alles tot en met</span>
              <input
                type="date"
                name="before"
                required
                max={today}
                defaultValue={scope?.before ?? today}
                className="mt-1 block rounded-lg border border-ink/20 bg-cream px-3 py-2 text-ink"
              />
              <span className="mt-1 block text-xs text-ink/50">Kies de dag vlak voor je echte start. Alles wat daarna is gemaakt blijft staan.</span>
            </label>
            <fieldset className="space-y-2">
              <legend className="font-medium text-ink">Wat</legend>
              <label className="flex items-start gap-2">
                <input type="checkbox" name="books" value="1" defaultChecked={checked("books", true)} className="mt-1" />
                <span>
                  <span className="text-ink">Testboeken en testorders</span>
                  <span className="block text-xs text-ink/50">Boeken zonder betaling of met een Stripe-testbetaling, met hun sessie, intake, PDF en toestemmingsregels.</span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" name="unfinished" value="1" defaultChecked={checked("unfinished", true)} className="mt-1" />
                <span>
                  <span className="text-ink">Onafgemaakte intakes</span>
                  <span className="block text-xs text-ink/50">Sessies waar iemand de intake invulde maar nooit een boek kreeg.</span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" name="feedback" value="1" defaultChecked={checked("feedback", true)} className="mt-1" />
                <span>
                  <span className="text-ink">Testfeedback</span>
                  <span className="block text-xs text-ink/50">De antwoorden van de vragenlijst onder het boek. Feedback bij verwijderde boeken gaat sowieso mee.</span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" name="log" value="1" defaultChecked={checked("log", true)} className="mt-1" />
                <span>
                  <span className="text-ink">Logboek</span>
                  <span className="block text-xs text-ink/50">De anonieme registratie van gegenereerde boeken (het tabblad Logboek).</span>
                </span>
              </label>
            </fieldset>
            <button type="submit" className="inline-flex min-h-11 items-center rounded-lg border border-ink/30 bg-paper px-5 font-medium text-ink hover:border-ink">
              Toon wat er verdwijnt
            </button>
          </form>
        </Card>
      </Section>

      {scope && preview && (
        <Section title="2. Dit verdwijnt" hint={`Alles tot en met ${scope.before}. Nog niets is verwijderd.`}>
          <Card>
            <CountTable counts={preview} verb="die verdwijnen" />
            {preview.books + preview.orders + preview.sessions + preview.feedback + preview.log + preview.users === 0 ? (
              <p className="mt-4 text-sm text-ink/60">Er is niets om te verwijderen met deze keuze.</p>
            ) : (
              <form action={cleanupAction} className="mt-5 space-y-3 border-t border-ink/10 pt-4 text-sm">
                {hidden(scope)}
                <label className="block">
                  <span className="font-medium text-ink">
                    Typ <code>{CONFIRM_WORD}</code> om dit definitief te verwijderen
                  </span>
                  <input name="confirm" autoComplete="off" className="mt-1 block w-48 rounded-lg border border-ink/20 bg-cream px-3 py-2 text-ink" />
                </label>
                <button type="submit" className="inline-flex min-h-11 items-center rounded-lg bg-red-700 px-5 font-semibold text-white hover:bg-red-800">
                  Verwijder definitief
                </button>
              </form>
            )}
          </Card>
        </Section>
      )}
    </AdminShell>
  );
}
