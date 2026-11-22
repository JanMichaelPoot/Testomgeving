// B5 (docs/plan-activiteitenselectie.md): a local, free audit of the activity library. Rules that find what a reader of one line would find:
// a facet that contradicts the text, a risky activity without a safety tier, a price or a brand in an entry tip, people in a photo scene, a name that
// occurs twice. It prints findings per rule and writes nothing. A finding is a question for a human, not always an error.
//   npx tsx scripts/audit-library.ts            all rules
//   npx tsx scripts/audit-library.ts --dump     one compact line per activity, per domain (for reading a world in one go)
import { ALL_ACTIVITIES } from "../src/lib/discovery/library";
import type { Activity } from "../src/lib/discovery/types";

const live = ALL_ACTIVITIES.filter((a) => a.status !== "retired");

if (process.argv.includes("--dump")) {
  const by = new Map<string, Activity[]>();
  for (const a of live) (by.get(a.domain) ?? by.set(a.domain, []).get(a.domain)!).push(a);
  const dom = process.argv[process.argv.indexOf("--dump") + 1];
  for (const [d, list] of by) {
    if (dom && !dom.startsWith("--") && dom !== d) continue;
    console.log(`\n## ${d} (${list.length})`);
    for (const a of list) {
      console.log(
        `${a.id} | ${a.label.nl} | I${a.intensity ?? "?"} L${a.level ?? "?"} C${a.cost ?? "?"} D${a.duration ?? "?"} ${a.setting ?? "?"} T${a.safety.tier} ${a.supply ?? "common"}${a.months ? ` m${a.months[0]}-${a.months[a.months.length - 1]}` : ""} ${(a.formats ?? []).map((f) => f[0] + f[1]).join("")} | ${a.entry?.nl ?? "-"}`,
      );
    }
  }
  process.exit(0);
}

type Finding = { rule: string; id: string; note: string };
const findings: Finding[] = [];
const add = (rule: string, a: Activity, note: string) => findings.push({ rule, id: a.id, note });

const RISKY = /duik|klim|vrije-val|bungee|parachute|paraglid|schiet|bijl|mes-|meswerpen|smeden|lassen|kettingzaag|abseil|zweefvlieg|deltavlieg|motor|karten|jetski|kitesurf|canyoning|wildwater|via-ferrata|klifduik|freediv|zip|tokkel|helikopter|ballonvaart|skihal|paardrijden|rugby|vechtsport|boksles|jacht|speerwerp|kruisboog|boogschiet|katapult|blaaspijp|paintball|ijsbaden|koud-water|floattank|sauna|vuur|glasblaz|metaalgiet|raku|steenhouw|houthakken/;
const WATER_SEASON = /zwemmen$|open-water|natuurbad|suppen|snorkel|kitesurf|wakeboard|surfles|windsurf|strand|wadlopen|ijsbaden|schaats|langlauf|sneeuw|skihal|kamperen|tarp|boomhut-nacht|dauwtrappen|hertenbronst|bollenvelden|lammetjesdag|bloembollen/;
const PEOPLE_IN_SCENE = /\b(person|people|man|men|woman|women|child|children|kid|kids|hand|hands|face|faces|couple|friends|crowd|girl|boy|dancer|dancers|player|players|musician|musicians|student|students|worker|workers)\b/i;
const PRICE_OR_BRAND = /€|\beuro\b|\d+\s?(euro|eur)\b|www\.|https?:|\.nl\b|\.com\b|\b\d{2,3}[- ]?\d{6,}\b|decathlon|bol\.com|hema\b|ikea|action\b|marktplaats|facebook|instagram|youtube|tiktok|meetup|eventbrite|strava|duolingo|netflix|spotify/i;
const FREE_WORDS = /\bgratis\b|\bkosteloos\b|\bvoor niets\b/i;
const PAID_WORDS = /\bkost\b|\bkosten\b|\bduur\b|\bbetaal|\bprijs/i;

for (const a of live) {
  // Missing or blank text.
  for (const [k, v] of [["label.nl", a.label.nl], ["label.en", a.label.en], ["entry.nl", a.entry?.nl], ["entry.en", a.entry?.en]] as const) {
    if (!v || !v.trim()) add("empty text", a, k);
  }
  if (a.label.nl === a.label.en && a.label.nl.length > 14) add("label identical in nl and en", a, a.label.nl);
  if (a.entry && a.entry.nl.length > 170) add("entry tip over 170 characters", a, String(a.entry.nl.length));
  if (a.entry && a.entry.nl.length < 25) add("entry tip very short", a, a.entry.nl);

  // Unknown facets.
  const nulls = (["intensity", "level", "cost", "duration", "setting"] as const).filter((k) => a[k] === null);
  if (nulls.length) add("unknown facet", a, nulls.join(","));
  if (a.formats === null) add("unknown facet", a, "formats");

  // Risk without a safety tier.
  if (RISKY.test(a.id) && a.safety.tier === 0) add("risky id with safety tier 0", a, a.id);
  if (a.safety.tier === 2 && !a.safety.note) add("tier 2 without note", a, "");
  if (a.intensity === 3 && a.safety.tier === 0) add("heavy intensity with safety tier 0", a, "");

  // Facets against each other.
  if (a.intensity === 0 && a.level === 2) add("calm but advanced", a, "");
  if (a.cost === 0 && a.entry && PAID_WORDS.test(a.entry.nl) && !FREE_WORDS.test(a.entry.nl)) add("cost 0 but the tip talks about cost", a, a.entry.nl);
  if (a.cost !== null && a.cost >= 2 && a.entry && FREE_WORDS.test(a.entry.nl)) add("cost 2-3 but the tip says free", a, a.entry.nl);
  if (a.duration === 1 && a.setting === "outdoor" && /dag|weekend|tocht/i.test(a.label.nl)) add("duration under an hour but a day/trip word in the name", a, a.label.nl);
  if (a.duration === 4 && a.cost === 0 && a.level === 0 && a.intensity === 0) add("multi-day, free, calm, beginner (check duration)", a, "");
  if (a.supply === "rare" && a.cost === 0) add("rare supply but free", a, "");
  if (a.formats && a.formats.length === 1 && a.formats[0] === "online" && a.setting && a.setting !== "indoor") add("online only but not indoor", a, "");
  if (WATER_SEASON.test(a.id) && !a.months) add("seasonal activity without months", a, a.id);
  if (a.months && a.months.length >= 11) add("months listed for (nearly) all year", a, a.months.join(","));
  if (a.setting === "indoor" && a.months && !/schaats|ski|langlauf/.test(a.id)) add("indoor but with months", a, a.months.join(","));

  // Text that invents or dates.
  if (a.entry && PRICE_OR_BRAND.test(a.entry.nl + " " + a.entry.en)) add("price, brand or address in the entry tip", a, a.entry.nl);
  if (PEOPLE_IN_SCENE.test(a.scene)) add("people or body parts in the photo scene", a, (a.scene.match(PEOPLE_IN_SCENE) ?? [""])[0]);
  if (a.scene.length < 40) add("photo scene very short", a, a.scene);
  if (a.tags.length < 2) add("fewer than two tags", a, a.tags.join(","));
}

// A name that occurs twice, or a name contained in another activity's name in the same sub-domain (a possible duplicate).
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const seen = new Map<string, Activity>();
for (const a of live) {
  const k = norm(a.label.nl);
  const prev = seen.get(k);
  if (prev) add("same Dutch name as another activity", a, `${prev.id}`);
  else seen.set(k, a);
}
for (const a of live) for (const b of live) {
  if (a.id >= b.id || a.sub !== b.sub) continue;
  const x = norm(a.label.en);
  const y = norm(b.label.en);
  if (x === y) add("same English name in one sub-domain", a, b.id);
}

const byRule = new Map<string, Finding[]>();
for (const f of findings) (byRule.get(f.rule) ?? byRule.set(f.rule, []).get(f.rule)!).push(f);
console.log(`${live.length} activities, ${findings.length} findings in ${byRule.size} rules\n`);
for (const [rule, list] of [...byRule].sort((x, y) => y[1].length - x[1].length)) {
  console.log(`### ${rule} (${list.length})`);
  for (const f of list.slice(0, 60)) console.log(`  ${f.id}${f.note ? `: ${f.note}` : ""}`);
  if (list.length > 60) console.log(`  ... ${list.length - 60} more`);
}
