import { describe, expect, it, vi } from "vitest";
import type { LocalOption } from "@/lib/claude/localResearch";
import { PLACES_LIST_PRICE_USD, createRatingEnricher, matchPlace, outcomeFrom, type PlacesResult } from "@/lib/claude/placesRatings";

// Nothing here touches Google or the database: the fetch and the monthly counter are replaced.

const opt = (name: string, city = "Utrecht", extra: Partial<LocalOption> = {}): LocalOption => ({ name, city, url: `https://${name.toLowerCase().replace(/\W/g, "")}.nl`, note: "proefles", until: null, rating: null, ...extra });
const place = (name: string, rating: number | undefined, reviews = 120, city = "Utrecht", status = "OPERATIONAL"): PlacesResult => ({
  displayName: { text: name },
  formattedAddress: `Straat 1, 3511 AA ${city}, Nederland`,
  businessStatus: status,
  ...(rating === undefined ? {} : { rating, userRatingCount: reviews }),
});

/** A fetch that answers per query (the text sent is "<name> <city>") and records every request. */
function fakeFetch(answers: Record<string, PlacesResult[] | number>) {
  const calls: { body: Record<string, unknown>; headers: Record<string, string> }[] = [];
  const impl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({ body, headers: init?.headers as Record<string, string> });
    const a = answers[String(body.textQuery)];
    if (typeof a === "number") return new Response("{}", { status: a });
    return new Response(JSON.stringify({ places: a ?? [] }), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}
const allow = async (n: number) => n;

describe("matching a result to the option", () => {
  it("accepts the same place in the same town, also with another spelling or an added word", () => {
    expect(matchPlace({ name: "Klei Atelier", city: "Utrecht" }, [place("Klei Atelier Utrecht", 4.6)])).not.toBeNull();
    expect(matchPlace({ name: "Theehuis 't Bluk", city: "Laren" }, [place("Theehuis 't Bluk", 4.4, 90, "Laren")])).not.toBeNull();
    expect(matchPlace({ name: "Café De Kwekerij", city: "Utrecht" }, [place("De Kwekerij", 4.7)])).not.toBeNull();
  });

  it("refuses another place, or the same name in another town", () => {
    expect(matchPlace({ name: "Klei Atelier", city: "Utrecht" }, [place("Schaakclub Zuid", 4.9)])).toBeNull();
    expect(matchPlace({ name: "Klei Atelier", city: "Utrecht" }, [place("Klei Atelier", 4.9, 50, "Rotterdam")])).toBeNull();
  });

  it("turns an answer into a rating, a closed place or nothing", () => {
    expect(outcomeFrom({ name: "Klei Atelier", city: "Utrecht" }, [place("Klei Atelier", 4.6, 312)])).toEqual({ status: "found", rating: { score: 4.6, reviews: 312, source: "Google" } });
    expect(outcomeFrom({ name: "Klei Atelier", city: "Utrecht" }, [place("Klei Atelier", undefined)])).toEqual({ status: "found", rating: null });
    expect(outcomeFrom({ name: "Klei Atelier", city: "Utrecht" }, [place("Klei Atelier", 4.6, 40, "Utrecht", "CLOSED_PERMANENTLY")])).toEqual({ status: "closed" });
    expect(outcomeFrom({ name: "Klei Atelier", city: "Utrecht" }, [])).toEqual({ status: "nomatch" });
  });
});

describe("the enricher", () => {
  it("does nothing without a key: no request, the options as they were", async () => {
    const { impl } = fakeFetch({});
    const e = createRatingEnricher({ apiKey: "", counter: allow, fetchImpl: impl });
    const options = [opt("Klei Atelier")];
    expect(e.enabled).toBe(false);
    expect(await e.enrich(options)).toBe(options);
    expect(impl).not.toHaveBeenCalled();
  });

  it("sends only the place's name and town, asks for the rating fields and nothing else", async () => {
    const f = fakeFetch({ "Klei Atelier Utrecht": [place("Klei Atelier", 4.6, 312)] });
    const e = createRatingEnricher({ apiKey: "KEY", counter: allow, fetchImpl: f.impl });
    await e.enrich([opt("Klei Atelier")], { country: "NL", locale: "nl" });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].body).toEqual({ textQuery: "Klei Atelier Utrecht", languageCode: "nl", regionCode: "NL", pageSize: 3 });
    expect(f.calls[0].headers["X-Goog-FieldMask"]).toBe("places.id,places.displayName,places.formattedAddress,places.businessStatus,places.rating,places.userRatingCount");
    expect(f.calls[0].headers["X-Goog-Api-Key"]).toBe("KEY");
  });

  it("adds the score, marks the place as looked up and stops when the first is good enough", async () => {
    const f = fakeFetch({ "Klei Atelier Utrecht": [place("Klei Atelier", 4.7, 200)], "Draaischijf Utrecht": [place("Draaischijf", 4.9, 300)] });
    const e = createRatingEnricher({ apiKey: "KEY", counter: allow, fetchImpl: f.impl });
    const out = await e.enrich([opt("Klei Atelier"), opt("Draaischijf")]);
    expect(f.calls).toHaveLength(1); // the second is not looked up: 4.7 from 200 reviews is enough
    expect(out.find((o) => o.name === "Klei Atelier")).toMatchObject({ rating: { score: 4.7, reviews: 200, source: "Google" }, ratingChecked: true });
    expect(e.stats()).toMatchObject({ lookups: 1, rated: 1 });
  });

  it("looks up a second option when the first is not good enough, and ranks again", async () => {
    const f = fakeFetch({ "Klei Atelier Utrecht": [place("Klei Atelier", 3.4, 80)], "Draaischijf Utrecht": [place("Draaischijf", 4.8, 150)] });
    const e = createRatingEnricher({ apiKey: "KEY", counter: allow, fetchImpl: f.impl });
    const out = await e.enrich([opt("Klei Atelier"), opt("Draaischijf"), opt("Derde")]);
    expect(f.calls).toHaveLength(2); // never more than two for one activity
    expect(out.map((o) => o.name)).toEqual(["Draaischijf", "Derde"]); // the 3.4 gives way to the 4.8; the unrated stays
  });

  it("skips what needs no lookup: a known score, a place looked up before, an online provider", async () => {
    const f = fakeFetch({});
    const e = createRatingEnricher({ apiKey: "KEY", counter: allow, fetchImpl: f.impl });
    const options = [
      opt("Bekend", "Utrecht", { rating: { score: 3.9, reviews: 50, source: "Tripadvisor" } }),
      opt("Eerder", "Utrecht", { ratingChecked: true }),
      opt("Cursus", "Online"),
    ];
    await e.enrich(options);
    expect(f.impl).not.toHaveBeenCalled();
  });

  it("drops a place that Google says is closed for good", async () => {
    const f = fakeFetch({ "Oud Atelier Utrecht": [place("Oud Atelier", 4.5, 90, "Utrecht", "CLOSED_PERMANENTLY")] });
    const e = createRatingEnricher({ apiKey: "KEY", counter: allow, fetchImpl: f.impl });
    const out = await e.enrich([opt("Oud Atelier"), opt("Nieuw Atelier")]);
    expect(out.map((o) => o.name)).toEqual(["Nieuw Atelier"]);
    expect(e.stats().closed).toBe(1);
  });

  it("makes no lookup when the month's allowance is used up, and says so", async () => {
    const f = fakeFetch({ "Klei Atelier Utrecht": [place("Klei Atelier", 4.7, 200)] });
    const e = createRatingEnricher({ apiKey: "KEY", counter: async () => 0, fetchImpl: f.impl });
    const options = [opt("Klei Atelier")];
    const out = await e.enrich(options);
    expect(f.impl).not.toHaveBeenCalled();
    expect(out[0].rating).toBeNull();
    expect(e.stats()).toMatchObject({ lookups: 0, limited: true });
    expect(e.summary()).toBe("");
  });

  it("holds to its cap for the book, also when activities are looked up side by side", async () => {
    const answers = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`Atelier ${i} Utrecht`, [place(`Atelier ${i}`, 4.8, 100)]]));
    const f = fakeFetch(answers);
    const e = createRatingEnricher({ apiKey: "KEY", counter: allow, fetchImpl: f.impl, maxPerBook: 4 });
    await Promise.all(Array.from({ length: 6 }, (_, i) => e.enrich([opt(`Atelier ${i}`)])));
    expect(f.calls).toHaveLength(4);
    expect(e.stats().lookups).toBe(4);
  });

  it("leaves a place unmarked when the request fails, so it can be tried again later", async () => {
    const f = fakeFetch({ "Klei Atelier Utrecht": 500 });
    const e = createRatingEnricher({ apiKey: "KEY", counter: allow, fetchImpl: f.impl });
    const out = await e.enrich([opt("Klei Atelier")]);
    expect(out[0].ratingChecked).toBeUndefined();
    expect(out[0].rating).toBeNull();
  });

  it("reports its lookups for the cost meters at list price", async () => {
    const f = fakeFetch({ "Klei Atelier Utrecht": [place("Klei Atelier", 4.7, 200)] });
    const e = createRatingEnricher({ apiKey: "KEY", counter: allow, fetchImpl: f.impl });
    await e.enrich([opt("Klei Atelier")]);
    expect(e.summary()).toContain("google places ratings: 1 lookups");
    expect(e.summary()).toContain(`$${PLACES_LIST_PRICE_USD.toFixed(3)}`);
  });
});
