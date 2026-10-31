import type { EvalResultFile } from "@/lib/discovery/eval/results";

// The Markdown report of a harness run (docs/eval/<date>-<engine>.md).

const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const num = (x: number) => x.toFixed(2);

export function renderReport(file: EvalResultFile): string {
  const m = file.metrics;
  const date = file.generatedAt.slice(0, 10);
  const errors = file.profiles.flatMap((p) => p.findings.filter((f) => f.severity === "error"));
  const warns = file.profiles.flatMap((p) => p.findings.filter((f) => f.severity === "warn"));
  const lines: string[] = [];
  const line = (s = "") => lines.push(s);

  line(`# Evaluatie: engine \`${file.engine}\`, ${file.mode}`);
  line();
  line(`Gemaakt op ${date}. Profielen: ${file.source}. ${m.profiles} profielen, ${m.seeds} ideeën.`);
  line(file.mode === "seeds-only" ? "Alleen de selectiemotor (gratis, deterministisch): geen tekst geschreven, geen API-kosten." : "Inclusief geschreven boeken (betaald).");
  line();
  line("## Harde regels (moeten 0 zijn)");
  line();
  line("| E1 harde eisen | E3 herhaling | E4 één wildcard | E5 sociale keuze | E6 toezicht |");
  line("|---|---|---|---|---|");
  line(`| ${m.violations.E1} | ${m.violations.E3} | ${m.violations.E4} | ${m.violations.E5} | ${m.violations.E6} |`);
  line();
  line(`Controles: **${errors.length} fouten**, ${warns.length} waarschuwingen.`);
  line();
  line("## Zachte criteria van de motor");
  line();
  line("| Maat | Aandeel profielen |");
  line("|---|---|");
  for (const [k, v] of Object.entries(m.rates)) line(`| ${k} | ${pct(v)} |`);
  line();
  line("## Diversiteit en betrouwbaarheid");
  line();
  line("| Maat | Waarde |");
  line("|---|---|");
  line(`| Werelden per boek | ${num(m.worldsPerBook)} |`);
  line(`| Subdomeinen per boek | ${num(m.subsPerBook)} |`);
  line(`| Fotocategorieën per boek (van 12) | ${num(m.photoCategoriesPerBook)} |`);
  line(`| Soorten beleving per boek (van 10) | ${num(m.kindsPerBook)} |`);
  line(`| Boeken met een paar ideeën met ≥ 2 gedeelde niet-algemene tags | ${pct(m.pairBooks)} |`);
  line(`| Boeken met twee ideeën in één subdomein | ${pct(m.sameSubBooks)} |`);
  line(`| Boeken waarin een richting versoepeld werd | ${pct(m.relaxedBooks)} |`);
  line(`| Ideeën met \`verify\`-vlaggen | ${pct(m.verifySeeds)} |`);
  line(`| Ideeën met toezichtsplicht (tier 2) | ${pct(m.tier2Seeds)} |`);
  line(`| Ideeën met onbekende kosten | ${pct(m.costUnknownSeeds)} |`);
  line(`| Boeken met budget *gratis* die zo'n idee bevatten | ${m.freeBudgetWithUnknownCost} / ${m.freeBudgetBooks} |`);
  line(`| Aandeel "social" in alle ideeën | ${pct(m.socialKindShare)} |`);
  line(`| Boeken waarin alle 7 niveaus voorkomen | ${pct(m.levelCompleteBooks)} |`);
  line(`| Uitvoerbaarheid (0-1) van niveau 1 Vertrouwd / niveau 2 Praktisch | ${num(m.practicalityByLevel.level1)} / ${num(m.practicalityByLevel.level2)} |`);
  if (m.pickCoverage.profiles > 0) {
    line(`| Eigen keuzes (pagina 2) die in het boek staan | ${pct(m.pickCoverage.mean)} van de bruikbare keuzes, gemiddeld ${num(m.pickCoverage.meanInBook)} per boek (${m.pickCoverage.profiles} profielen) |`);
    line(`| Boeken met minstens min(4, bruikbare keuzes) eigen keuzes | ${pct(m.pickCoverage.goalMet)} |`);
    line(`| Boeken zonder één eigen keuze | ${pct(m.pickCoverage.none)} |`);
  }
  line(`| Verschillende activiteiten gebruikt | ${m.activitiesUsed} |`);
  line(`| Populairste activiteit | ${m.topActivity.id} in ${pct(m.topActivity.share)} van de boeken |`);
  line(`| Top 10 activiteiten, aandeel van alle plekken | ${pct(m.top10Share)} |`);
  line(`| "Als je er maar één kiest" per deur | ${Object.entries(m.oneThingByDoor).sort((a, b) => b[1] - a[1]).map(([d, v]) => `${d} ${pct(v, 0)}`).join(", ")} |`);
  line();
  if (Object.keys(m.notes).length) {
    line("Notities van de motor (hoe vaak een terugvaloptie nodig was): " + Object.entries(m.notes).map(([k, v]) => `${k} ${v}`).join(", "));
    line();
  }

  if (file.quality) {
    const q = file.quality;
    line("## Kwaliteitspoort van het geschreven boek");
    line();
    line(q.releaseGate.pass ? "**Poort: geslaagd.** Geen zichtbare redenering en geen herhaalde zinnen in een boek." : `**Poort: NIET geslaagd.** ${q.releaseGate.failures.join("; ")}.`);
    line();
    line("| Maat | Waarde |");
    line("|---|---|");
    line(`| Boeken / ideeën | ${q.books} / ${q.ideas} |`);
    line(`| Zichtbare redenering (pijltjes, "leiden wij af") | ${q.counts.exposed_reasoning} |`);
    line(`| Dezelfde zin op twee ideeën | ${q.counts.repeated_sentence} |`);
    line(`| Seizoensfouten | ${q.counts.season} |`);
    line(`| Type en binnen/buiten spreken elkaar tegen | ${q.counts.type_setting} |`);
    line(`| Tijdchip klopt niet bij de activiteit | ${q.counts.time_chip} |`);
    line(`| "Ook in deze richting" zonder verband | ${q.counts.related} |`);
    line(`| Boeken zonder idee dat de beschikbare tijd vult | ${q.counts.coverage_time} |`);
    line(`| Boeken met te weinig ideeën die het budget benutten | ${q.counts.coverage_budget} |`);
    line(`| Ideeën met een echte plek uit het onderzoek | ${q.ideasWithPlace} van ${q.ideas} (${pct(q.placeRate)}), waarvan ${q.ideasWithPlaceSite} met website |`);
    line(`| Kosten / gemiddelde duur | $${q.totalUsd.toFixed(3)} / ${q.avgSeconds.toFixed(0)} s |`);
    line();
    line("Plekken zijn geverifieerd door de websitecontrole van het onderzoek (host en pagina); een Google Places-controle is bewust niet gebouwd.");
    line();
  }

  const withRun = file.profiles.filter((p) => p.run);
  if (withRun.length) {
    line("## Kosten, tijd en meldingen van het schrijven");
    line();
    line("Kosten zijn berekend uit de `usage` van elk antwoord (zelfde prijzen als docs/discovery-api-costs.md); onderzoek komt uit de cache als dezelfde activiteit, plaats en maand al is opgezocht.");
    line();
    line("| Profiel | $ | Seconden | Ideeën met eigen invulling (van 7) | Meldingen van de pijplijn | PDF |");
    line("|---|---|---|---|---|---|");
    for (const p of withRun) line(`| ${p.id} | ${p.run!.usd.toFixed(3)} | ${p.run!.seconds.toFixed(0)} | ${p.run!.fillCount} | ${p.run!.issues.length ? p.run!.issues.join("; ").replace(/\|/g, "/") : "geen"} | ${p.run!.pdf ?? ""} |`);
    line(`| **Totaal** | **${withRun.reduce((s, p) => s + p.run!.usd, 0).toFixed(3)}** | **${withRun.reduce((s, p) => s + p.run!.seconds, 0).toFixed(0)}** | | | |`);
    line();
  }

  if (errors.length || warns.length) {
    line("## Bevindingen");
    line();
    line("| Profiel | Ernst | Controle | Waar | Melding |");
    line("|---|---|---|---|---|");
    for (const p of file.profiles) for (const f of p.findings) line(`| ${p.id} | ${f.severity} | ${f.check} | ${f.where ?? ""} | ${f.message.replace(/\|/g, "/")} |`);
    line();
  }

  if (file.profiles.length <= 40) {
    line("## Per profiel");
    line();
    for (const p of file.profiles) {
      line(`### ${p.id} ${p.title}${p.edge ? " (randgeval)" : ""}`);
      line();
      line("| Deur | Idee | Pad |");
      line("|---|---|---|");
      for (const s of p.seeds) line(`| ${s.door} | ${s.label.nl} | ${s.chain.length > 1 ? s.chain.join(" → ") : ""} |`);
      if (p.notes.length) line(`\nNotities: ${p.notes.join(", ")}`);
      line();
    }
  }
  return lines.join("\n") + "\n";
}
