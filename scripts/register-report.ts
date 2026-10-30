// Writes docs/register-rapport.md: how the 496 activities and the 216 association cards (72 families) divide over
// the four style registers, how the pool compares with the plan for two image pages, and which themes are thin.
//
//   npx tsx scripts/register-report.ts           write docs/register-rapport.md
//   npx tsx scripts/register-report.ts --print   print it instead
//
// Deterministic: the same library gives the same file. No API calls, no cost.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { ALL_ACTIVITIES, ALL_DOMAINS, isImagePending } from "../src/lib/discovery/library";
import { ASSOCIATIONS, hasOwnImage } from "../src/lib/discovery/associations";
import {
  REGISTERS,
  familyOf,
  REGISTER_LABELS,
  countRegisters,
  deriveRegister,
  poolShortfall,
  registerOfActivity,
  registerOfCard,
  type Register,
  type RegisterCounts,
} from "../src/lib/discovery/register";

const live = ALL_ACTIVITIES.filter((a) => a.status !== "retired");
const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "-");
const row = (cells: (string | number)[]) => `| ${cells.join(" | ")} |`;
const header = (cells: string[]) => `${row(cells)}\n${row(cells.map(() => "---"))}`;
const label = (r: Register) => REGISTER_LABELS[r].nl;

// --- activities -------------------------------------------------------------------------------------------------
const actRegisters = live.map((a) => registerOfActivity(a));
const actCounts = countRegisters(actRegisters);

// --- association cards: one register per family, so count families and cards ------------------------------------
const families = new Map<string, { round: string; label: string; register: Register; axes: Record<string, number>; tags: Record<string, number> }>();
for (const c of ASSOCIATIONS) {
  if (!families.has(familyOf(c))) families.set(familyOf(c), { round: c.round, label: c.label.nl, register: registerOfCard(c), axes: c.axes as unknown as Record<string, number>, tags: c.tagWeights });
}
const famList = [...families.entries()];
const famCounts = countRegisters(famList.map(([, f]) => f.register));
const cardCounts = countRegisters(ASSOCIATIONS.map((c) => registerOfCard(c)));

// --- themes the plan names; matched by hand for the cards, by label for the activities --------------------------
const THEMES: { id: string; label: string; activity: RegExp; families: string[] }[] = [
  { id: "dance", label: "Dans", activity: /\bdans|ballet|flamenco|salsa|swing|ballroom|paaldans|rolschaatsdisco/i, families: ["moment-rhythm", "place-dance-studio", "moment-first-dance", "place-ballroom", "sense-ballet-shoes"] },
  { id: "stage", label: "Opera, theater, podium", activity: /opera|musical|theater|toneel|cabaret|variét|podium|circus/i, families: ["place-stage-lit", "moment-applause", "moment-curtain-rise", "sense-spotlight", "place-dressing-room", "sense-strings"] },
  { id: "dolls", label: "Poppen, miniaturen, speeldozen", activity: /\bpop(pen|penhuis|pentheater)?\b|miniatuur|miniaturen|speeldoz|diorama/i, families: ["place-miniature-world", "sense-music-box", "sense-fine-brush"] },
  { id: "jewelry", label: "Sieraden en edelstenen", activity: /sieraad|sieraden|juweel|edelsteen|kralen|goud|zilver|mineralen|emailleren/i, families: ["moment-gem-sparkle", "place-jeweller", "moment-clasp", "sense-facets"] },
  { id: "bags", label: "Tassen en leer", activity: /\btas(sen)?\b|handtas|portemonnee|lederwerk/i, families: ["place-shop-window", "sense-leather-bag"] },
  { id: "makeup", label: "Make-up, kapsel, nagels", activity: /make-up|schmink|nagel|kapsel|beauty/i, families: ["sense-powder-brush", "moment-braid"] },
  { id: "fashion", label: "Mode, kleding, stoffen", activity: /\bmode|kleding|naaien|kostuum|hoeden|schoenen|patroon|vintage|quilt|stoffen|breien|haken/i, families: ["place-fabric-atelier", "sense-silk-velvet", "moment-first-stitch", "moment-fitting", "place-wardrobe", "sense-long-dress", "moment-mirror-evening"] },
  { id: "flowers", label: "Bloemen en boeketten", activity: /bloem|pluktuin|boeket|open tuinen/i, families: ["place-flower-shop", "moment-pick-bouquet", "place-peony-garden", "sense-peonies"] },
  { id: "perfume", label: "Parfum en geur", activity: /parfum|geur|zeep maken/i, families: ["sense-perfume"] },
  { id: "salon", label: "Thee, salon, antiek", activity: /\bthee|high tea|salon|antiek|brocante/i, families: ["place-antique-parlour", "place-flea-market", "place-tea-salon", "moment-tea-pour"] },
  { id: "wellness", label: "Spa en wellness", activity: /\bspa|wellness|massage|hammam|sauna|thermen/i, families: ["place-steam-room", "sense-warm-steam", "place-bathhouse", "sense-lavender"] },
];

// --- how well the tags alone predict the hand-made register ------------------------------------------------------
const actAgree = live.filter((a) => deriveRegister(a.tags) === registerOfActivity(a)).length;
const famAgree = famList.filter(([, f]) => deriveRegister(f.tags) === f.register).length;

// --- the plan's balance test: 18 per page, three refreshes, at least 3 of every register per batch -----------------
const FAM_OPTS = { batchSize: 18, batches: 3, minPerRegister: 3 };
const famShort = poolShortfall(famCounts, FAM_OPTS);
const actShort = poolShortfall(actCounts, FAM_OPTS);

const lines: string[] = [];
const out = (s = "") => lines.push(s);

out("# Stijlregister: meting van de pool (Fase 0 en 1)");
out();
out("Gegenereerd door `scripts/register-report.ts`. Niet met de hand aanpassen: pas `src/lib/discovery/register.json` aan en draai `npm run register:report`.");
out();
out("**Wat dit is.** Elke activiteit en elke associatiefamilie heeft één van vier registers: *sierlijk en expressief*, *warm en verzorgend*, *technisch en scherp*, *rust en natuur*. Het register beschrijft het item, niet de persoon; er wordt geen geslacht gevraagd of bewaard, en het register komt nergens in de interface of in analytics-tekst. Het dient alleen om de eerste beeldpagina gebalanceerd te maken en de tweede pagina uit de eerste samen te stellen (zie `docs/plan-twee-beeldpagina-s.md`).");
out();
out("**Hoe het register is vastgesteld.** Met de hand, per item, door één lezer (de assistent) op basis van naam, tags en subgroep; het is een eerste inschatting die jij kunt corrigeren, geen meting van wat mensen zeggen. Items waarbij ik twijfelde (bv. aardewerk, verzamelen, schrijven) staan op één kant gezet; dit is een keuze, geen feit.");
out();

out("## 1. Totaal");
out();
out(header(["Register", "Activiteiten", "Aandeel", "Families (72)", "Aandeel", "Kaarten (216)"]));
for (const r of REGISTERS) out(row([label(r), actCounts[r], pct(actCounts[r], live.length), famCounts[r], pct(famCounts[r], families.size), cardCounts[r]]));
out(row(["**Totaal**", live.length, "100%", families.size, "100%", ASSOCIATIONS.length]));
out();
const hiddenActs = live.filter((a) => isImagePending(a)).length;
const hiddenCards = ASSOCIATIONS.filter((c) => !hasOwnImage(c)).length;
out(`Hiervan wachten **${hiddenActs} activiteiten** (${live.length - hiddenActs} zichtbaar) en **${hiddenCards} kaarten** (${ASSOCIATIONS.length - hiddenCards} zichtbaar) nog op hun foto en zijn dus nog niet te zien voor bezoekers; het register telt ze wel mee.`);
out();

out("## 2. Activiteiten per richting");
out();
out(header(["Richting", "Totaal", ...REGISTERS.map(label)]));
for (const d of ALL_DOMAINS) {
  const items = live.filter((a) => a.domain === d.id);
  const c = countRegisters(items.map((a) => registerOfActivity(a)));
  out(row([d.label.nl, items.length, ...REGISTERS.map((r) => (c[r] ? `${c[r]} (${pct(c[r], items.length)})` : "0"))]));
}
out();

out("## 3. Associatiefamilies per ronde");
out();
out(header(["Ronde", "Families", ...REGISTERS.map(label)]));
for (const round of ["places", "moments", "senses"]) {
  const items = famList.filter(([, f]) => f.round === round);
  const c = countRegisters(items.map(([, f]) => f.register));
  out(row([round, items.length, ...REGISTERS.map((r) => c[r])]));
}
out();

out("## 4. Wat een register op de vier assen betekent");
out();
out("Gemiddelde van de families (sociaal: -1 alleen, +1 samen · energie: -1 rustig, +1 heftig · plek: -1 binnen, +1 buiten · nieuwheid: -1 vertrouwd, +1 nieuw). Een balans op register is dus ook voor een deel een balans op deze assen; als een register ver van 0 ligt, trekt een eenzijdige keuze de assen mee.");
out();
out(header(["Register", "Sociaal", "Energie", "Binnen/buiten", "Nieuwheid"]));
for (const r of REGISTERS) {
  const items = famList.filter(([, f]) => f.register === r);
  const avg = (k: string) => (items.length ? (items.reduce((s, [, f]) => s + (f.axes[k] ?? 0), 0) / items.length).toFixed(2) : "-");
  out(row([label(r), avg("social"), avg("energy"), avg("setting"), avg("novelty")]));
}
out();

out("## 5. Dekking van de thema's uit het plan");
out();
out("Het register zegt hoe breed het aanbod is; deze tabel zegt of de **onderwerpen die je noemde** er zijn. Activiteiten zijn op naam gevonden, families met de hand toegewezen.");
out();
out(header(["Thema", "Activiteiten", "Families", "Voorbeelden"]));
for (const t of THEMES) {
  const acts = live.filter((a) => t.activity.test(a.label.nl) || t.activity.test(a.id));
  out(row([t.label, acts.length, t.families.length, acts.slice(0, 4).map((a) => a.label.nl).join("; ") || "(geen)"]));
}
out();
const emptyThemes = THEMES.filter((t) => t.families.length === 0).map((t) => t.label);
out(`Thema's zonder één associatiefamilie: **${emptyThemes.join(", ") || "geen"}**.`);
out();

out("## 6. Balanstest voor het plan (18 per pagina, drie keer verversen)");
out();
out(`Eis: 3 batches van 18 afzonderlijke items, in elke batch minstens ${FAM_OPTS.minPerRegister} van elk register (dus minstens ${FAM_OPTS.minPerRegister * FAM_OPTS.batches} per register in de pool).`);
out();
out(header(["Pool", "Past?", "Tekort"]));
const fmtShort = (s: Partial<RegisterCounts>) => (Object.keys(s).length ? REGISTERS.filter((r) => s[r]).map((r) => `${label(r)} ${s[r]}`).join(", ") : "-");
out(row(["Associatiefamilies (pagina 1)", Object.keys(famShort).length ? "nee" : "ja", fmtShort(famShort)]));
out(row(["Activiteiten (pagina 2)", Object.keys(actShort).length ? "nee" : "ja", fmtShort(actShort)]));
out();
out("Let op: pagina 1 toont **kaarten**, niet families (elke familie heeft drie varianten), en laat per set één variant per familie zien. Dat de families in aantal volstaan zegt dus niets over de **thematische** diepte; zie sectie 5.");
out();

out("## 7. Hoe goed voorspellen de bestaande tags het register?");
out();
out(`Alleen op tags (zonder de handmatige tabel) zou ${actAgree} van ${live.length} activiteiten (${pct(actAgree, live.length)}) en ${famAgree} van ${families.size} families (${pct(famAgree, families.size)}) hetzelfde register krijgen. De rest is nodig als handmatige uitzondering, vooral voor sierlijk en verzorgend: de huidige tags (er is geen tag voor mode, dans, sieraden of schoonheid) kunnen die kant niet zelf uitdrukken. Daarom staat het register in een eigen tabel en is \`deriveRegister\` alleen een vangnet.`);
out();

const text = lines.join("\n") + "\n";
if (process.argv.includes("--print")) console.log(text);
else {
  const file = path.join(process.cwd(), "docs", "register-rapport.md");
  writeFileSync(file, text);
  console.log(`wrote ${file}`);
}
