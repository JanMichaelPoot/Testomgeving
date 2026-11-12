// Audience and matching research (12 Nov 2026): 16 personas through the production intake logic and the production selection engine.
// FREE and reproducible: no API call. What it does and does not measure:
//   - It replays what the image intake does (page 1 images, page 2 activities, the start page's answers) with a persona's TASTE as the
//     chooser. The persona is a simulation, not a person: the tags it likes decide which images and activities it picks.
//   - It runs the real engine (WEIGHTS_ANCHOR, as in production) and reports the seven selected activities per persona and per session.
//   - It does NOT write the book (no text, no places, no links): the presentation is out of scope here.
// Scores 1-10 per criterion are computed from the library facets of the selected activities, with the rules written next to each persona.
//   npx tsx scripts/audience-research.ts [sessionsPerPersona]   (default 30; writes scratch/audience-results.json)
import { clusterOf } from "@/lib/discovery/clusters";
import { writeFileSync, mkdirSync } from "node:fs";
import { getActivity } from "../src/lib/discovery/library";
import { registerOfActivity } from "../src/lib/discovery/register";
import { MIN_IMAGE_PICKS } from "../src/lib/discovery/twoPages";
import { MONTH, PERSONAS, actHit, avg, runSession, tagHit, type Session } from "../src/lib/discovery/eval/audience";
import type { Activity } from "../src/lib/discovery/types";

const N = Number(process.argv[2] ?? 30);


/** The hand-given relevance score (1-10) of the representative list of each persona, with the reason: a reading of the actual seven. */
const MANUAL: Record<string, [number, string]> = {
  P01: [5.5, "geen dieren in de lijst; creatief aanbod past; een wandelgroep voor volwassenen en een roman als wildcard zijn niet voor een kind"],
  P02: [5.5, "analoge fotografie, geocaching en motor sleutelen passen; stoel bekleden en een stadswandeling over geschiedenis niet bij een tiener die van snelheid houdt"],
  P03: [6, "actief en sociaal, maar drie van de zeven zijn dans, een meswerp-wildcard (toezicht) en niets met hoogte of avontuur"],
  P04: [2.5, "geen enkel idee is gezinsgericht voor een kleuter en een zesjarige: 3D-boogparcours (toezicht), mountainbiken (intensiteit 3), een week meewerken, vrijwilligerswerk; alleen geocaching past"],
  P05: [5, "dierenasiel, bloembollen en modelbouw passen bij een kind van 12; een bingo-avond, een solo-idee en mentor zoeken minder"],
  P06: [5.5, "enkele goede (patisserie, hoorspel, historisch koken), maar ook solo of zakelijke ideeën (levenslijn, leren presenteren)"],
  P07: [7, "larp, bubble football, potluck en een nachtwandeling passen bij een groep van zes; een kamerplant als wildcard is een misser"],
  P08: [7, "restaureren, edelstenen slijpen, mes smeden en brocante passen bij een praktisch iemand; twee ideeën met toezicht (meswerpen, mes smeden) zijn stevig"],
  P09: [7, "rustig en buiten (natuurwandeling, wilgenvlechten, geocaching); knotten is zwaar"],
  P10: [6.5, "cultuur en taal passen bij de smaak; of de plekken toegankelijk zijn weet niemand (geen gegevens), en een zorgboerderij is buiten"],
  P11: [6, "zendamateur, lockpicking, open source en microscopie passen goed; een boksles (intensiteit 3) botst met prikkelarm"],
  P12: [4.5, "alleen een dinerkring en theater-backstage zijn sociaal; roman lezen en paddenstoelen zoeken (toezicht) niet"],
  P13: [4.5, "wandelen, potluck en fossielen passen; een urbex-tour (toezicht, verlaten gebouwen) en een week boerderijwerk niet voor 68+"],
  P14: [4.5, "open podium past; pallet-meubels maken en vooral solo-ideeën laten het eenzaamheidsdoel liggen"],
  P15: [3, "cosplay, kostuumontwerp, een solo-rollenspel en slides ontwerpen: niets met techniek of geschiedenis voor een man van 71"],
  P16: [4, "niets-doen, een spelavond thuis, een platenwinkel en reptielen: weinig actief of cultureel, wel goedkoop en zonder alcohol"],
};



const score = (rate: number) => Math.round((1 + 9 * Math.max(0, Math.min(1, rate))) * 10) / 10;
const WEIGHTS = { stage: 0.15, interests: 0.2, social: 0.1, feasible: 0.15, original: 0.15, diversity: 0.1, relevance: 0.15 };

const out: Record<string, unknown>[] = [];
const freq = new Map<string, Set<string>>(); // activity -> personas that got it (any session)
const sessionCount = new Map<string, Map<string, number>>();
for (const p of PERSONAS) {
  const sessions: Session[] = [];
  for (let i = 0; i < N; i++) sessions.push(runSession(p, `aud-${p.id}-${i}`));
  const rate = (pred: (s: Session["seeds"][number], a: Activity) => boolean) =>
    avg(sessions.map((s) => s.seeds.filter((x) => pred(x, getActivity(x.id)!)).length / Math.max(1, s.seeds.length)));
  const stageRate = rate((_, a) => p.stage(a));
  const interestLoose = rate((_, a) => actHit(a, p));
  const interestRate = rate((_, a) => tagHit(a, p));
  const mismatch = avg(sessions.map((s) => s.seeds.filter((x) => { const a = getActivity(x.id)!; return !p.stage(a) || !p.feasible(a) || (a.formats !== null && !p.social(a)); }).length / Math.max(1, s.seeds.length)));
  if (process.env.SHOW_MISSES === p.id) {
    // Which ideas count as a miss for this persona, and how often: the list to read when a need still leaks through.
    const misses = new Map<string, number>();
    for (const s of sessions) for (const x of s.seeds) { const a = getActivity(x.id)!; if (!p.stage(a) || !p.feasible(a) || (a.formats !== null && !p.social(a))) misses.set(x.id, (misses.get(x.id) ?? 0) + 1); }
    console.log(`${p.id} misses:`, [...misses.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${n}`).join(", "));
  }
  // Books with a cluster of the same kind (dances, walks, ...) three times or more: the "one idea said three times" problem (clusters.ts).
  const clusterRepeat = avg(sessions.map((s) => { const c = new Map<string, number>(); for (const x of s.seeds) { const k = clusterOf(x.id); if (k) c.set(k, (c.get(k) ?? 0) + 1); } return Math.max(0, ...c.values()) >= 3 ? 1 : 0; }));
  const subRepeat = avg(sessions.map((s) => { const c = new Map<string, number>(); for (const x of s.seeds) { const sub = getActivity(x.id)!.sub; c.set(sub, (c.get(sub) ?? 0) + 1); } return Math.max(...c.values()); }));
  const socialRate = avg(sessions.map((s) => s.seeds.reduce((t, x) => { const a = getActivity(x.id)!; return t + (a.formats === null ? 0.5 : p.social(a) ? 1 : 0); }, 0) / Math.max(1, s.seeds.length)));
  const feasibleRate = rate((_, a) => p.feasible(a));
  const originalRate = avg(sessions.map((s) => Math.min(1, s.seeds.filter((x) => ["unexpected", "stretch", "wildcard"].includes(x.direction)).length / s.seeds.length / 0.43)));
  const diversityRate = avg(sessions.map((s) => Math.min(1, new Set(s.seeds.map((x) => x.domain)).size / 6)));
  // the "relevance and attractiveness" criterion is a reading of the whole list, so it starts as the mean of the three fit rates and is
  // then adjusted by hand in the report (never silently): the automatic value is reported as such.
  const relevanceAuto = (stageRate + interestRate + feasibleRate) / 3;
  const manual = MANUAL[p.id];
  const scores = { stage: score(stageRate), interests: score(interestRate), social: score(socialRate), feasible: score(feasibleRate), original: score(originalRate), diversity: score(diversityRate), relevance: manual[0] };
  const total = Math.round(10 * Object.entries(WEIGHTS).reduce((t, [k, w]) => t + w * scores[k as keyof typeof scores], 0) * 10) / 10;
  // overlap between personas
  const counts = new Map<string, number>();
  for (const s of sessions) for (const x of s.seeds) counts.set(x.id, (counts.get(x.id) ?? 0) + 1);
  sessionCount.set(p.id, counts);
  for (const id of counts.keys()) { if (!freq.has(id)) freq.set(id, new Set()); freq.get(id)!.add(p.id); }
  const regAvg: Record<string, number> = {};
  for (const sess of sessions) for (const x of sess.seeds) { const r = registerOfActivity(getActivity(x.id)!); regAvg[r] = (regAvg[r] ?? 0) + 1 / N; }
  const firstSetOk = avg(sessions.map((x) => (x.firstSetHits >= MIN_IMAGE_PICKS ? 1 : 0)));
  const avgRefresh = avg(sessions.map((x) => x.refreshes));
  const avgPickHits = avg(sessions.map((x) => x.pickHits));
  const failed = sessions.filter((s) => s.seeds.length < 7).length;
  const tier2 = avg(sessions.map((s) => (s.seeds.some((x) => x.tier === 2) ? 1 : 0)));
  const verifyAcc = avg(sessions.map((s) => (s.seeds.some((x) => x.verify.includes("accessibility")) ? 1 : 0)));
  const distinct = new Set(sessions.flatMap((s) => s.seeds.map((x) => x.id))).size;
  out.push({ registers: Object.fromEntries(Object.entries(regAvg).map(([k, v]) => [k, Math.round(v * 10) / 10])), persona: p.id, label: p.label, who: p.who, needs: p.needs, context: p.context, mustHaves: p.mustHaves, budget: p.budget, time: p.time, rates: { clusterRepeat, firstSetOk, avgRefresh, avgPickHits, interestLoose, mismatch, subRepeat, stageRate, interestRate, socialRate, feasibleRate, originalRate, diversityRate, relevanceAuto }, scores, total, failed, tier2Share: tier2, verifyAccessibilityShare: verifyAcc, distinctActivitiesOverSessions: distinct, manualRelevance: manual, relevanceAutoScore: score(relevanceAuto), representative: sessions[0], top: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => `${id} ${Math.round((n / N) * 100)}%`), directionMix: Object.fromEntries(["familiar", "adjacent", "unexpected", "stretch", "wildcard", "explore"].map((d) => [d, Math.round(avg(sessions.map((s) => s.seeds.filter((x) => x.direction === d).length)) * 10) / 10])) });
}

// overlap: how many personas get the same activity at least once, and the pairwise Jaccard of their top-20 sets
const top = (id: string) => new Set([...sessionCount.get(id)!.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([a]) => a));
const jac = (a: Set<string>, b: Set<string>) => [...a].filter((x) => b.has(x)).length / new Set([...a, ...b]).size;
const pairs: { a: string; b: string; j: number }[] = [];
for (let i = 0; i < PERSONAS.length; i++) for (let j = i + 1; j < PERSONAS.length; j++) pairs.push({ a: PERSONAS[i].id, b: PERSONAS[j].id, j: Math.round(jac(top(PERSONAS[i].id), top(PERSONAS[j].id)) * 100) / 100 });
pairs.sort((x, y) => y.j - x.j);
// Share of ALL books (every persona, every session) that contain the activity: the honest measure of a "standard idea".
const bookShare = new Map<string, number>();
for (const m of sessionCount.values()) for (const [id, n] of m) bookShare.set(id, (bookShare.get(id) ?? 0) + n);
const totalBooks = PERSONAS.length * N;
const everywhere = [...bookShare.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id, n]) => `${id} (${Math.round((n / totalBooks) * 100)}% van alle boeken, ${freq.get(id)!.size} van ${PERSONAS.length} persona's)`);

mkdirSync("scratch", { recursive: true });
writeFileSync("scratch/audience-results.json", JSON.stringify({ n: N, month: MONTH, weights: WEIGHTS, personas: out, topPairs: pairs.slice(0, 10), everywhere }, null, 1));

console.log(`# Doelgroeponderzoek: ${PERSONAS.length} persona's x ${N} sessies, maand ${MONTH}, productie-engine, gratis, zonder tekstgeneratie\n`);
console.log("| Persona | Leeftijd/fase | Interesses (tags) | Sociaal | Haalbaar | Origineel | Divers | Relevantie (hand) | Totaal | Misser-aandeel | Eerste beeldenset genoeg | Gem. keer 'Andere beelden' |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of out) {
  const s = r.scores as Record<string, number>;
  console.log(`| ${r.persona} ${r.label} | ${s.stage} | ${s.interests} | ${s.social} | ${s.feasible} | ${s.original} | ${s.diversity} | ${s.relevance} | ${r.total} | ${Math.round(((r.rates as Record<string, number>).mismatch) * 100)}% | ${Math.round(((r.rates as Record<string, number>).firstSetOk) * 100)}% | ${(r.rates as Record<string, number>).avgRefresh.toFixed(1)} |`);
}
console.log(`\nGemiddeld totaal: ${Math.round(avg(out.map((r) => r.total as number)) * 10) / 10}`);
console.log(`Mislukte sessies (minder dan 7 zaden): ${out.reduce((t, r) => t + (r.failed as number), 0)}`);
console.log(`\nActiviteiten die minstens 8 van de 16 persona's krijgen: ${everywhere.join(", ") || "geen"}`);
console.log(`Meest overlappende paren (Jaccard top-20): ${pairs.slice(0, 6).map((x) => `${x.a}-${x.b} ${x.j}`).join(", ")}`);
for (const r of out) {
  const rep = r.representative as Session;
  console.log(`\n## ${r.persona} ${r.label}  [${r.context}; "${r.mustHaves}"; budget ${r.budget}; ${r.time}]`);
  console.log(`Verwachting: ${r.needs}`);
  for (const x of rep.seeds) console.log(`  ${x.direction.padEnd(10)} ${x.id.padEnd(26)} ${x.label}  | int ${x.intensity} cost ${x.cost} ${x.setting} tier ${x.tier} | ${x.formats?.join("/") ?? "?"}${x.verify.length ? " | check: " + x.verify.join(",") : ""}`);
  console.log(`  pagina 1 (beeldfamilies): ${rep.imagePicks.join(", ")}
  pagina 2 aanbod (${rep.page2Offer.length}): ${rep.page2Offer.join(", ")}
  pagina 2 gekozen: ${rep.concretePicks.join(", ")} (in haar smaak: ${rep.p2Hits})`);
  console.log(`  notities: ${rep.notes.join(", ") || "-"}; tier2 in ${Math.round((r.tier2Share as number) * 100)}% van de sessies; verify accessibility in ${Math.round((r.verifyAccessibilityShare as number) * 100)}%; ${r.distinctActivitiesOverSessions} verschillende activiteiten in ${N} sessies; richtingen ${JSON.stringify(r.directionMix)}`);
}
