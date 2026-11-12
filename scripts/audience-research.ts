// Audience and matching research (12 Nov 2026): 16 personas through the production intake logic and the production selection engine.
// FREE and reproducible: no API call. What it does and does not measure:
//   - It replays what the image intake does (page 1 images, page 2 activities, the start page's answers) with a persona's TASTE as the
//     chooser. The persona is a simulation, not a person: the tags it likes decide which images and activities it picks.
//   - It runs the real engine (WEIGHTS_ANCHOR, as in production) and reports the seven selected activities per persona and per session.
//   - It does NOT write the book (no text, no places, no links): the presentation is out of scope here.
// Scores 1-10 per criterion are computed from the library facets of the selected activities, with the rules written next to each persona.
//   npx tsx scripts/audience-research.ts [sessionsPerPersona]   (default 30; writes scratch/audience-results.json)
import { writeFileSync, mkdirSync } from "node:fs";
import { ASSOCIATIONS, associationsToEngineInput, hasOwnImage, activityAxes } from "../src/lib/discovery/associations";
import { TAGS, getActivities, getActivity } from "../src/lib/discovery/library";
import { inSeason } from "../src/lib/discovery/season";
import { averageAxes, tagProfile } from "../src/lib/discovery/associationProfile";
import { registerOfActivity, registerOfCard } from "../src/lib/discovery/register";
import { composeConcretePage, registerMix, sampleBalancedBatch, type ConcreteActivity, type RegisteredCard, MIN_IMAGE_PICKS } from "../src/lib/discovery/twoPages";
import { effortForPicks } from "../src/lib/discovery/imageIntake";
import { runEngine } from "../src/lib/discovery/engine";
import { WEIGHTS_ANCHOR } from "../src/lib/discovery/engine/weights";
import { MINOR_UNSUITABLE } from "../src/lib/discovery/audience";
import type { Activity } from "../src/lib/discovery/types";

const N = Number(process.argv[2] ?? 30);
const MONTH = 11; // the month of the research (the engine filters seasonal activities)

type Pred = (a: Activity) => boolean;
interface Persona {
  id: string;
  label: string;
  who: string; // short description
  context: "self" | "child" | "adult" | "group";
  tags: string[];
  domains: string[];
  budget: string;
  time: string;
  mustHaves: string; // the text the start page's chips produce
  needs: string; // what the persona expects (for the report)
  /** life stage fit: is the activity plausible for this person's age and phase? */
  stage: Pred;
  /** social fit: does the way of doing it match the social situation? */
  social: Pred;
  /** practical/physical feasibility given the limits */
  feasible: Pred;
}

const f = (a: Activity) => a.formats ?? [];
const together: Pred = (a) => f(a).some((x) => ["duo", "small_group", "large_group", "with_known"].includes(x));
const soloOk: Pred = (a) => f(a).some((x) => ["solo", "drop_in_alone"].includes(x));
const any: Pred = () => true;
const gentle: Pred = (a) => (a.intensity ?? 1) <= 1 && a.safety.tier < 2;
const noTier2: Pred = (a) => a.safety.tier < 2;
const childOk: Pred = (a) => !MINOR_UNSUITABLE.has(a.id) && a.safety.tier < 2 && (a.intensity ?? 1) <= 2;
const accessible: Pred = (a) => gentle(a) && a.setting !== "outdoor" && !["adventure", "speed", "movement", "target"].includes(a.domain);
const budget = (cap: number): Pred => (a) => a.cost === null || a.cost <= cap;

const PERSONAS: Persona[] = [
  { id: "P01", label: "Lotte, 9 (via ouder)", who: "Kind van 9; ouder zoekt een uitje, dol op dieren en knutselen", context: "child", tags: ["animals", "nature", "making", "play", "outdoors"], domains: ["nature", "creative"], budget: "25", time: "halfday", mustHaves: "", needs: "Veilig, speels, samen met een ouder", stage: childOk, social: together, feasible: budget(2) },
  { id: "P02", label: "Daan, 15 (via ouder)", who: "Tiener van 15 die van techniek, snelheid en muziek houdt", context: "child", tags: ["speed", "technique", "sound", "competition", "movement"], domains: ["speed", "tech", "creative"], budget: "50", time: "halfday", mustHaves: "", needs: "Geen kinderachtig aanbod, wel veilig en toegestaan voor zijn leeftijd", stage: childOk, social: any, feasible: budget(2) },
  { id: "P03", label: "Mila, 22, student", who: "Student, avontuurlijk en sociaal, weinig geld, doet graag iets met vrienden", context: "self", tags: ["challenge", "movement", "outdoors", "conviviality", "height"], domains: ["adventure", "movement"], budget: "25", time: "halfday", mustHaves: "In het weekend", needs: "Betaalbaar, actief, met vrienden", stage: budget(2), social: together, feasible: budget(2) },
  { id: "P04", label: "Tim en Sanne, gezin met kinderen van 3 en 6", who: "Gezin met jonge kinderen, zoekt een dagje samen buiten of creatief", context: "self", tags: ["nature", "making", "play", "caring", "animals"], domains: ["nature", "creative"], budget: "50", time: "fullday", mustHaves: "Met jonge kinderen", needs: "Geschikt voor een kleuter en een kleuterleerling, geen alcohol of risicosport", stage: childOk, social: together, feasible: (a) => budget(2)(a) && noTier2(a) },
  { id: "P05", label: "Joyce, 41, alleenstaande moeder", who: "Alleenstaande moeder met een kind van 12, weinig geld, geen auto", context: "self", tags: ["making", "nature", "food", "conviviality", "play"], domains: ["creative", "food", "nature"], budget: "10", time: "halfday", mustHaves: "Met kinderen, Zonder auto bereikbaar", needs: "Goedkoop, met een kind van 12, bereikbaar met OV", stage: childOk, social: together, feasible: budget(1) },
  { id: "P06", label: "Mark en Eva, 38 en 36 (stel)", who: "Stel zonder kinderen, cultuur, eten en verhalen, een weekend weg", context: "self", tags: ["food", "history", "story", "style", "discovery"], domains: ["food", "history", "travel"], budget: "100", time: "weekend", mustHaves: "In het weekend, Met één ander", needs: "Iets om met zijn tweeën te doen, met karakter", stage: any, social: (a) => f(a).some((x) => ["duo", "with_known"].includes(x)), feasible: budget(3) },
  { id: "P07", label: "Vriendengroep, zes mensen rond de 29", who: "Vriendengroep voor een avond of dag, competitief en lollig", context: "group", tags: ["competition", "play", "teamwork", "suspense", "conviviality"], domains: ["games", "mystery", "night"], budget: "50", time: "fullday", mustHaves: "'s Avonds, Met een groep", needs: "Iets wat met zes kan, 's avonds, met onderlinge competitie", stage: any, social: (a) => f(a).some((x) => ["small_group", "large_group", "with_known"].includes(x)), feasible: budget(2) },
  { id: "P08", label: "Henk, 52, praktisch en technisch", who: "Maakt en repareert graag, zoekt een nieuwe uitdaging voor zijn handen", context: "self", tags: ["craft", "technique", "making", "fire", "precision"], domains: ["tech", "elements", "creative"], budget: "100", time: "fullday", mustHaves: "", needs: "Iets met gereedschap of materiaal, geen hippe cursus", stage: any, social: any, feasible: budget(3) },
  { id: "P09", label: "Marijke, 49, rustig en introvert", who: "Introvert, zoekt stilte, natuur en verhalen, liefst niet in een groep", context: "self", tags: ["stillness", "nature", "story", "caring", "growing"], domains: ["restful", "nature"], budget: "50", time: "halfday", mustHaves: "Niet in een groep", needs: "Rustig, alleen of met een of twee mensen, geen drukte", stage: any, social: soloOk, feasible: (a) => (a.intensity ?? 1) <= 1 && budget(2)(a) },
  { id: "P10", label: "Anouk, 45, rolstoelgebruiker", who: "Rolstoelgebruiker, cultureel en taalgevoelig, zoekt uitjes die echt toegankelijk zijn", context: "self", tags: ["history", "story", "performance", "language", "discovery"], domains: ["history", "stage", "growth"], budget: "50", time: "halfday", mustHaves: "Met de rolstoel bereikbaar", needs: "Toegankelijk: geen buitensport of klimmen, niet 'we raden af'", stage: any, social: any, feasible: accessible },
  { id: "P11", label: "Bram, 27, prikkelarm en structuur", who: "Heeft behoefte aan structuur en weinig prikkels, houdt van puzzelen, strategie en verzamelen", context: "self", tags: ["puzzling", "strategy", "collecting", "learning", "technique"], domains: ["games", "collecting", "tech"], budget: "25", time: "halfday", mustHaves: "Alleen binnen, Niet in een groep, Rustig en voorspelbaar", needs: "Voorspelbaar, rustig, met een duidelijke structuur; geen overvolle plekken", stage: any, social: soloOk, feasible: (a) => (a.intensity ?? 1) <= 1 && a.setting !== "outdoor" && !["night", "stage", "together"].includes(a.domain) },
  { id: "P12", label: "Priya, 36, internationale inwoner", who: "Nieuw in Nederland, spreekt Engels, zoekt sociale contacten en lokale cultuur", context: "self", tags: ["conviviality", "language", "food", "discovery", "story"], domains: ["together", "food", "growth"], budget: "50", time: "halfday", mustHaves: "'s Avonds, Mensen ontmoeten", needs: "Mensen ontmoeten, Engelstalig of taalvrij, lokale cultuur", stage: any, social: (a) => f(a).some((x) => ["drop_in_alone", "small_group", "large_group"].includes(x)), feasible: budget(2) },
  { id: "P13", label: "Jan en Ria, 68 en 70 (stel, gepensioneerd)", who: "Gepensioneerd stel, houdt van natuur, geschiedenis en een rustig tempo, geen auto", context: "self", tags: ["nature", "history", "growing", "conviviality", "stillness"], domains: ["nature", "history", "together"], budget: "50", time: "halfday", mustHaves: "Zonder auto bereikbaar, Rustig tempo", needs: "Rustig tempo, bereikbaar met OV, geen hoogtes of snelheid", stage: (a) => (a.intensity ?? 1) <= 1 && a.safety.tier < 2 && !["speed", "adventure"].includes(a.domain), social: (a) => f(a).some((x) => ["duo", "with_known", "small_group"].includes(x)), feasible: (a) => (a.intensity ?? 1) <= 1 && budget(2)(a) },
  { id: "P14", label: "Gerda, 79, beperkt mobiel en eenzaam", who: "Woont alleen, loopt moeilijk, wil graag mensen ontmoeten en iets doen", context: "self", tags: ["conviviality", "stillness", "story", "caring", "sound"], domains: ["together", "restful"], budget: "25", time: "hour", mustHaves: "Zonder auto bereikbaar, Alleen binnen, Rustig tempo, Mensen ontmoeten", needs: "Dichtbij, zittend of rustig, met mensen", stage: (a) => (a.intensity ?? 1) <= 1 && a.safety.tier < 2 && !["speed", "adventure", "movement"].includes(a.domain), social: (a) => f(a).some((x) => ["drop_in_alone", "small_group", "duo"].includes(x)), feasible: accessible },
  { id: "P15", label: "Voor mijn vader, 71 (voor iemand anders)", who: "Dochter zoekt iets voor haar vader van 71 die van techniek en geschiedenis houdt", context: "adult", tags: ["history", "technique", "retro", "craft", "story"], domains: ["history", "tech"], budget: "100", time: "halfday", mustHaves: "", needs: "Past bij een man van 71 met interesse in techniek en geschiedenis, geen stoer avontuur", stage: (a) => (a.intensity ?? 1) <= 1 && a.safety.tier < 2, social: any, feasible: budget(3) },
  { id: "P16", label: "Alex, 26, ruim spectrum", who: "Sportief, cultureel en strategisch tegelijk, weinig geld, zonder alcohol", context: "self", tags: ["challenge", "height", "strategy", "history", "balance"], domains: ["movement", "history", "games"], budget: "10", time: "halfday", mustHaves: "Zonder alcohol", needs: "Mengt actief en cultureel, goedkoop, zonder alcohol", stage: any, social: any, feasible: budget(1) },
];

const cards: RegisteredCard[] = ASSOCIATIONS.filter(hasOwnImage).map((c) => ({ id: c.id, family: c.family, round: c.round, tagWeights: c.tagWeights, axes: c.axes, register: registerOfCard(c) }));
const all = getActivities();
const generic = new Set(TAGS.filter((t) => t.generic).map((t) => t.id));
const pool: ConcreteActivity[] = all.filter((a) => inSeason(a, MONTH)).map((a) => ({ id: a.id, domain: a.domain, sub: a.sub, register: registerOfActivity(a), tags: a.tags, axes: activityAxes(a) }));
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const cardScore = (c: RegisteredCard, p: Persona) => p.tags.reduce((s, t) => s + (c.tagWeights[t] ?? 0), 0);
const actHit = (a: { tags: readonly string[]; domain: string }, p: Persona) => a.tags.some((t) => p.tags.includes(t) && !generic.has(t)) || p.domains.includes(a.domain);
/** Strict: only a non-generic tag of the persona counts (the domain alone is too forgiving: "creative" is a fifth of the library). */
const tagHit = (a: { tags: readonly string[] }, p: Persona) => a.tags.some((t) => p.tags.includes(t) && !generic.has(t));

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

interface Session {
  seeds: { id: string; label: string; domain: string; direction: string; door: string; level?: number; intensity: number | null; cost: number | null; setting: string | null; tier: number; formats: string[] | null; verify: string[] }[];
  notes: string[];
  p2Hits: number;
  /** what the persona chose on page 1 (image families) and page 2 (activities), and what the engine started from */
  imagePicks: string[];
  firstSetHits: number;
  refreshes: number;
  pickHits: number;
  concretePicks: string[];
  page2Offer: string[];
}

function runSession(p: Persona, sid: string): Session {
  const sets: RegisteredCard[][] = [];
  const seen: string[] = [];
  for (let r = 0; r <= 3; r++) {
    const b = sampleBalancedBatch(cards, { seed: sid, refresh: r, exclude: seen });
    sets.push(b);
    seen.push(...b.map((c) => c.id));
  }
  // A real person who sees too few images that speak to them presses "Andere beelden" (up to three times): the persona does the same.
  const need = MIN_IMAGE_PICKS;
  let used = 0;
  let pool1: RegisteredCard[] = [...sets[0]];
  while (pool1.filter((c) => cardScore(c, p) >= 0.6).length < need && used < 3) pool1 = [...pool1, ...sets[++used]];
  const first = sets[0].filter((c) => cardScore(c, p) >= 0.6);
  const ranked = [...pool1].sort((a, b) => cardScore(b, p) - cardScore(a, p));
  const picks = ranked.slice(0, Math.max(MIN_IMAGE_PICKS, Math.min(6, pool1.filter((c) => cardScore(c, p) >= 0.6).length)));
  const ids = picks.map((c) => c.id);
  const mix = registerMix(picks);
  const slots = composeConcretePage(pool, { seed: sid, profile: tagProfile(cards, ids), axes: averageAxes(cards, ids), genericTags: generic, mix });
  const hits = slots.filter((s) => actHit(s.activity, p));
  const concrete = (hits.length >= 3 ? hits : slots).slice(0, Math.max(3, Math.min(5, hits.length))).map((s) => s.activity.id);
  const derived = associationsToEngineInput({
    associationIds: ids, interestDomains: [], explicitInterests: concrete,
    // as in production: no age, no social format; only budget, time, the chips' text and the search context
    constraints: { budget: p.budget, timeAvailable: p.time, mustHaves: p.mustHaves, socialFormats: [], ageCategory: "", searchContext: p.context },
    seed: sid, month: MONTH,
  });
  const res = runEngine({
    interests: derived.interests,
    interestDomains: [...new Set(derived.interests.map((id) => getActivity(id)?.domain).filter((d): d is string => !!d))],
    socialFormats: [], practicalToWild: derived.practicalToWild, budget: p.budget,
    effort: effortForPicks(derived.effort, derived.interests, false), timeAvailable: p.time, ageCategory: "", searchContext: p.context, mustHaves: p.mustHaves,
    history: [], seed: sid, month: MONTH, explicitPicks: true,
  }, { weights: WEIGHTS_ANCHOR });
  return {
    seeds: res.seeds.map((s) => {
      const a = getActivity(s.activityId)!;
      return { id: a.id, label: a.label.nl, domain: a.domain, direction: s.direction, door: s.door, level: s.level, intensity: a.intensity, cost: a.cost, setting: a.setting, tier: a.safety.tier, formats: a.formats, verify: s.verify };
    }),
    notes: res.notes,
    p2Hits: hits.length,
    imagePicks: picks.map((c) => c.family ?? c.id),
    firstSetHits: first.length,
    refreshes: used,
    pickHits: picks.filter((c) => cardScore(c, p) >= 0.6).length,
    concretePicks: concrete,
    page2Offer: slots.map((x) => x.activity.id),
  };
}

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
  out.push({ registers: Object.fromEntries(Object.entries(regAvg).map(([k, v]) => [k, Math.round(v * 10) / 10])), persona: p.id, label: p.label, who: p.who, needs: p.needs, context: p.context, mustHaves: p.mustHaves, budget: p.budget, time: p.time, rates: { firstSetOk, avgRefresh, avgPickHits, interestLoose, mismatch, subRepeat, stageRate, interestRate, socialRate, feasibleRate, originalRate, diversityRate, relevanceAuto }, scores, total, failed, tier2Share: tier2, verifyAccessibilityShare: verifyAcc, distinctActivitiesOverSessions: distinct, manualRelevance: manual, relevanceAutoScore: score(relevanceAuto), representative: sessions[0], top: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => `${id} ${Math.round((n / N) * 100)}%`), directionMix: Object.fromEntries(["familiar", "adjacent", "unexpected", "stretch", "wildcard", "explore"].map((d) => [d, Math.round(avg(sessions.map((s) => s.seeds.filter((x) => x.direction === d).length)) * 10) / 10])) });
}

// overlap: how many personas get the same activity at least once, and the pairwise Jaccard of their top-20 sets
const top = (id: string) => new Set([...sessionCount.get(id)!.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([a]) => a));
const jac = (a: Set<string>, b: Set<string>) => [...a].filter((x) => b.has(x)).length / new Set([...a, ...b]).size;
const pairs: { a: string; b: string; j: number }[] = [];
for (let i = 0; i < PERSONAS.length; i++) for (let j = i + 1; j < PERSONAS.length; j++) pairs.push({ a: PERSONAS[i].id, b: PERSONAS[j].id, j: Math.round(jac(top(PERSONAS[i].id), top(PERSONAS[j].id)) * 100) / 100 });
pairs.sort((x, y) => y.j - x.j);
const everywhere = [...freq.entries()].filter(([, s]) => s.size >= 8).sort((a, b) => b[1].size - a[1].size).map(([id, s]) => `${id} (${s.size} van ${PERSONAS.length})`);

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
