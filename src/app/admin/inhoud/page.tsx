import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { activityIdsOf, intakeSummary, percent, ratio, topCounts, type PlanRow } from "@/lib/adminStats";
import { ALL_ACTIVITIES, DOMAINS, getActivity } from "@/lib/discovery/library";
import { ASSOCIATIONS } from "@/lib/discovery/associations";
import { AdminShell, BarList, Card, Section, Tile, TileGrid } from "../ui";

export const metadata: Metadata = {
  title: "Inhoud — WINDOW admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Readable labels for the answers the wizards store.
const BUDGET: Record<string, string> = { free: "Gratis", "25": "Tot €25", "100": "Tot €100", allin: "Alles mag" };
const TIME: Record<string, string> = { hour: "Een uur of twee", halfday: "Een halve dag", fullday: "Een hele dag", weekend: "Een weekend" };
const DOOR: Record<string, string> = { natural: "Vertrouwd", discovery: "Ontdekking", unexpected: "Onverwacht", stretch: "Stretch", wildcard: "Wildcard" };
const domainLabel = new Map(DOMAINS.map((d) => [d.id, d.short.nl]));
const imageLabel = new Map(ASSOCIATIONS.map((c) => [c.id, c.label.nl]));

export default async function AdminContentPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const supabase = createServiceRoleClient();
  const [{ data: plans }, { data: intakes }] = await Promise.all([
    supabase.from("window_plans").select("id, created_at, status, language, ideas_json, wildcard_json").eq("status", "ready").order("created_at", { ascending: false }).limit(2000),
    supabase.from("intake_answers").select("raw_json").order("created_at", { ascending: false }).limit(2000),
  ]);

  const books = (plans ?? []) as unknown as Pick<PlanRow, "id" | "created_at" | "language" | "ideas_json" | "wildcard_json">[];
  const intake = intakeSummary((intakes ?? []) as { raw_json: unknown }[]);

  // What we suggested: per activity, in how many books it appeared (once per book).
  const perBook = books.map((b) => [...new Set(activityIdsOf(b))]);
  const withIds = perBook.filter((ids) => ids.length > 0).length;
  const activityCounts = topCounts(perBook.flat(), 15);
  const used = new Set(perBook.flat());
  const slots = perBook.flat();
  const domainShare = topCounts(slots.map((id) => getActivity(id)?.domain), 20);
  const rareShare = ratio(slots.filter((id) => getActivity(id)?.supply === "rare").length, slots.length);
  const regionalShare = ratio(slots.filter((id) => getActivity(id)?.supply === "regional").length, slots.length);
  const tier2Share = ratio(slots.filter((id) => getActivity(id)?.safety.tier === 2).length, slots.length);
  const doorCounts = topCounts(
    books.flatMap((b) => (Array.isArray(b.ideas_json) ? (b.ideas_json as { door?: string }[]).map((i) => i.door) : [])),
    5,
  );
  const hub = activityCounts[0] && withIds ? activityCounts[0][1] / withIds : null;

  const live = ALL_ACTIVITIES.filter((a) => a.status !== "retired");
  const neverSuggested = live.filter((a) => !used.has(a.id));
  const perDomain = DOMAINS.map((d) => {
    const mine = live.filter((a) => a.domain === d.id);
    return { label: d.short.nl, n: mine.length, used: mine.filter((a) => used.has(a.id)).length, rare: mine.filter((a) => a.supply === "rare").length, tier2: mine.filter((a) => a.safety.tier === 2).length };
  });

  return (
    <AdminShell
      active="/admin/inhoud"
      title="Inhoud"
      intro="Wat mensen kiezen en wat WINDOW voorstelt. Handig om te zien of de motor genoeg variatie geeft en of er richtingen of activiteiten zijn die altijd of nooit voorkomen."
    >
      <Section title="Wat stellen we voor?" hint="Alleen boeken die door de selectiemotor zijn gemaakt (met een activiteit-id) tellen mee; oudere boeken niet.">
        <TileGrid>
          <Tile label="Boeken met motorgegevens" value={withIds} sub={`van ${books.length} gemaakte boeken`} />
          <Tile label="Verschillende activiteiten voorgesteld" value={used.size} sub={`van ${live.length} in de bibliotheek`} />
          <Tile
            label="Meest voorgestelde activiteit"
            value={percent(hub)}
            tone={hub !== null && hub > 0.25 ? "bad" : undefined}
            sub={activityCounts[0] ? `van de boeken: ${getActivity(activityCounts[0][0])?.label.nl ?? activityCounts[0][0]}` : undefined}
          />
          <Tile label="Nooit voorgesteld" value={neverSuggested.length} sub="activiteiten die nog in geen boek voorkwamen" />
        </TileGrid>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <p className="mb-3 text-xs text-ink/70">Meest voorgesteld (aantal boeken)</p>
            <BarList items={activityCounts.map(([id, n]) => ({ label: getActivity(id)?.label.nl ?? id, value: n, sub: domainLabel.get(getActivity(id)?.domain ?? "") }))} total={withIds} />
            <p className="mt-3 text-xs text-ink/70">Komt één activiteit in meer dan een kwart van de boeken voor, dan wordt het saai; dan is de motor (te) eenzijdig.</p>
          </Card>
          <Card>
            <p className="mb-3 text-xs text-ink/70">Verdeling over richtingen (alle voorgestelde plekken)</p>
            <BarList items={domainShare.map(([id, n]) => ({ label: domainLabel.get(id) ?? id, value: n }))} total={slots.length} />
          </Card>
          <Card>
            <p className="mb-3 text-xs text-ink/70">Soort deur</p>
            <BarList items={doorCounts.map(([k, n]) => ({ label: DOOR[k] ?? k, value: n }))} />
          </Card>
          <Card>
            <p className="mb-3 text-xs text-ink/70">Hoe moeilijk te vinden en hoeveel begeleiding</p>
            <BarList
              items={[
                { label: "Alleen via aanbieder/vereniging met instructeur", value: Math.round((tier2Share ?? 0) * slots.length) },
                { label: "Aanbod niet overal (regionaal)", value: Math.round((regionalShare ?? 0) * slots.length) },
                { label: "Zeldzaam aanbod", value: Math.round((rareShare ?? 0) * slots.length) },
              ]}
              total={slots.length}
            />
          </Card>
        </div>
      </Section>

      <Section title="Wat vullen mensen in?" hint={`Gebaseerd op ${intake.total} ingevulde intakes. Dit zegt iets over je doelgroep en over welke richtingen en beelden aanslaan.`}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <p className="mb-3 text-xs text-ink/70">Gekozen richtingen</p>
            <BarList items={intake.directions.map(([id, n]) => ({ label: domainLabel.get(id) ?? id, value: n }))} />
          </Card>
          <Card>
            <p className="mb-3 text-xs text-ink/70">Meest gekozen beelden</p>
            <BarList items={intake.images.map(([id, n]) => ({ label: imageLabel.get(id) ?? id, value: n }))} />
          </Card>
          <Card>
            <p className="mb-3 text-xs text-ink/70">Budget</p>
            <BarList items={intake.budget.map(([k, n]) => ({ label: BUDGET[k] ?? k, value: n }))} total={intake.total} />
          </Card>
          <Card>
            <p className="mb-3 text-xs text-ink/70">Tijd</p>
            <BarList items={intake.time.map(([k, n]) => ({ label: TIME[k] ?? k, value: n }))} total={intake.total} />
          </Card>
          <Card>
            <p className="mb-3 text-xs text-ink/70">Leeftijd</p>
            <BarList items={intake.age.map(([k, n]) => ({ label: k, value: n }))} total={intake.total} />
          </Card>
          <Card>
            <p className="mb-3 text-xs text-ink/70">Gezelschap en soort intake</p>
            <BarList items={[...intake.company.map(([k, n]) => ({ label: `Met: ${k}`, value: n })), ...intake.variants.map(([k, n]) => ({ label: `Intake: ${k}`, value: n })), { label: "Cadeau (voornaam ingevuld)", value: intake.gift }]} />
          </Card>
        </div>
      </Section>

      <Section title="De bibliotheek" hint="Per richting: hoeveel activiteiten, hoeveel daarvan al in een boek zijn voorgesteld, en hoeveel zeldzaam of met begeleiding.">
        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-paper">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-xs text-ink/70">
              <tr>
                <th className="px-4 py-2 font-medium">Richting</th>
                <th className="px-4 py-2 text-right font-medium">Activiteiten</th>
                <th className="px-4 py-2 text-right font-medium">Al voorgesteld</th>
                <th className="px-4 py-2 text-right font-medium">Zeldzaam</th>
                <th className="px-4 py-2 text-right font-medium">Met begeleiding</th>
              </tr>
            </thead>
            <tbody>
              {perDomain.map((d) => (
                <tr key={d.label} className="border-t border-ink/10">
                  <td className="px-4 py-2 text-ink">{d.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{d.n}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{d.used}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{d.rare}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{d.tier2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {neverSuggested.length > 0 && books.length >= 20 && (
          <p className="mt-3 max-w-3xl text-xs text-ink/70">
            Nog nooit voorgesteld ({neverSuggested.length}): {neverSuggested.slice(0, 25).map((a) => a.label.nl).join(", ")}
            {neverSuggested.length > 25 ? " …" : ""}
          </p>
        )}
      </Section>
    </AdminShell>
  );
}
