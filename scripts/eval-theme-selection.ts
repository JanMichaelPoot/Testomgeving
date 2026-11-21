// Measures how well the book follows the chosen themes and the profile (docs/plan-activiteitenselectie.md, C3). Free: no API calls.
//   npx tsx scripts/eval-theme-selection.ts <label> [profilesPerThemeSet]
// Writes docs/eval/<date>-theme-selection-<label>.md and .json, so a later change can be compared with this one (use the same label
// for the same state, another label for the next).
import { mkdirSync, writeFileSync } from "node:fs";
import { defaultEngineLibrary, selectSeeds, WEIGHTS_ANCHOR } from "../src/lib/discovery/engine";
import { relatedActivitiesIn } from "../src/lib/discovery/engine/related";
import { syntheticTwoPageProfiles } from "../src/lib/discovery/engine/syntheticTwoPages";
import { THEME_CARDS, activityAxes, themeProfilesFor } from "../src/lib/discovery/associations";
import { getActivities } from "../src/lib/discovery/library";
import { averageAxes, tagProfile } from "../src/lib/discovery/associationProfile";
import { composeConcretePage, registerMix, type ConcreteActivity } from "../src/lib/discovery/twoPages";
import { hashSeed, mulberry32, shuffled } from "../src/lib/discovery/rng";
import { themeCosine, themeRelative } from "../src/lib/discovery/themeFit";
import { registerOfActivity, registerOfCard } from "../src/lib/discovery/register";
import { kindOfActivity, modeOfActivity } from "../src/lib/discovery/activityKind";
import { pairVerdict } from "../src/lib/discovery/themePairs";

// Trying other weights without editing them: CHALLENGE=1.2 BALANCE_SELF=1.5 BALANCE_OFF=1 (the production set otherwise).
const WEIGHTS = {
  ...WEIGHTS_ANCHOR,
  balance: process.env.BALANCE_OFF ? { self: 0, organise: 0 } : { ...WEIGHTS_ANCHOR.balance, ...(process.env.BALANCE_SELF ? { self: Number(process.env.BALANCE_SELF) } : {}) },
  challenge: { ...WEIGHTS_ANCHOR.challenge, ...(process.env.CHALLENGE ? { bonus: Number(process.env.CHALLENGE) } : {}) },
  surprise: process.env.SURPRISE_OFF ? { adjacent: 0, unexpected: 0, stretch: 0, wildcard: 0 } : WEIGHTS_ANCHOR.surprise,
};
const label = process.argv[2] ?? "baseline";
const PER = Number(process.argv[3] ?? 12);
const lib = defaultEngineLibrary();
const byId = new Map(lib.activities.map((a) => [a.id, a]));
const generic = new Set(lib.tags.filter((t) => t.generic).map((t) => t.id));

const pool: ConcreteActivity[] = getActivities().map((a) => ({ id: a.id, domain: a.domain, sub: a.sub, register: registerOfActivity(a), tags: a.tags, axes: activityAxes(a) }));
const THEME_SETS: string[][] = [
  ["natuur", "techniek", "ambacht"],
  ["muziek", "techniek", "dieren"],
  ["geschiedenis", "sport", "eten"],
  ["wetenschap", "kunst-cultuur", "tuin"],
  ["podium", "water", "spel"],
  ["rust", "samen", "reizen", "beeld"],
  ["natuur", "wetenschap"],
  ["dieren", "zorg", "helpen", "natuur", "tuin"],
];

const tagCos = (x: string[], y: string[]) => {
  const a = new Set(x);
  const inter = y.filter((t) => a.has(t)).length;
  return inter / Math.sqrt(Math.max(1, x.length) * Math.max(1, y.length));
};
const lvl = (a: { level: number | null; intensity: number | null }) => (a.level ?? 0) + (a.intensity ?? 0) / 2;
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

const m = {
  books: 0,
  themeCoverage: [] as number[], // share of the chosen themes that have at least one idea that belongs to it (relative fit >= 0.5)
  fullCoverage: 0, // books where every chosen theme is covered
  bestFit: [] as number[], // mean over ideas of the best relative theme fit
  weakIdeas: 0, // ideas with no theme at >= 0.3
  ideas: 0,
  directions: [] as number[], // distinct dominant themes among the five ideas
  subs: [] as number[], // distinct subdomains among the five ideas
  nearVariant: 0, // books with a pair of ideas whose tags overlap 0.6 or more
  relatedPerIdea: [] as number[], // "also in this direction" per idea
  relatedOnTheme: [] as number[], // share of those that belong to the idea's dominant theme (>= 0.5)
  ideasWith3: 0, // ideas with at least 3 related activities (idea + 3 = an option with >= 3 activities)
  challenge: 0, // books with a more demanding idea than the person's picks
  unexpectedSurprising: 0, // books whose unexpected idea is surprise level 2 or 3
  wildcardSurprising: 0, // books whose wildcard is surprise level 2 or 3
  everydayIdeas: 0, // ideas that are not the person's own pick and are everyday (level 0)
  surpriseSum: 0, // sum of the surprise level of the ideas that are not the person's own picks
  foreignIdeas: 0, // those ideas
  combo: 0,
  comboWeak: 0,
  comboGood: 0, // combinations that are on the pair's hand-made list
  comboBad: 0, // combinations that are on the pair's own "bad" list (never allowed)
  comboUnlisted: 0, // combinations of a pair nobody made a list for // theme combinations whose weaker theme is under 0.6
  regionalOrRare: 0,
  optFull: 0, // options with two companions (an option of three)
  optOnTheme: [] as number[], // share of companions that belong to the option's theme (>= 0.5)
  optThemed: 0, // options that have a theme at all
  optNear: 0, // options with two activities that overlap 0.6 or more in tags
  optSameSub: 0, // options with two activities from one subdomain
  optKinds: [] as number[], // distinct kinds per option of three
  optDup: 0, // books where an activity occurs in two options
  optDirections: [] as number[], // distinct directions (theme sets) among the five options
  optCoverage: [] as number[], // share of chosen themes that any of the 15 activities belongs to
  optSelf: 0, // activities (of 15) that can be done by yourself
  optActs: 0,
  withSelf: 0, // books with at least one idea that can be done by yourself
  fewOrganise: 0, // books with at most two ideas that have to be organised first
  supervised: 0,
};

for (const ids of THEME_SETS) {
  const themes = themeProfilesFor(ids.map((id) => `theme-${id}-a`));
  const rels = themes.map((t) => themeRelative(t.weights, lib.activities, generic));
  const cardIds = ids.map((id) => `theme-${id}-a`);
  const slim = cardIds.map((cid) => THEME_CARDS.find((c) => c.id === cid)!).map((c) => ({ id: c.id, family: c.family, round: c.round, tagWeights: c.tagWeights, axes: c.axes, register: registerOfCard(c) }));
  const allThemes = THEME_CARDS.filter((c) => c.id.endsWith("-a")).map((c) => ({ id: `theme-${c.family!.replace(/^theme-/, "")}`, weights: c.tagWeights }));
  let k = 0;
  for (const p of syntheticTwoPageProfiles(PER, `ts-${ids.join("-")}`)) {
    // The person's own picks: what page 2 offers for these themes, three to five of them (as a real visitor would choose).
    const page = composeConcretePage(pool, { seed: `ev${k++}`, profile: tagProfile(slim, cardIds), axes: averageAxes(slim, cardIds), genericTags: generic, mix: registerMix(slim), themes, allThemes });
    const rnd = mulberry32(hashSeed(`pick-${ids.join("-")}-${k}`));
    const interests = shuffled(page.filter((x) => !x.explore).map((x) => x.activity.id), rnd).slice(0, 3 + (k % 3));
    const input = { ...p.input, themes, interests };
    const res = selectSeeds(input, lib, { weights: WEIGHTS });
    const acts = res.seeds.map((s) => byId.get(s.activityId)!).filter(Boolean);
    m.books++;
    m.ideas += acts.length;
    // Coverage and fit.
    const dominant = acts.map((a) => {
      const r = rels.map((f) => f(a.tags));
      const best = Math.max(...r);
      return { theme: themes[r.indexOf(best)].id, best };
    });
    const covered = themes.filter((t, i) => acts.some((a) => rels[i](a.tags) >= 0.5)).length;
    m.themeCoverage.push(covered / themes.length);
    if (covered === themes.length) m.fullCoverage++;
    m.bestFit.push(avg(dominant.map((d) => d.best)));
    m.weakIdeas += dominant.filter((d) => d.best < 0.3).length;
    m.directions.push(new Set(dominant.map((d) => d.theme)).size);
    m.subs.push(new Set(acts.map((a) => `${a.domain}/${a.sub}`)).size);
    let near = false;
    for (let i = 0; i < acts.length; i++) for (let j = i + 1; j < acts.length; j++) if (tagCos(acts[i].tags, acts[j].tags) >= 0.6) near = true;
    if (near) m.nearVariant++;
    // Related activities per idea (what "an option with three activities" would have to lean on today).
    const exclude = new Set(res.seeds.map((s) => s.activityId));
    acts.forEach((a, i) => {
      const rel = relatedActivitiesIn(lib, a.id, res.constraints, exclude, 3);
      m.relatedPerIdea.push(rel.length);
      if (rel.length >= 3) m.ideasWith3++;
      const ti = themes.findIndex((t) => t.id === dominant[i].theme);
      if (rel.length) m.relatedOnTheme.push(rel.filter((r) => rels[ti](r.tags) >= 0.5).length / rel.length);
      rel.forEach((r) => exclude.add(r.id));
    });
    const modes = acts.map((a) => modeOfActivity(a));
    if (modes.includes("self")) m.withSelf++;
    if (modes.filter((x) => x === "organise").length <= 2) m.fewOrganise++;
    // Options (R1): the idea and its two companions.
    const seen = new Set<string>();
    let dup = false;
    const dirs = new Set<string>();
    const all15: typeof acts = [];
    res.seeds.forEach((sd, i) => {
      const op = sd.option;
      if (!op) return;
      const group = [acts[i], ...op.companions.map((id) => byId.get(id)!).filter(Boolean)];
      if (op.companions.length === 2) m.optFull++;
      for (const a of group) {
        if (seen.has(a.id)) dup = true;
        seen.add(a.id);
        all15.push(a);
        m.optActs++;
        if (modeOfActivity(a) === "self") m.optSelf++;
      }
      if (op.themes.length) {
        m.optThemed++;
        const ti = op.themes.map((id) => themes.findIndex((t) => t.id === id));
        const comps = group.slice(1);
        if (comps.length) m.optOnTheme.push(comps.filter((c) => ti.some((k) => rels[k](c.tags) >= 0.5)).length / comps.length);
      }
      dirs.add(op.themes.join("+") || `none-${i}`);
      let near = false;
      for (let x = 0; x < group.length; x++) for (let y = x + 1; y < group.length; y++) if (tagCos(group[x].tags, group[y].tags) >= 0.6) near = true;
      if (near) m.optNear++;
      if (new Set(group.map((a) => a.sub)).size < group.length) m.optSameSub++;
      m.optKinds.push(new Set(group.map((a) => kindOfActivity(a))).size);
    });
    if (dup) m.optDup++;
    m.optDirections.push(dirs.size);
    m.optCoverage.push(themes.filter((t, i) => all15.some((a) => rels[i](a.tags) >= 0.5)).length / themes.length);
    // Challenge, combinations, practicality.
    const picks = input.interests.map((i) => byId.get(i)).filter(<T,>(x: T | undefined): x is T => !!x);
    const top = Math.max(0, ...picks.map(lvl));
    if (res.seeds.some((s, i) => s.direction === "stretch" || (!input.interests.includes(s.activityId) && lvl(acts[i]) > top))) m.challenge++;
    res.seeds.forEach((s, i) => {
      const own = input.interests.includes(s.activityId);
      if (!own) {
        m.foreignIdeas++;
        m.surpriseSum += s.surprise ?? 0;
        if ((s.surprise ?? 0) === 0) m.everydayIdeas++;
      }
      if (s.direction === "unexpected" && (s.surprise ?? 0) >= 2) m.unexpectedSurprising++;
      if (s.direction === "wildcard" && (s.surprise ?? 0) >= 2) m.wildcardSurprising++;
      if (s.themeCombo) {
        m.combo++;
        const verdict = pairVerdict(s.themeCombo[0], s.themeCombo[1]);
        if (!verdict) m.comboUnlisted++;
        else if (verdict.good.has(acts[i].id)) m.comboGood++;
        if (verdict?.bad.has(acts[i].id)) m.comboBad++;
        const [x, y] = s.themeCombo.map((id) => themes.findIndex((t) => t.id === id));
        if (!verdict?.good.has(acts[i].id) && Math.min(rels[x](acts[i].tags), rels[y](acts[i].tags)) < 0.6) m.comboWeak++;
      }
      if (acts[i].supply === "regional" || acts[i].supply === "rare") m.regionalOrRare++;
      if (acts[i].safety.tier === 2) m.supervised++;
    });
  }
}

void themeCosine;
void registerOfActivity;

const rows: [string, string][] = [
  ["Boeken gemeten", String(m.books)],
  ["Gekozen thema's gedekt door een idee (gemiddeld)", pct(avg(m.themeCoverage))],
  ["Boeken waarin elk gekozen thema een idee heeft", pct(m.fullCoverage / m.books)],
  ["Beste themafit per idee (gemiddeld, 0 tot 1)", avg(m.bestFit).toFixed(2)],
  ["Ideeën zonder echt thema (fit onder 0,3)", pct(m.weakIdeas / m.ideas)],
  ["Verschillende richtingen (dominant thema) per boek van vijf", avg(m.directions).toFixed(2)],
  ["Verschillende subdomeinen per boek", avg(m.subs).toFixed(2)],
  ["Boeken met twee bijna gelijke ideeën (tagoverlap 0,6 of meer)", pct(m.nearVariant / m.books)],
  ["'Ook in deze richting' per idee (gemiddeld, max. 3)", avg(m.relatedPerIdea).toFixed(2)],
  ["Ideeën met drie verwante activiteiten (dus een optie van minimaal drie)", pct(m.ideasWith3 / m.ideas)],
  ["Van die verwante activiteiten: past bij het thema van het idee", pct(avg(m.relatedOnTheme))],
  ["Boeken met een uitdagender idee dan de eigen keuzes", pct(m.challenge / m.books)],
  ["Boeken waarvan het onverwachte idee verrassingsniveau 2 of 3 heeft (ongewoon of opvallend)", pct(m.unexpectedSurprising / m.books)],
  ["Boeken waarvan de wildcard verrassingsniveau 2 of 3 heeft", pct(m.wildcardSurprising / m.books)],
  ["Ideeën buiten de eigen keuzes die alledaags zijn (niveau 0)", pct(m.everydayIdeas / m.foreignIdeas)],
  ["Gemiddeld verrassingsniveau van de ideeën buiten de eigen keuzes (0 tot 3)", (m.surpriseSum / m.foreignIdeas).toFixed(2)],
  ["Onverwachte deuren uit twee thema's", `${m.combo} (${pct(m.combo / m.books)} van de boeken)`],
  ["Daarvan op de handgemaakte lijst van het paar", m.combo ? pct(m.comboGood / m.combo) : "-"],
  ["Daarvan op de 'slecht'-lijst van het paar (moet 0 zijn)", String(m.comboBad)],
  ["Daarvan van een paar zonder lijst", m.combo ? pct(m.comboUnlisted / m.combo) : "-"],
  ["Daarvan zwak en niet handgemaakt (zwakste thema onder 0,6)", m.combo ? pct(m.comboWeak / m.combo) : "-"],
  ["Ideeën met regionaal of zeldzaam aanbod", pct(m.regionalOrRare / m.ideas)],
  ["Ideeën onder gekwalificeerd toezicht", pct(m.supervised / m.ideas)],
  ["Opties met twee metgezellen (een optie van drie)", pct(m.optFull / m.ideas)],
  ["Opties met een thema als richting", pct(m.optThemed / m.ideas)],
  ["Metgezellen die bij het thema van hun optie passen", pct(avg(m.optOnTheme))],
  ["Verschillende richtingen per boek van vijf opties", avg(m.optDirections).toFixed(2)],
  ["Gekozen thema's gedekt door de 15 activiteiten (gemiddeld)", pct(avg(m.optCoverage))],
  ["Opties met twee bijna gelijke activiteiten (tagoverlap 0,6 of meer)", pct(m.optNear / m.ideas)],
  ["Opties met twee activiteiten uit één subdomein", pct(m.optSameSub / m.ideas)],
  ["Verschillende soorten per optie van drie (max. 3)", avg(m.optKinds).toFixed(2)],
  ["Boeken waarin een activiteit in twee opties staat", pct(m.optDup / m.books)],
  ["Boeken met minstens één idee dat je zelf kunt doen", pct(m.withSelf / m.books)],
  ["Boeken met hoogstens twee ideeën die eerst georganiseerd moeten worden", pct(m.fewOrganise / m.books)],
  ["Van de 15 activiteiten: zelf te doen", pct(m.optSelf / m.optActs)],
];

const date = new Date().toISOString().slice(0, 10);
mkdirSync("docs/eval", { recursive: true });
const base = `docs/eval/${date}-theme-selection-${label}`;
writeFileSync(`${base}.json`, JSON.stringify(Object.fromEntries(rows), null, 2));
writeFileSync(
  `${base}.md`,
  `# Themaselectie, meting "${label}" (${date})\n\n${THEME_SETS.length} themasets x ${PER} synthetische profielen, productiegewichten (WEIGHTS_ANCHOR). Gratis, geen API.\n\n| Maat | Waarde |\n|---|---|\n${rows.map(([k, v]) => `| ${k} | ${v} |`).join("\n")}\n`,
);
console.log(rows.map(([k, v]) => `${k.padEnd(74)} ${v}`).join("\n"));
