import { ASSOCIATIONS, buildAssociationLibrary } from "@/lib/discovery/associations";
import { applyImageIntake } from "@/lib/discovery/imageIntake";
import { runEngine, engineInputFromIntake } from "@/lib/discovery/engine";
import { WEIGHTS_ANCHOR } from "@/lib/discovery/engine/weights";
import { getActivity, TAGS } from "@/lib/discovery/library";
import { buildConcretePool } from "@/lib/discovery/concretePool";
import { composeConcretePage, registerMix, sampleBalancedBatch } from "@/lib/discovery/twoPages";
import { tagProfile, averageAxes, effectiveAxes, deriveDials } from "@/lib/discovery/associationProfile";
import { activityContextLean, imagePreference } from "@/lib/discovery/audience";
import { registerOfCard } from "@/lib/discovery/register";
import { levelName } from "@/lib/discoveryLevels";

const tagLabel = new Map(TAGS.map((t) => [t.id, t.label.nl]));
const L = (id: string) => getActivity(id)?.label.nl ?? id;

const scenarios = [
  { key: "A", name: "Marijke (Zwolle, voor zichzelf)", ctx: "self", age: "", loc: "Zwolle", km: 25, budget: "25", time: "halfday", company: ["partner"],
    cards: ["place-reading-room","sense-old-book","place-still-water","moment-stillness","sense-candlelight","place-forest-edge"], mustHaves: "", seed: "wp-A" },
  { key: "B", name: "Ouder zoekt voor Sam (kind, Utrecht)", ctx: "child", age: "", loc: "Utrecht", km: 15, budget: "25", time: "halfday", company: ["family"],
    cards: ["moment-laughing","place-barn-animals","moment-clay","sense-wind","place-fab-lab","moment-start"], mustHaves: "", seed: "wp-B" },
  { key: "C", name: "Vriendengroep (6 pers., Eindhoven)", ctx: "group", age: "", loc: "Eindhoven", km: 25, budget: "50", time: "fullday", company: ["friends"],
    cards: ["place-arena-lights","moment-scoreboard","place-clue-wall","moment-puzzle-solved-together","place-race-circuit","sense-dice-clatter"], mustHaves: "Met een groep", seed: "wp-C" },
];

const month = 11;
const out: any[] = [];
for (const s of scenarios) {
  const lib = buildAssociationLibrary("nl", month);
  const registered = lib.cards.map((c) => ({ ...c, register: c.register! }));
  const prof = tagProfile(ASSOCIATIONS as any, s.cards);
  const axes = averageAxes(ASSOCIATIONS as any, s.cards);
  const dials = deriveDials(axes, true);
  const pool = buildConcretePool("nl", month);
  const mix = registerMix(s.cards.map((id) => ({ register: registerOfCard(ASSOCIATIONS.find((c: any) => c.id === id) as any) })) as any);
  const slots = composeConcretePage(pool.activities as any, {
    seed: s.seed, profile: prof, axes, genericTags: new Set(pool.genericTags), mix,
    prefer: (a: any) => 0.5 + activityContextLean(a.tags, s.ctx),
  });
  // the "person" picks the 4 matched slots closest to the images + 1 exploring slot
  const gen = new Set(pool.genericTags);
  const close = (a: any) => a.tags.reduce((x: number, t: string) => x + (prof[t] ?? 0) * (gen.has(t) ? 0.5 : 1), 0) / Math.sqrt(a.tags.length);
  const matched = slots.filter((x) => !x.explore).sort((a, b) => close(b.activity) - close(a.activity)).slice(0, 4);
  const explore = slots.filter((x) => x.explore).slice(0, 1);
  const picks = [...matched, ...explore].map((x) => x.activity.id);
  const stored: any = {
    situation: "", purpose: "self", purposeFollowUp: "", ageCategory: s.age, location: s.loc, searchDistance: "city", searchDistanceKm: s.km,
    freeTimePattern: "", practicalToWild: "either", timeAvailable: s.time, budget: s.budget, effort: "some", solutionTypes: ["activity"],
    mustHaves: s.mustHaves, preferences: "", company: s.company, personalReflection: "", interests: picks, interestDomains: [], socialFormats: [],
    intakeVariant: "associations", intakeFlow: "images2", associations: s.cards, associationCorrections: [], searchContext: s.ctx, locale: "nl",
  };
  const applied = applyImageIntake(stored, "nl", s.seed, month);
  const res = runEngine(engineInputFromIntake(applied, { seed: s.seed, month }), { weights: WEIGHTS_ANCHOR });
  out.push({
    key: s.key, name: s.name, time: s.time, context: s.ctx, location: s.loc, km: s.km, budget: s.budget,
    cards: s.cards.map((id) => ASSOCIATIONS.find((c: any) => c.id === id)!.label.nl),
    topTags: Object.entries(prof).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, w]) => `${tagLabel.get(t)}:${w.toFixed(1)}`),
    axes: Object.fromEntries(Object.entries(axes).map(([k, v]) => [k, +(v as number).toFixed(2)])),
    dials: { practicalToWild: applied.practicalToWild, effort: applied.effort },
    mix: mix.counts,
    page2: slots.map((x) => `${x.explore ? "*" : ""}${x.activity.label}`),
    picks: picks.map(L),
    audience: applied.audienceProfile && { interests: applied.audienceProfile.interests, orientation: applied.audienceProfile.orientation, breadth: +applied.audienceProfile.breadth.toFixed(2), audience: applied.audienceProfile.audience },
    constraints: { costCap: res.constraints.costCap, intensityCap: res.constraints.intensityCap, hideSupervised: res.constraints.hideSupervised, formats: res.constraints.formats, minorSafe: res.constraints.minorSafe, meetPeople: res.constraints.meetPeople, verify: res.constraints.verify },
    notes: res.notes,
    seeds: res.seeds.map((sd) => ({
      activity: L(sd.activityId), id: sd.activityId, direction: sd.direction, door: sd.door, level: sd.level ? `${sd.level} ${levelName(sd.level as any, "nl")}` : null,
      chain: sd.chain.map(L), via: sd.via.map((t) => tagLabel.get(t) ?? t), hybrid: sd.hybrid?.label.nl ?? null,
      fit: sd.fit !== undefined ? +sd.fit.toFixed(2) : null, reasons: sd.reasons, verify: sd.verify, domain: getActivity(sd.activityId)!.domain,
      cost: getActivity(sd.activityId)!.cost, supply: getActivity(sd.activityId)!.supply ?? "-", entry: getActivity(sd.activityId)!.entry?.nl,
    })),
  });
}
console.log(JSON.stringify(out, null, 1));
