import type { CharacterDimensions, CharacterProfile } from "@/lib/characterProfile";
import type { Locale } from "@/lib/locale";

// Fase 4 (New Result Experience) — the "Discovery Profile" screen in the
// Idea Book. Translates the internal 0-100 dimensions from
// characterProfile.ts into a handful of warm, specific reflection lines —
// never the raw numbers themselves. See the doc comment on CharacterProfile:
// the master prompt explicitly warns against rigid labels ("Jij bent een
// avonturier") — this is the "zachte, speelse taal" translation it asks for.
//
// Only the most distinctive dimensions are voiced (furthest from the 50
// neutral midpoint), and never more than a few at once — voicing all five
// every time would read as a personality-test stat sheet instead of a
// considered "we've been paying attention" reflection. A profile with no
// distinctive dimensions (short/neutral answers) gets no forced lines here;
// the caller falls back to a generic closing line instead.

type Axis = keyof CharacterDimensions | "challengeLevel";

const DISTINCTIVE_THRESHOLD = 14;
const MAX_LINES = 3;

const PHRASES: Record<Locale, Record<Axis, { high: string; low: string }>> = {
  nl: {
    curiosity: {
      high: "Je trekt makkelijk naar iets nieuws — een onbekend idee hoeft je niet lang over te halen.",
      low: "Je weet wat je fijn vindt, en daar hoef je niet per se van af te wijken.",
    },
    spontaneity: {
      high: "Een plan mag best ter plekke ontstaan — jij hoeft niet alles van tevoren te weten.",
      low: "Je houdt ervan te weten waar je aan toe bent voordat je ergens instapt.",
    },
    socialEnergy: {
      high: "Dingen sámen doen geeft je net dat beetje extra energie.",
      low: "Je geniet minstens zo goed van je eigen gezelschap.",
    },
    needForStructure: {
      high: "Een duidelijk kader helpt je om ergens ook echt aan te beginnen.",
      low: "Te veel structuur werkt bij jou eerder averechts — ruimte werkt beter.",
    },
    challengeLevel: {
      high: "Je gaf zelf aan dat je best een duwtje voorbij je comfortzone wilt.",
      low: "We hebben je mogelijkheden dicht bij het vertrouwde gehouden — met een enkele uitzondering.",
    },
  },
  en: {
    curiosity: {
      high: "You lean toward something new easily — an unfamiliar idea doesn't need much convincing.",
      low: "You know what you like, and you don't need to stray from it to have a good time.",
    },
    spontaneity: {
      high: "A plan can take shape on the spot — you don't need to know everything in advance.",
      low: "You like knowing what you're getting into before you commit to something.",
    },
    socialEnergy: {
      high: "Doing things together gives you that extra bit of energy.",
      low: "You enjoy your own company at least as much.",
    },
    needForStructure: {
      high: "A clear frame actually helps you get started on something.",
      low: "Too much structure tends to work against you — room to breathe works better.",
    },
    challengeLevel: {
      high: "You told us you're up for a nudge past your comfort zone.",
      low: "We kept your possibilities close to what already feels familiar — with one exception.",
    },
  },
};

// Returns up to MAX_LINES short reflection sentences, most-distinctive
// dimension first — or an empty array if nothing about this profile stood
// out enough to be worth naming.
export function describeDiscoveryProfile(character: CharacterProfile, locale: Locale): string[] {
  const values: Record<Axis, number> = {
    ...character.dimensions,
    challengeLevel: character.challengeLevel,
  };

  const distinctive = (Object.keys(values) as Axis[])
    .map((axis) => ({ axis, value: values[axis], distance: Math.abs(values[axis] - 50) }))
    // Never voice a social-energy line: it is no longer derived (see characterProfile.ts)
    // and a reflection like "you enjoy your own company" would be a label, not something they said.
    .filter((entry) => entry.axis !== "socialEnergy")
    .filter((entry) => entry.distance >= DISTINCTIVE_THRESHOLD)
    .sort((a, b) => b.distance - a.distance)
    .slice(0, MAX_LINES);

  const phrases = PHRASES[locale];
  return distinctive.map(({ axis, value }) => (value >= 50 ? phrases[axis].high : phrases[axis].low));
}
