// Cross-checks the numbers and rules the whitepaper states against the source files themselves.
// Independent of the TypeScript probes: this reads the files as text/JSON, so a mistake in a probe would show up as a difference.
// Output: facts/verification.json (rendered in appendix D) and a non-zero exit code when a check fails.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const read = (p) => readFileSync(path.join(root, p), "utf8");
const readJson = (p) => JSON.parse(read(p));
const results = [];
const check = (area, claim, expected, actual) => {
  const ok = String(expected) === String(actual);
  results.push({ area, claim, expected: String(expected), actual: String(actual), ok });
};
const num = (src, re) => {
  const m = src.match(re);
  return m ? Number(m[1].replace(/_/g, "").replace(",", ".")) : NaN;
};

// ---- the library, recounted from the JSON files
const dataDir = "src/lib/discovery/data";
const files = readdirSync(path.join(root, dataDir)).filter((f) => f.endsWith(".json"));
const activities = files.flatMap((f) => readJson(`${dataDir}/${f}`));
const vocab = readJson("src/lib/discovery/vocabulary.json");
check("Bibliotheek", "Aantal activiteiten", 756, activities.length);
check("Bibliotheek", "Aantal werelden (domeinen)", 22, vocab.domains.length);
check("Bibliotheek", "Aantal subdomeinen", 68, vocab.subs.length);
check("Bibliotheek", "Aantal tags", 43, vocab.tags.length);
check("Bibliotheek", "Aantal generieke tags", 7, vocab.tags.filter((t) => t.generic).length);
check("Bibliotheek", "Gecureerde combinaties", 80, readJson("src/lib/discovery/hybrids.json").length);
check("Bibliotheek", "Activiteiten op status concept", 756, activities.filter((a) => a.status === "concept").length);
check("Bibliotheek", "Activiteiten met reviewed_by", 0, activities.filter((a) => a.reviewed_by).length);
check("Bibliotheek", "Activiteiten met niveau 0", 636, activities.filter((a) => a.level === 0).length);
check("Bibliotheek", "Activiteiten zonder supply-waarde", 320, activities.filter((a) => a.supply === undefined).length);
check("Bibliotheek", "Activiteiten met seizoen", 143, activities.filter((a) => a.months).length);
check("Bibliotheek", "Activiteiten met verplicht toezicht (tier 2)", 58, activities.filter((a) => a.safety?.tier === 2).length);
check("Bibliotheek", "Kosten onbekend", 4, activities.filter((a) => a.cost === null).length);
check("Bibliotheek", "Intensiteit 0 (kalm)", 452, activities.filter((a) => a.intensity === 0).length);
check("Bibliotheek", "Wereld 'creative' telt", 133, activities.filter((a) => a.domain === "creative").length);
const cards = readJson("src/lib/discovery/associations.json");
check("Beelden", "Aantal beeldkaarten", 516, cards.length);
check("Beelden", "Aantal families", 172, new Set(cards.map((c) => c.family ?? c.id)).size);
for (const [round, n] of [["places", 177], ["moments", 174], ["senses", 165]]) check("Beelden", `Kaarten in ronde ${round}`, n, cards.filter((c) => c.round === round).length);
const clustersSrc = read("src/lib/discovery/clusters.ts");
const clusterBlock = clustersSrc.slice(clustersSrc.indexOf("export const CLUSTERS"), clustersSrc.indexOf("const CLUSTER_OF"));
check("Bibliotheek", "Aantal handmatige clusters", 14, (clusterBlock.match(/^\s{2}[a-z_]+:\s*ids\(/gm) || []).length);
check("Motor", "MAX_PER_CLUSTER", 2, num(clustersSrc, /MAX_PER_CLUSTER\s*=\s*(\d+)/));
const audienceSrc = read("src/lib/discovery/audience.ts");
const minor = audienceSrc.match(/MINOR_UNSUITABLE[^=]*=\s*new Set\(\[([\s\S]*?)\]\);/)[1];
check("Doelgroep", "Ids op de kind-lijst (MINOR_UNSUITABLE)", 33, (minor.match(/"[a-z0-9-]+"/g) || []).length);
check("Doelgroep", "CONFIDENCE_FLOOR", 0.3, num(audienceSrc, /CONFIDENCE_FLOOR\s*=\s*([\d.]+)/));

// ---- the pages
const tp = read("src/lib/discovery/twoPages.ts");
check("Pagina's", "IMAGES_PAGE_SIZE", 18, num(tp, /IMAGES_PAGE_SIZE\s*=\s*(\d+)/));
check("Pagina's", "CONCRETE_PAGE_SIZE", 18, num(tp, /CONCRETE_PAGE_SIZE\s*=\s*(\d+)/));
check("Pagina's", "MAX_IMAGE_PICKS", 8, num(tp, /MAX_IMAGE_PICKS\s*=\s*(\d+)/));
check("Pagina's", "MAX_CONCRETE_PICKS", 8, num(tp, /MAX_CONCRETE_PICKS\s*=\s*(\d+)/));
check("Pagina's", "MAX_REFRESHES", 3, num(tp, /MAX_REFRESHES\s*=\s*(\d+)/));
check("Pagina's", "EXPLORE_SLOTS", 3, num(tp, /EXPLORE_SLOTS\s*=\s*(\d+)/));
check("Pagina's", "MIN_PER_REGISTER", 2, num(tp, /MIN_PER_REGISTER\s*=\s*(\d+)/));
check("Pagina's", "GRACEFUL_MIN", 5, num(tp, /GRACEFUL_MIN\s*=\s*(\d+)/));
check("Pagina's", "NICHE_PER_PAGE", 2, num(tp, /NICHE_PER_PAGE\s*=\s*(\d+)/));
check("Pagina's", "ASSOC_WEIGHT (associatielaag)", 0.35, num(tp, /ASSOC_WEIGHT\s*=\s*([\d.]+)/));
check("Pagina's", "MIN_IMAGE_PICKS (simulatie)", 5, num(tp, /MIN_IMAGE_PICKS\s*=\s*(\d+)/));
check("Pagina's", "MIN_CONCRETE_PICKS (simulatie)", 3, num(tp, /MIN_CONCRETE_PICKS\s*=\s*(\d+)/));
const wiz = read("src/components/window/AssociationWizard.tsx");
check("Pagina's", "Minimum beelden in de wizard", 3, num(wiz, /MIN_IMAGES_REQUIRED\s*=\s*(\d+)/));
check("Pagina's", "Wizard laat 1 activiteit toe", true, /picks\.length\s*>=\s*1\s*\|\|\s*!!answers\.surpriseMe/.test(wiz));
check("Pagina's", "Wizard stuurt leeftijd en sociale vormen leeg", true, /socialFormats:\s*\[\],\s*ageCategory:\s*""/.test(wiz));
check("Pagina's", "Wizard bewaart alleen de chips als mustHaves", true, /const mustHaves = limitChips\.join\("; "\)/.test(wiz));

// ---- the engine
const graphSrc = read("src/lib/discovery/engine/graph.ts");
check("Motor", "BRIDGE_MIN", 2, num(graphSrc, /BRIDGE_MIN\s*=\s*([\d.]+)/));
const w = read("src/lib/discovery/engine/weights.ts");
const anchorBlock = w.slice(w.indexOf("export const WEIGHTS_ANCHOR"));
check("Motor", "WEIGHTS_ANCHOR: aantal ankers", 4, num(anchorBlock, /anchor:\s*\{\s*picks:\s*(\d+)/));
check("Motor", "WEIGHTS_ANCHOR: hub", 0.6, num(anchorBlock, /hub:\s*([\d.]+)/));
check("Motor", "WEIGHTS_V2: sharedPairPenalty", 0.45, num(w, /sharedPairPenalty:\s*([\d.]+),\s*\n\s*\/\/ Fase 3/));
check("Motor", "Aangrenzend: peak", 0.38, num(w, /adjacent:\s*\{[^}]*peak:\s*([\d.]+)/));
check("Motor", "Onverwacht: hybridBase", 2.5, num(w, /hybridBase:\s*([\d.]+)/));
check("Motor", "Familiar: pickedScore", 2, num(w, /pickedScore:\s*(\d+)/));
check("Motor", "Familiar: practicalBonus (V2)", 0.3, num(w.slice(w.indexOf("export const WEIGHTS_V2")), /practicalBonus:\s*([\d.]+)/));
check("Motor", "Wildcard: ageDecay", 2, num(w, /ageDecay:\s*([\d.]+)/));
check("Motor", "Wildcard: supplyDecay", 3, num(w, /supplyDecay:\s*([\d.]+)/));
check("Motor", "Wildcard: redundancyFactor", 4, num(w, /redundancyFactor:\s*([\d.]+)/));
check("Motor", "Aanbodstraf rare", 0.18, num(w, /supply:\s*\{\s*rare:\s*([\d.]+)/));
check("Motor", "Aanbodstraf regional", 0.04, num(w, /regional:\s*([\d.]+)\s*\}/));
check("Motor", "Stretch: doelen per wildheid", "1,1.2,2,2.8", (w.match(/targetByWildness:\s*\[([^\]]+)\]/)?.[1] ?? "").replace(/\s/g, ""));
const sel = read("src/lib/discovery/engine/select.ts");
check("Motor", "Niveau-toekenning: wildcard is niveau 7", true, /direction === "wildcard"\) out\.set\(s\.activityId, 7\)/.test(read("src/lib/discovery/engine/levels.ts")));
check("Motor", "Stretch alleen als nog geen 6 zaden of geen ankers", true, /if \(!anchored \|\| seeds\.length < 6\)/.test(sel));
const cons = read("src/lib/discovery/engine/constraints.ts");
check("Filters", "Tijd wordt niet gelezen in constraints.ts", false, /timeAvailable/.test(cons));

// ---- the research
const lr = read("src/lib/claude/localResearch.ts");
check("Zoeken", "MAX_OPTIONS", 3, num(lr, /MAX_OPTIONS\s*=\s*(\d+)/));
check("Zoeken", "MAX_SEARCHES", 5, num(lr, /MAX_SEARCHES\s*=\s*(\d+)/));
check("Zoeken", "MAX_PRIORITY_SEARCHES", 4, num(lr, /MAX_PRIORITY_SEARCHES\s*=\s*(\d+)/));
check("Zoeken", "MAX_BROAD_SEARCHES", 4, num(lr, /MAX_BROAD_SEARCHES\s*=\s*(\d+)/));
check("Zoeken", "FOUND_TTL_DAYS", 30, num(lr, /FOUND_TTL_DAYS\s*=\s*(\d+)/));
check("Zoeken", "EMPTY_TTL_DAYS", 7, num(lr, /EMPTY_TTL_DAYS\s*=\s*(\d+)/));
check("Zoeken", "PICK_EMPTY_TTL_DAYS", 2, num(lr, /PICK_EMPTY_TTL_DAYS\s*=\s*(\d+)/));
check("Zoeken", "PRIOR_SCORE", 4, num(lr, /PRIOR_SCORE\s*=\s*([\d.]+)/));
check("Zoeken", "PRIOR_WEIGHT", 20, num(lr, /PRIOR_WEIGHT\s*=\s*(\d+)/));
check("Zoeken", "Onderzoeksmodel", "claude-haiku-4-5-20251001", lr.match(/WINDOW_RESEARCH_MODEL \|\| "([^"]+)"/)?.[1]);
const gs = read("src/lib/claude/generateFromSeeds.ts");
check("Zoeken", "RESEARCH_BUDGET_MS", 120000, num(gs, /RESEARCH_BUDGET_MS\s*=\s*([\d_]+)/));
check("Zoeken", "SUPPLY_ROUNDS", 2, num(gs, /SUPPLY_ROUNDS\s*=\s*(\d+)/));
check("Schrijven", "max_tokens hoofdaanroep", 9000, num(gs, /max_tokens:\s*(9000)/));
check("Schrijven", "max_tokens lagen", 6000, num(gs, /max_tokens:\s*(6000)/));
check("Schrijven", "Schrijfmodel", "claude-sonnet-5", read("src/lib/anthropic.ts").match(/CLAUDE_MODEL\s*=\s*"([^"]+)"/)?.[1]);
check("Controle", "Websitecheck: maximale paginagrootte (bytes)", 150000, num(read("src/lib/claude/verifyUrls.ts"), /MAX_PAGE_BYTES\s*=\s*([\d_]+)/));

// ---- product and platform
check("Product", "Prijs in centen", 750, num(read("src/lib/pricing.ts"), /PRICE_CENTS\s*=\s*(\d+)/));
check("Platform", "maxDuration van /plan", 300, num(read("src/app/plan/page.tsx"), /export const maxDuration\s*=\s*(\d+)/));
check("Platform", "Aantal migraties", 24, readdirSync(path.join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).length);
check("Platform", "Cron: herinnering minimaal 2 dagen", 2, num(read("src/app/api/cron/first-action-reminder/route.ts"), /MIN_AGE_MS\s*=\s*(\d+)\s*\*/));
check("Platform", "Cron: herinnering maximaal 9 dagen", 9, num(read("src/app/api/cron/first-action-reminder/route.ts"), /MAX_AGE_MS\s*=\s*(\d+)\s*\*/));
check("Platform", "Cron: vervolgmail na 42 dagen", 42, num(read("src/app/api/cron/followup/route.ts"), /SIX_WEEKS_MS\s*=\s*(\d+)\s*\*/));
const vercel = readJson("vercel.json");
check("Platform", "Cron-schema's", "0 9 * * *,30 9 * * *", vercel.crons.map((c) => c.schedule).join(","));
const flags = read("src/lib/knowledgeFlags.ts");
check("Schakelaars", "Ankermodel standaard aan (leeg = aan)", true, /knowledgeAnchorEnabled[\s\S]*?if \(v === ""\) return true/.test(flags));
check("Schakelaars", "Associatielaag standaard uit", true, /knowledgeAssociationLayerEnabled\(value[^)]*\)[^{]*\{\s*return isOn/.test(flags));
check("Schakelaars", "Concrete opties standaard aan", true, /concreteOptionsRequired[\s\S]*?if \(v === ""\) return true/.test(flags));

// ---- the document itself
const content = ["content-1.mjs", "content-2.mjs", "content-3.mjs", "content-4.mjs", "content-5.mjs"].map((f) => readFileSync(path.join(here, f), "utf8")).join("\n");
const findingsSrc = readFileSync(path.join(here, "findings.mjs"), "utf8");
const defined = new Set([...findingsSrc.matchAll(/id: "(F-\d+)"/g)].map((m) => m[1]));
const referenced = new Set([...content.matchAll(/F-\d{2}/g)].map((m) => m[0]));
check("Document", "Elke genoemde bevinding (F-nn) bestaat in de lijst", "", [...referenced].filter((id) => !defined.has(id)).join(","));
check("Document", "Elke bevinding wordt in de tekst of lijst genoemd", "", [...defined].filter((id) => !referenced.has(id) && !new RegExp(id).test(content)).join(","));

// ---- figures against text: the same numbers and names in both
const { allFigures } = await import("./figures.mjs");
const figs = allFigures();
const svgText = (id) => [...figs[id].svg.toString().matchAll(/>([^<]+)</g)].map((m) => m[1]).join(" ").replace(/\s+/g, " ");
const inFig = (id, s) => svgText(id).includes(s);
const inText = (s) => content.includes(s);
const figChecks = [
  ["overview", "516 beelden", "516"], ["overview", "172 families", "172 families"], ["overview", "756 activiteiten", "756 in 22 werelden"], ["overview", "22 werelden", "22 werelden"],
  ["assoc", "516 beeldkaarten", "516"], ["assoc", "plekken 177, momenten 174, zintuigen 165", "plekken 177, momenten 174, zintuigen 165"], ["assoc", "22 werelden, 68 subdomeinen", "68 subdomeinen"], ["assoc", "3,6 tags", "gemiddeld 3,6"],
  ["taxonomy", "756 activiteiten in 22 werelden", "756 activiteiten in 22 werelden"],
  ["audience", "33 activiteiten", "33 activiteiten"], ["concrete", "hoogstens 150 km", "hoogstens 150 km"], ["concrete", "30 dagen", "30 dagen"], ["concrete", "2 dagen", "2 dagen"],
  ["slots", "80 beschikbaar", "80 gecureerde combinaties"], ["choices", "Minstens 3, hoogstens 8", "minstens 3 en hoogstens 8"], ["journey", "Kiest 1 tot 8", "1 tot 8"],
  ["windows7", "Vertrouwd", "Vertrouwd"], ["windows7", "Onontdekt", "Onontdekt"], ["distance", "niveau 6", "niveau 6"],
];
for (const [id, inF, inT] of figChecks) {
  check("Figuren", `Figuur '${id}' noemt '${inF}' en de tekst noemt '${inT}'`, "beide", inFig(id, inF) && inText(inT) ? "beide" : `figuur ${inFig(id, inF)}, tekst ${inText(inT)}`);
}
const taxSum = readJson("docs/whitepaper/src/facts/library.json").domains.reduce((s, d) => s + d.n, 0);
check("Figuren", "De tegels van de taxonomie tellen op tot het aantal activiteiten", 756, taxSum);
const sc = readJson("docs/whitepaper/src/facts/scenarios.json");
check("Figuren", "Voorbeeld A: wildcard in figuur 5 en tabel komt uit dezelfde run", true, sc[0].seeds.some((s) => s.direction === "wildcard" && inFig("windows7", s.activity)));
check("Figuren", "Elke niveau-naam in het zevenvensters-figuur staat ook in het afstandsmodel", true, ["Vertrouwd", "Praktisch", "Verwant", "Inspirerend", "Verrassend", "Uitdagend", "Onontdekt"].every((n) => inFig("windows7", n) && (inFig("distance", n) || inFig("overview", n))));
const placed = new Map();
for (const part of (await import("./model.mjs")).PARTS) (function w(bs) { for (const b of bs) { if (b.t === "fig") placed.set(b.id, (placed.get(b.id) ?? 0) + 1); if (b.blocks) w(b.blocks); } })(part.blocks);
check("Figuren", "Elke figuur staat precies één keer in het document", "", Object.keys(figs).filter((id) => placed.get(id) !== 1).join(","));

writeFileSync(path.join(here, "facts", "verification.json"), JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length} van ${results.length} controles kloppen`);
for (const f of failed) console.log(`  FOUT: ${f.area}: ${f.claim}: verwacht ${f.expected}, gevonden ${f.actual}`);
process.exit(failed.length ? 1 : 0);
