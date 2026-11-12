// The audience personas and one simulated visit, shared by scripts/audience-research.ts (the report) and audience.regression.test.ts (the guard).
// 16 personas go through the production intake logic (page 1 images, page 2 activities, the start page's chips as text) with a persona's TASTE as
// the chooser, then through the real selection engine (WEIGHTS_ANCHOR, as in production). FREE and deterministic: no API call, no book text.
// The persona is a simulation, not a person: the tags it likes decide which images and activities it picks.
import { ASSOCIATIONS, associationsToEngineInput, hasOwnImage, activityAxes } from "@/lib/discovery/associations";
import { TAGS, getActivities, getActivity } from "@/lib/discovery/library";
import { inSeason } from "@/lib/discovery/season";
import { averageAxes, tagProfile } from "@/lib/discovery/associationProfile";
import { registerOfActivity, registerOfCard } from "@/lib/discovery/register";
import { composeConcretePage, registerMix, sampleBalancedBatch, type ConcreteActivity, type RegisteredCard, MIN_IMAGE_PICKS } from "@/lib/discovery/twoPages";
import { effortForPicks } from "@/lib/discovery/imageIntake";
import { runEngine } from "@/lib/discovery/engine";
import { WEIGHTS_ANCHOR } from "@/lib/discovery/engine/weights";
import { MINOR_UNSUITABLE, allowedForContext } from "@/lib/discovery/audience";
import { parseMustHaves } from "@/lib/discovery/engine/constraints";
import { hiddenByNeeds } from "@/lib/discovery/needs";
import { unfitFlags } from "@/lib/discovery/suitability";
import type { Activity } from "@/lib/discovery/types";

/** The month of the research (the engine filters seasonal activities). */
export const MONTH = 11;

export type Pred = (a: Activity) => boolean;
export interface Persona {
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

export const PERSONAS: Persona[] = [
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
  { id: "P12", label: "Priya, 36, internationale inwoner", who: "Nieuw in Nederland, spreekt Engels, zoekt sociale contacten en lokale cultuur", context: "self", tags: ["conviviality", "language", "food", "discovery", "story"], domains: ["together", "food", "growth"], budget: "50", time: "halfday", mustHaves: "'s Avonds, Mensen ontmoeten, Zonder Nederlands", needs: "Mensen ontmoeten, Engelstalig of taalvrij, lokale cultuur", stage: any, social: (a) => f(a).some((x) => ["drop_in_alone", "small_group", "large_group"].includes(x)), feasible: budget(2) },
  { id: "P13", label: "Jan en Ria, 68 en 70 (stel, gepensioneerd)", who: "Gepensioneerd stel, houdt van natuur, geschiedenis en een rustig tempo, geen auto", context: "self", tags: ["nature", "history", "growing", "conviviality", "stillness"], domains: ["nature", "history", "together"], budget: "50", time: "halfday", mustHaves: "Zonder auto bereikbaar, Rustig tempo", needs: "Rustig tempo, bereikbaar met OV, geen hoogtes of snelheid", stage: (a) => (a.intensity ?? 1) <= 1 && a.safety.tier < 2 && !["speed", "adventure"].includes(a.domain), social: (a) => f(a).some((x) => ["duo", "with_known", "small_group"].includes(x)), feasible: (a) => (a.intensity ?? 1) <= 1 && budget(2)(a) },
  { id: "P14", label: "Gerda, 79, beperkt mobiel en eenzaam", who: "Woont alleen, loopt moeilijk, wil graag mensen ontmoeten en iets doen", context: "self", tags: ["conviviality", "stillness", "story", "caring", "sound"], domains: ["together", "restful"], budget: "25", time: "hour", mustHaves: "Zonder auto bereikbaar, Alleen binnen, Rustig tempo, Mensen ontmoeten", needs: "Dichtbij, zittend of rustig, met mensen", stage: (a) => (a.intensity ?? 1) <= 1 && a.safety.tier < 2 && !["speed", "adventure", "movement"].includes(a.domain), social: (a) => f(a).some((x) => ["drop_in_alone", "small_group", "duo"].includes(x)), feasible: accessible },
  { id: "P15", label: "Voor mijn vader, 71 (voor iemand anders)", who: "Dochter zoekt iets voor haar vader van 71 die van techniek en geschiedenis houdt", context: "adult", tags: ["history", "technique", "retro", "craft", "story"], domains: ["history", "tech"], budget: "100", time: "halfday", mustHaves: "", needs: "Past bij een man van 71 met interesse in techniek en geschiedenis, geen stoer avontuur", stage: (a) => (a.intensity ?? 1) <= 1 && a.safety.tier < 2, social: any, feasible: budget(3) },
  { id: "P16", label: "Alex, 26, ruim spectrum", who: "Sportief, cultureel en strategisch tegelijk, weinig geld, zonder alcohol", context: "self", tags: ["challenge", "height", "strategy", "history", "balance"], domains: ["movement", "history", "games"], budget: "10", time: "halfday", mustHaves: "Zonder alcohol", needs: "Mengt actief en cultureel, goedkoop, zonder alcohol", stage: any, social: any, feasible: budget(1) },
];

export const cards: RegisteredCard[] = ASSOCIATIONS.filter(hasOwnImage).map((c) => ({ id: c.id, family: c.family, round: c.round, tagWeights: c.tagWeights, axes: c.axes, register: registerOfCard(c) }));
const all = getActivities();
export const generic = new Set(TAGS.filter((t) => t.generic).map((t) => t.id));
const pool: ConcreteActivity[] = all.filter((a) => inSeason(a, MONTH)).map((a) => ({ id: a.id, domain: a.domain, sub: a.sub, register: registerOfActivity(a), tags: a.tags, axes: activityAxes(a) }));
export const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const cardScore = (c: RegisteredCard, p: Persona) => p.tags.reduce((s, t) => s + (c.tagWeights[t] ?? 0), 0);
export const actHit = (a: { tags: readonly string[]; domain: string }, p: Persona) => a.tags.some((t) => p.tags.includes(t) && !generic.has(t)) || p.domains.includes(a.domain);
/** Strict: only a non-generic tag of the persona counts (the domain alone is too forgiving: "creative" is a fifth of the library). */
export const tagHit = (a: { tags: readonly string[] }, p: Persona) => a.tags.some((t) => p.tags.includes(t) && !generic.has(t));

export interface Session {
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

export function runSession(p: Persona, sid: string): Session {
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
  // Page 2 as the wizard composes it: what a stated need or the search context rules out is not offered (AssociationWizard poolActivities).
  const needs = parseMustHaves(p.mustHaves);
  const withKids = needs.verify.includes("children");
  const offered = pool.filter((c) => {
    const a = getActivity(c.id)!;
    return allowedForContext(a, p.context) && (!withKids || allowedForContext(a, "child")) && !hiddenByNeeds(unfitFlags(a), needs);
  });
  const slots = composeConcretePage(offered, { seed: sid, profile: tagProfile(cards, ids), axes: averageAxes(cards, ids), genericTags: generic, mix });
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
