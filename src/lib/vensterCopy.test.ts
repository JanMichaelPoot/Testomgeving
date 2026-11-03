import { describe, expect, it } from "vitest";
import { fillName, resolveVariant } from "@/lib/recipientName";
import { vensterEn, vensterNl, type VensterDictionary } from "@/lib/i18n/venster";
import { parseMustHaves } from "@/lib/discovery/engine/constraints";

// R1.1: the first group of images is called "direction" (Richting / Direction), not "worlds",
// everywhere the person sees it. The internal names (interestDomains, dict.worlds, ...) stay.

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const both: [string, VensterDictionary][] = [
  ["nl", vensterNl],
  ["en", vensterEn],
];

describe("image intake copy (R1.1)", () => {
  for (const [name, dict] of both) {
    it(`${name}: no visible text calls the directions "worlds"`, () => {
      const hits = strings(dict).filter((t) => /wereld|world/i.test(t));
      expect(hits).toEqual([]);
    });

    it(`${name}: the stepper and the pane labels follow the agreed names`, () => {
      expect(Object.values(dict.chapters)).toHaveLength(3);
      expect(dict.panes.worlds).toBe(name === "nl" ? "Richting" : "Direction");
      expect(dict.panes.places).toBe(name === "nl" ? "Plek" : "Place");
      expect(dict.panes.moments).toBe("Moment");
      expect(dict.panes.senses).toBe(name === "nl" ? "Zintuig" : "Sense");
    });

    it(`${name}: every screen that has a gift heading keeps {name} in it`, () => {
      for (const heading of [
        dict.worlds.headingGift,
        dict.rounds.places.headingGift,
        dict.rounds.moments.headingGift,
        dict.rounds.senses.headingGift,
        dict.profile.headingGift,
        dict.situation.headingGift,
      ]) {
        expect(heading).toContain("{name}");
      }
    });

    it(`${name}: the self headings never talk about someone else`, () => {
      for (const heading of [dict.worlds.heading, dict.rounds.moments.heading, dict.profile.heading, dict.situation.heading]) {
        expect(heading).not.toContain("{name}");
      }
    });
  }

  for (const [name, dict] of both) {
    it(`${name}: the budget question already covers "free", so there is no such hard limit chip`, () => {
      expect(dict.who.limitChips.filter((c) => /gratis|free/i.test(c))).toEqual([]);
    });
  }

  it("does not read a typed wish for something free as a filter either (Fase 3): price is a fact about an activity", () => {
    expect(parseMustHaves("Het moet gratis zijn")).not.toHaveProperty("free");
    expect(parseMustHaves("must be free of charge")).not.toHaveProperty("free");
  });

  it("has the same shape in nl and en", () => {
    const shape = (v: unknown): unknown =>
      Array.isArray(v) ? v.map(shape) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
    expect(shape(vensterEn)).toEqual(shape(vensterNl));
  });
});

describe("no hidden 'more options' on the intake", () => {
  it("has no 'Meer opgeven' / 'More options' copy and no age, 'how' or free-text questions left in the venster dictionary", () => {
    for (const locale of ["nl", "en"] as const) {
      const json = JSON.stringify(locale === "nl" ? vensterNl : vensterEn);
      expect(json, locale).not.toMatch(/Meer opgeven|More options|Provide more|howOptions|ageLabel|limitsPlaceholder/);
    }
  });
});

describe("the voice of the intake (Step 136)", () => {
  const dicts = { nl: vensterNl, en: vensterEn } as const;
  const text = (v: VensterDictionary) => JSON.stringify({ start: v.start, room: v.room, twoPages: v.twoPages, profile: v.profile, nav: v.nav });

  it("never names an age bracket as a label and never uses the clinical words", () => {
    for (const locale of ["nl", "en"] as const) {
      const json = JSON.stringify(dicts[locale]);
      expect(json, locale).not.toMatch(/oudere\b|older person|\bsenior\b/i);
    }
    expect(text(vensterNl)).not.toMatch(/Randvoorwaarden|doelgroep|vaststellen|tegenspraak|Wat moet kloppen|Zo kijken wij|het kind\b|de ander\b/i);
    expect(text(vensterEn)).not.toMatch(/Conditions|target group|no contradiction|How we look through|the child\b/i);
  });

  it("writes the portrait's motifs without 'you', so they fit 'Je houdt van …' and '{name} houdt van …' alike", () => {
    for (const v of Object.values(vensterNl.profile.motifs)) expect(v).not.toMatch(/\b(je|jou|jouw|jullie)\b/i);
    for (const v of Object.values(vensterEn.profile.motifs)) expect(v).not.toMatch(/\b(you|your|yours)\b/i);
  });

  it("gives every text of the two-page flow that names the person a variant that does not", () => {
    for (const locale of ["nl", "en"] as const) {
      const v = dicts[locale];
      const keys: [string, string][] = [
        ["room.locationLabelGift", v.room.locationLabelGift],
        ["who.companyLabelGift", v.who.companyLabelGift],
        ["images.headingGift", v.twoPages.images.headingGift],
        ["images.subGift", v.twoPages.images.subGift],
        ["concrete.headingGift", v.twoPages.concrete.headingGift],
        ["concrete.subGift", v.twoPages.concrete.subGift],
        ["profile.headingGift", v.profile.headingGift],
        ["profile.headlineGift", v.profile.headlineGift],
        ["profile.headlineOneGift", v.profile.headlineOneGift],
        ["profile.picksLineGift", v.profile.picksLineGift],
        ["profile.openStoryGift", v.profile.openStoryGift],
        ["profile.openGift", v.profile.openGift],
        ["profile.missTitleGift", v.profile.missTitleGift],
        ["checkout.headingGift", v.checkout.headingGift],
        ...(["energy", "novelty", "social", "setting"] as const).map((k): [string, string] => [`tensionGift.${k}`, v.profile.tensionGift[k]]),
      ];
      for (const [key, value] of keys) {
        const parts = value.split("‖").map((p) => p.trim());
        expect(parts.length, `${locale} ${key}`).toBeGreaterThanOrEqual(2);
        expect(parts[0], `${locale} ${key} named`).toContain("{name}");
        for (const p of parts.slice(1)) expect(p, `${locale} ${key} without a name`).not.toContain("{name}");
      }
    }
  });

  it("resolves the variants: with a name, without one, and for a group", () => {
    const t = "Wat zou {name} aantrekken? ‖ Wat zou aanspreken? ‖ Wat spreekt jullie aan?";
    expect(resolveVariant(t, { name: "Emma" })).toBe("Wat zou {name} aantrekken?");
    expect(fillName(t, "Emma", { fallback: "de ontvanger" })).toBe("Wat zou Emma aantrekken?");
    expect(fillName(t, "", { fallback: "de ontvanger" })).toBe("Wat zou aanspreken?");
    expect(fillName(t, "", { group: true, fallback: "de ontvanger" })).toBe("Wat spreekt jullie aan?");
    // A group never uses a name; a text without a third part falls back to the one without a name.
    expect(fillName("{name} zoekt. ‖ Er wordt gezocht.", "", { group: true })).toBe("Er wordt gezocht.");
    // A text without variants keeps working, with the plain noun when there is no name.
    expect(fillName("Waar zou {name} nu willen zijn?", "", { fallback: "de ontvanger" })).toBe("Waar zou de ontvanger nu willen zijn?");
  });
});
