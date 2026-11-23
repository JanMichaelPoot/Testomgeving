import { describe, expect, it } from "vitest";
import { buildSearchBrief, type BriefCopy } from "@/lib/searchBrief";
import { vensterEn, vensterNl } from "@/lib/i18n/venster";

const nl = vensterNl.brief as BriefCopy;
const en = vensterEn.brief as BriefCopy;
const row = (b: ReturnType<typeof buildSearchBrief>, id: string) => b.rows.find((r) => r.id === id)!;

const base = { searchContext: "self", location: "Utrecht, Utrecht", countryName: "Nederland", distanceKm: 15, timeLabel: "Een halve dag", budgetLabel: "Tot €50 per persoon", limits: ["Met de rolstoel bereikbaar", "Zonder alcohol"], picks: ["Pottenbakken", "High tea"] };

describe("the search profile", () => {
  it("gathers who, where and how far, time, budget, what to keep in mind and the choices, in that order", () => {
    const b = buildSearchBrief(base, nl);
    expect(b.rows.map((r) => r.id)).toEqual(["who", "where", "time", "budget", "limits", "picks"]);
    expect(row(b, "who").value).toBe("Voor mezelf");
    expect(row(b, "where")).toMatchObject({ value: "Utrecht, Nederland", detail: "Binnen 15 km" });
    expect(row(b, "time").value).toBe("Een halve dag");
    expect(row(b, "budget").value).toBe("Tot €50 per persoon");
    expect(row(b, "limits").items).toEqual(["Met de rolstoel bereikbaar", "Zonder alcohol"]);
    expect(row(b, "picks").items).toEqual(["Pottenbakken", "High tea"]);
    expect(b.foot).toBe("We zoeken naar echte plekken binnen 15 km van Utrecht.");
  });

  it("says who it is for, with or without a name, and for a group", () => {
    expect(row(buildSearchBrief({ ...base, searchContext: "adult", recipientName: "Emma" }, nl), "who").value).toBe("Voor Emma");
    expect(row(buildSearchBrief({ ...base, searchContext: "adult" }, nl), "who").value).toBe("Voor iemand anders");
    expect(row(buildSearchBrief({ ...base, searchContext: "child", recipientName: "Noor" }, nl), "who").value).toBe("Voor Noor (kind)");
    expect(row(buildSearchBrief({ ...base, searchContext: "child" }, nl), "who").value).toBe("Voor een kind");
    expect(row(buildSearchBrief({ ...base, searchContext: "group", recipientName: "ignored" }, nl), "who").value).toBe("Voor een groep");
    expect(row(buildSearchBrief({ ...base, searchContext: "" }, nl), "who").value).toBe("Voor mezelf");
  });

  it("shows what was left open as a soft line, not as a choice", () => {
    const b = buildSearchBrief({ ...base, timeLabel: "", budgetLabel: "", limits: [], picks: [] }, nl);
    expect(row(b, "time")).toMatchObject({ value: "Niet opgegeven", empty: true });
    expect(row(b, "budget")).toMatchObject({ value: "Maakt niet uit", empty: true });
    expect(row(b, "limits")).toMatchObject({ value: "Geen bijzonderheden", empty: true });
    expect(row(b, "picks")).toMatchObject({ value: "Nog niets gekozen", empty: true });
    expect(row(buildSearchBrief({ ...base, picks: [], surpriseMe: true }, nl), "picks").value).toBe("Jij laat je verrassen");
  });

  it("words a far radius and a missing one without a number", () => {
    const wide = buildSearchBrief({ ...base, distanceKm: 150 }, nl);
    expect(row(wide, "where").detail).toBe("Meer dan 100 km");
    expect(wide.foot).toBe("We zoeken naar echte plekken in een groot gebied rond Utrecht.");
    const none = buildSearchBrief({ ...base, distanceKm: undefined }, nl);
    expect(row(none, "where").detail).toBeUndefined();
    expect(none.foot).toBe("We zoeken naar echte plekken in een groot gebied rond Utrecht.");
  });

  it("shows a place of another country with its country, the way the person typed it, and no foot without a place", () => {
    const b = buildSearchBrief({ ...base, location: "Laren, Laren, Noord-Holland", countryName: "Nederland" }, nl);
    expect(row(b, "where").value).toBe("Laren, Noord-Holland, Nederland");
    expect(b.foot).toBe("We zoeken naar echte plekken binnen 15 km van Laren.");
    const empty = buildSearchBrief({ ...base, location: "", countryName: "" }, nl);
    expect(row(empty, "where").value).toBe("-");
    expect(empty.foot).toBe("");
  });

  it("is written in English too, with the same rows", () => {
    const b = buildSearchBrief({ ...base, timeLabel: "Half a day", budgetLabel: "Up to €50 per person", limits: ["Step-free access"], picks: ["Pottery"], searchContext: "adult", recipientName: "Emma" }, en);
    expect(row(b, "who").value).toBe("For Emma");
    expect(row(b, "where").detail).toBe("Within 15 km");
    expect(b.foot).toBe("We search for real places within 15 km of Utrecht.");
    expect(en.rows.limits).toBe("Conditions");
    expect(Object.keys(en)).toEqual(Object.keys(nl));
  });
});

describe("the conditions that follow from who it is for", () => {
  it("adds them next to what the person ticked, and says nothing for someone who searches for themselves", () => {
    const child = buildSearchBrief({ ...base, searchContext: "child", limits: [] }, nl);
    expect(row(child, "limits")).toMatchObject({ items: ["Alleen wat geschikt is voor kinderen"] });
    expect(row(child, "limits").empty).toBeUndefined();
    const group = buildSearchBrief({ ...base, searchContext: "group", limits: ["Zonder alcohol"] }, nl);
    expect(row(group, "limits").items).toEqual(["Het liefst samen te doen", "Zonder alcohol"]);
    expect(row(buildSearchBrief({ ...base, searchContext: "self", limits: [] }, nl), "limits")).toMatchObject({ value: "Geen bijzonderheden", empty: true });
    expect(row(buildSearchBrief({ ...base, searchContext: "child", limits: [] }, en), "limits").items).toEqual(["Only what suits children"]);
  });
});
