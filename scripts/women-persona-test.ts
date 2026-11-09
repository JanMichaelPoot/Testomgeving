// Free, deterministic persona test: does the two-page intake + engine serve tastes and situations that are common among women,
// without the app ever asking for gender? A "persona" is a TASTE (tags, domains) plus a situation (age, budget, social form, must-haves);
// it is not a claim that all women (or only women) have it. Two personas deliberately go against the stereotype (racing, shooting)
// to check the app does not box anyone in. No API call, no cost.
//   npx tsx scripts/women-persona-test.ts [sessionsPerPersona]
import { ASSOCIATIONS, activityAxes, associationsToEngineInput, hasOwnImage } from "../src/lib/discovery/associations";
import { TAGS, getActivities, getActivity } from "../src/lib/discovery/library";
import { inSeason } from "../src/lib/discovery/season";
import { averageAxes, tagProfile } from "../src/lib/discovery/associationProfile";
import { registerOfActivity, registerOfCard } from "../src/lib/discovery/register";
import { REGISTERS, countRegisters } from "../src/lib/discovery/registerTypes";
import { MAX_REFRESHES, MIN_CONCRETE_PICKS, MIN_IMAGE_PICKS, composeConcretePage, registerMix, sampleBalancedBatch, type ConcreteActivity, type RegisteredCard } from "../src/lib/discovery/twoPages";
import { effortForPicks } from "../src/lib/discovery/imageIntake";
import { runEngine } from "../src/lib/discovery/engine";
import { WEIGHTS_ANCHOR } from "../src/lib/discovery/engine/weights";
import { MINOR_UNSUITABLE } from "../src/lib/discovery/audience";

const N = Number(process.argv[2] ?? 60);

interface Persona {
  id: string;
  label: string;
  stereotype: boolean; // true = a taste often coded female; false = deliberately against the stereotype
  tags: string[]; // what she likes (non-generic tags)
  domains: string[];
  age: string;
  budget: string;
  time: string;
  social: string[];
  mustHaves: string;
  searchContext?: string;
}

const PERSONAS: Persona[] = [
  { id: "creatief-stijl", label: "Creatief en stijl (28)", stereotype: true, tags: ["style", "color", "craft", "making", "miniature"], domains: ["style", "creative"], age: "25-34", budget: "50", time: "halfday", social: [], mustHaves: "" },
  { id: "welzijn-rust", label: "Welzijn en rust (42)", stereotype: true, tags: ["stillness", "balance", "caring", "growing"], domains: ["restful", "nature"], age: "35-44", budget: "100", time: "halfday", social: ["solo", "duo"], mustHaves: "" },
  { id: "samen-lekker", label: "Gezellig en lekker (35)", stereotype: true, tags: ["conviviality", "food", "play"], domains: ["together", "food"], age: "35-44", budget: "50", time: "fullday", social: ["small_group", "with_known"], mustHaves: "" },
  { id: "dans-podium", label: "Dans en podium (30)", stereotype: true, tags: ["rhythm", "performance", "movement", "sound"], domains: ["stage", "movement"], age: "25-34", budget: "50", time: "halfday", social: [], mustHaves: "" },
  { id: "dieren-natuur", label: "Dieren en natuur (50)", stereotype: true, tags: ["animals", "nature", "outdoors", "growing"], domains: ["nature"], age: "45-54", budget: "50", time: "fullday", social: [], mustHaves: "" },
  { id: "leren-schrijven", label: "Leren en schrijven (55)", stereotype: true, tags: ["language", "story", "learning", "history"], domains: ["growth", "history"], age: "55-64", budget: "100", time: "halfday", social: [], mustHaves: "" },
  { id: "moeder", label: "Moeder, samen met kinderen (38)", stereotype: true, tags: ["caring", "play", "making", "outdoors"], domains: ["together", "creative", "nature"], age: "35-44", budget: "25", time: "halfday", social: ["small_group"], mustHaves: "Kinderen" },
  { id: "oudere", label: "Gepensioneerd, rustig tempo (68)", stereotype: true, tags: ["growing", "history", "stillness", "conviviality"], domains: ["nature", "history", "together"], age: "65plus", budget: "50", time: "halfday", social: ["drop_in_alone", "duo"], mustHaves: "Geen drukte, zonder auto bereikbaar" },
  { id: "alleen-avond", label: "Alleen, 's avonds, zonder auto (31)", stereotype: true, tags: ["learning", "making", "performance", "sound"], domains: ["creative", "stage", "night"], age: "25-34", budget: "50", time: "hour", social: ["solo", "drop_in_alone"], mustHaves: "'s avonds, zonder auto bereikbaar" },
  { id: "racen-techniek", label: "Tegen het stereotype: racen en techniek (33)", stereotype: false, tags: ["speed", "technique", "competition", "precision"], domains: ["speed", "tech"], age: "25-34", budget: "100", time: "halfday", social: [], mustHaves: "" },
  { id: "schieten-avontuur", label: "Tegen het stereotype: schieten en avontuur (40)", stereotype: false, tags: ["precision", "challenge", "height", "suspense"], domains: ["target", "adventure"], age: "35-44", budget: "100", time: "fullday", social: [], mustHaves: "" },
];

const cards: RegisteredCard[] = ASSOCIATIONS.filter(hasOwnImage).map((c) => ({ id: c.id, family: c.family, round: c.round, tagWeights: c.tagWeights, axes: c.axes, register: registerOfCard(c) }));
const all = getActivities();
const generic = new Set(TAGS.filter((t) => t.generic).map((t) => t.id));
const pool = (m: number): ConcreteActivity[] => all.filter((a) => inSeason(a, m)).map((a) => ({ id: a.id, domain: a.domain, sub: a.sub, register: registerOfActivity(a), tags: a.tags, axes: activityAxes(a) }));
const pools = new Map(Array.from({ length: 12 }, (_, m) => [m + 1, pool(m + 1)] as const));
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const f1 = (x: number) => x.toFixed(1);

/** How well a card speaks to a persona: the summed weight of the persona's tags on it. */
const cardScore = (c: RegisteredCard, p: Persona) => p.tags.reduce((s, t) => s + (c.tagWeights[t] ?? 0), 0);
const cardHit = (c: RegisteredCard, p: Persona) => cardScore(c, p) >= 0.6;
/** An activity is "in her taste" when she would recognise it: a non-generic tag of hers, or in one of her domains. */
const actHit = (a: { tags: readonly string[]; domain: string }, p: Persona) => a.tags.some((t) => p.tags.includes(t) && !generic.has(t)) || p.domains.includes(a.domain);

interface Row {
  p1Hits: number[]; p1Hits4: number[]; p1Ok: number; p1OkRefresh: number;
  p2Hits: number[]; p2Ok: number; p2Regs: number[]; p2Outside: number[];
  bookHit: number[]; ownInBook: number[]; worlds: number[]; failed: number; verifyEvening: number; outdoorShare: number[]; soloOk: number[]; noOwnPicks: number;
  topActs: Map<string, number>; kidsRisk: number; kidsTier2: number;
}

const results = new Map<string, Row>();
for (const p of PERSONAS) {
  const row: Row = { p1Hits: [], p1Hits4: [], p1Ok: 0, p1OkRefresh: 0, p2Hits: [], p2Ok: 0, p2Regs: [], p2Outside: [], bookHit: [], ownInBook: [], worlds: [], failed: 0, verifyEvening: 0, outdoorShare: [], soloOk: [], noOwnPicks: 0, topActs: new Map(), kidsRisk: 0, kidsTier2: 0 };
  for (let i = 0; i < N; i++) {
    const sid = `w-${p.id}-${i}`;
    const month = (i % 12) + 1;
    // Page 1: first set of 18, and what she could reach after up to three "Andere beelden".
    const seen: string[] = [];
    const sets: RegisteredCard[][] = [];
    for (let r = 0; r <= MAX_REFRESHES; r++) {
      const b = sampleBalancedBatch(cards, { seed: sid, refresh: r, exclude: seen });
      sets.push(b);
      seen.push(...b.map((c) => c.id));
    }
    const first = sets[0].filter((c) => cardHit(c, p));
    row.p1Hits.push(first.length);
    const reach = sets.flat().filter((c) => cardHit(c, p));
    row.p1Hits4.push(reach.length);
    if (first.length >= MIN_IMAGE_PICKS) row.p1Ok++;
    if (reach.length >= MIN_IMAGE_PICKS) row.p1OkRefresh++;
    // She picks the best-fitting images she was offered (up to 6); with fewer hits she fills up with the rest of the first set, like a real person has to.
    const ranked = [...sets[0]].sort((a, b) => cardScore(b, p) - cardScore(a, p));
    const picks = ranked.slice(0, Math.max(MIN_IMAGE_PICKS, Math.min(6, first.length)));
    const ids = picks.map((c) => c.id);
    const mix = registerMix(picks);
    const pg = pools.get(month)!;
    const slots = composeConcretePage(pg, { seed: sid, profile: tagProfile(cards, ids), axes: averageAxes(cards, ids), genericTags: generic, mix });
    const hits = slots.filter((s) => actHit(s.activity, p));
    row.p2Hits.push(hits.length);
    if (hits.length >= MIN_CONCRETE_PICKS) row.p2Ok++;
    const c2 = countRegisters(slots.map((s) => s.activity.register));
    const dominant = mix.dominant;
    row.p2Regs.push(dominant ? c2[dominant] : 0);
    row.p2Outside.push(slots.filter((s) => !actHit(s.activity, p)).length / slots.length);
    // Page 2 picks: her best hits (3-5).
    const concretePicks = hits.slice(0, Math.min(5, hits.length)).map((s) => s.activity.id);
    if (concretePicks.length < MIN_CONCRETE_PICKS) { row.noOwnPicks++; }
    const picksForEngine = concretePicks.length ? concretePicks : slots.slice(0, 3).map((s) => s.activity.id);
    const derived = associationsToEngineInput({
      associationIds: ids, interestDomains: [], explicitInterests: picksForEngine,
      constraints: { budget: p.budget, timeAvailable: p.time, mustHaves: p.mustHaves, socialFormats: p.social, ageCategory: p.age, ...(p.searchContext ? { searchContext: p.searchContext } : {}) },
      seed: sid, month,
    });
    const res = runEngine({
      interests: derived.interests,
      interestDomains: [...new Set(derived.interests.map((id) => getActivity(id)?.domain).filter((d): d is string => !!d))],
      socialFormats: p.social, practicalToWild: derived.practicalToWild, budget: p.budget,
      effort: effortForPicks(derived.effort, derived.interests, false), timeAvailable: p.time, ageCategory: p.age, mustHaves: p.mustHaves,
      history: [], seed: sid, month, explicitPicks: true,
    }, { weights: WEIGHTS_ANCHOR }); // what production uses (anchor model, on by default since Step 126)
    if (res.seeds.length < 7) row.failed++;
    const acts = res.seeds.map((s) => getActivity(s.activityId)!).filter(Boolean);
    row.bookHit.push(acts.filter((a) => actHit(a, p)).length);
    row.ownInBook.push(res.seeds.filter((s) => picksForEngine.includes(s.activityId)).length / Math.max(1, picksForEngine.length));
    row.worlds.push(new Set(acts.map((a) => a.domain)).size);
    row.outdoorShare.push(acts.filter((a) => a.setting === "outdoor").length / Math.max(1, acts.length));
    if (res.seeds.some((s) => s.verify.includes("evening"))) row.verifyEvening++;
    if (p.social.includes("solo")) row.soloOk.push(acts.filter((a) => (a.formats ?? []).some((f) => p.social.includes(f))).length / Math.max(1, acts.length));
    if (acts.some((a) => MINOR_UNSUITABLE.has(a.id))) row.kidsRisk++;
    if (acts.some((a) => a.safety.tier === 2)) row.kidsTier2++;
    for (const a of acts) row.topActs.set(a.id, (row.topActs.get(a.id) ?? 0) + 1);
  }
  results.set(p.id, row);
}

console.log(`# Persona-test: ${PERSONAS.length} smaakprofielen x ${N} sessies (gratis, deterministisch)\n`);
console.log("| Profiel | P1: beelden in haar smaak (van 18) | P1 genoeg (>=5) eerste set / na 3x andere | P2: activiteiten in haar smaak (van 18) | P2 genoeg (>=3) | Boek: ideeen in haar smaak (van 7) | Eigen keuzes in boek | Werelden |");
console.log("|---|---|---|---|---|---|---|---|");
for (const p of PERSONAS) {
  const r = results.get(p.id)!;
  console.log(`| ${p.label} | ${f1(avg(r.p1Hits))} | ${pct(r.p1Ok / N)} / ${pct(r.p1OkRefresh / N)} | ${f1(avg(r.p2Hits))} | ${pct(r.p2Ok / N)} | ${f1(avg(r.bookHit))} | ${pct(avg(r.ownInBook))} | ${f1(avg(r.worlds))} |`);
}
const female = PERSONAS.filter((p) => p.stereotype);
const mirror = PERSONAS.filter((p) => !p.stereotype);
const agg = (ps: Persona[], pick: (r: Row) => number[]) => avg(ps.flatMap((p) => pick(results.get(p.id)!)));
console.log(`\nGemiddeld, vrouwelijk-gecodeerde smaken (${female.length}): P1 ${f1(agg(female, (r) => r.p1Hits))}/18, P2 ${f1(agg(female, (r) => r.p2Hits))}/18, boek ${f1(agg(female, (r) => r.bookHit))}/7, eigen keuzes in boek ${pct(agg(female, (r) => r.ownInBook))}`);
console.log(`Gemiddeld, tegen het stereotype (${mirror.length}):               P1 ${f1(agg(mirror, (r) => r.p1Hits))}/18, P2 ${f1(agg(mirror, (r) => r.p2Hits))}/18, boek ${f1(agg(mirror, (r) => r.bookHit))}/7, eigen keuzes in boek ${pct(agg(mirror, (r) => r.ownInBook))}`);
const e = results.get("alleen-avond")!;
console.log(`\nAlleen + 's avonds + zonder auto: ${pct(e.verifyEvening / N)} van de boeken krijgt de vlag "evening"; buitenideeen gemiddeld ${pct(avg(e.outdoorShare))}; ideeen die echt solo kunnen ${pct(avg(e.soloOk))}`);
console.log(`Mislukte boeken (minder dan 7 zaden): ${[...results.values()].reduce((s, r) => s + r.failed, 0)}; sessies met te weinig eigen keuzes op pagina 2: ${[...results.values()].reduce((s, r) => s + r.noOwnPicks, 0)}`);
for (const p of PERSONAS) {
  const r = results.get(p.id)!;
  const top = [...r.topActs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => `${id} ${pct(n / N)}`).join(", ");
  console.log(`  ${p.id}: meest voorkomend: ${top}`);
}
const mo = results.get("moeder")!;
console.log(`
Moeder (must-have "Kinderen", alleen een vlag): ${pct(mo.kidsRisk / N)} van de boeken bevat een idee van de lijst 'niet voor kinderen'; ${pct(mo.kidsTier2 / N)} bevat een idee met toezicht (de schrijver zegt dan: controleer de minimumleeftijd)`);
console.log("\nAanbod per smaak (hoeveel beeldfamilies en activiteiten dragen de tag stevig):");
for (const t of ["style", "color", "craft", "caring", "stillness", "rhythm", "performance", "animals", "conviviality", "food", "language", "story", "learning", "history", "speed", "precision"]) {
  const fam = new Set(cards.filter((c) => (c.tagWeights[t] ?? 0) >= 0.6).map((c) => c.family ?? c.id)).size;
  const acts = all.filter((a) => a.tags.includes(t)).length;
  console.log(`  ${t.padEnd(13)} families ${String(fam).padStart(2)} | activiteiten ${String(acts).padStart(3)}`);
}
const fams = new Set(cards.map((c) => c.family ?? c.id)).size;
const regFam = countRegisters(cards.filter((c, i, a) => a.findIndex((x) => (x.family ?? x.id) === (c.family ?? c.id)) === i).map((c) => c.register));
console.log(`
Pool: ${fams} families, ${all.length} activiteiten. Families per register: ${REGISTERS.map((r) => `${r} ${regFam[r]}`).join(", ")}`);
void REGISTERS;
