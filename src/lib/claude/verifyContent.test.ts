import { describe, expect, it } from "vitest";
import type { LocalOption } from "@/lib/claude/localResearch";
import { pageProblem, verifyOptionUrls, type Fetcher } from "@/lib/claude/verifyUrls";

// The content check: a living address is not yet an open venue.

const page = (body: string) => `<html><head><title>x</title><style>.a{}</style></head><body>${body}${" welkom bij ons ".repeat(40)}</body></html>`;
const O = (name: string, url: string): LocalOption => ({ name, city: "Madrid", url, note: "", until: null, rating: null });

describe("pageProblem", () => {
  it("sees a business that closed for good, in several languages", () => {
    expect(pageProblem(page("<h1>Madrid SnowZone</h1> This location is permanently closed."), "Madrid SnowZone")).toBe("site_says_closed");
    expect(pageProblem(page("Steck Utrecht is definitief gesloten"), "Steck Utrecht")).toBe("site_says_closed");
    expect(pageProblem(page("Pista de esquí: cerrado definitivamente"), "Pista de esquí")).toBe("site_says_closed");
    expect(pageProblem(page("Das Studio ist dauerhaft geschlossen"), "Das Studio")).toBe("site_says_closed");
    expect(pageProblem(page("Le club est fermé définitivement"), "Le club")).toBe("site_says_closed");
  });

  it("sees a parked or for-sale domain", () => {
    expect(pageProblem(page("Buy this domain today"), "Ski Hal")).toBe("parked_domain");
    expect(pageProblem(page("Dit domein is te koop"), "Ski Hal")).toBe("parked_domain");
  });

  it("drops a page about something else, but only a real page and only when no word of the name occurs", () => {
    expect(pageProblem(page("Lekkere pizza en pasta in het centrum"), "Skihal Snowworld")).toBe("name_not_on_site");
    expect(pageProblem(page("Snowworld: skiën en snowboarden"), "Skihal Snowworld")).toBeNull();
    expect(pageProblem("<html><body>Welkom</body></html>", "Skihal Snowworld")).toBeNull(); // too small to judge
    expect(pageProblem(page("alles over de club"), "Club")).toBeNull(); // only filler words in the name: nothing to test
  });

  it("does not take a word inside a script or style for page text", () => {
    expect(pageProblem(page('<script>var s = "permanently closed";</script>Snowworld'), "Snowworld")).toBeNull();
  });
});

describe("verifyOptionUrls with the content check", () => {
  const pages = (answers: Record<string, { status: number; body?: string; location?: string }>): Fetcher =>
    (async (url: string) => {
      const a = answers[url];
      if (!a) throw new Error(`unexpected request to ${url}`);
      return { status: a.status, location: a.location, text: async () => a.body ?? "" };
    }) as Fetcher;

  it("drops a site that says it closed, a parked domain and a page about something else; keeps the living one", async () => {
    const f = pages({
      "https://dood.es/": { status: 200, body: page("Cerrado definitivamente") },
      "https://geparkeerd.nl/": { status: 200, body: page("Buy this domain") },
      "https://anders.nl/": { status: 200, body: page("Alles over tuinmeubelen en kussens") },
      "https://leeft.nl/": { status: 200, body: page("Snowworld Zoetermeer: skiën en snowboarden") },
    });
    const r = await verifyOptionUrls(
      [O("Madrid Xanadú", "https://dood.es/"), O("Skihal Snowworld", "https://geparkeerd.nl/"), O("Skihal Snowworld", "https://anders.nl/"), O("Snowworld", "https://leeft.nl/")],
      f,
      1000,
      { content: true },
    );
    expect(r.dropped.map((d) => d.reason)).toEqual(["site_says_closed", "parked_domain", "name_not_on_site"]);
    expect(r.kept.map((o) => o.url)).toEqual(["https://leeft.nl/"]);
  });

  it("cannot judge a blocked or unreadable page, so it stays", async () => {
    const f = pages({ "https://a.nl/": { status: 403 }, "https://b.nl/": { status: 200, body: "" } });
    const r = await verifyOptionUrls([O("A", "https://a.nl/"), O("Snowworld", "https://b.nl/")], f, 1000, { content: true });
    expect(r.kept).toHaveLength(2);
  });

  it("follows a redirect within the same site only (http to https, with or without www)", async () => {
    const f = pages({
      "http://club.nl/": { status: 301, location: "https://www.club.nl/" },
      "https://www.club.nl/": { status: 200, body: page("Welkom bij Club Pottenbakkerij, permanently closed") },
      "https://elders.nl/": { status: 302, location: "http://169.254.169.254/latest" },
    });
    const r = await verifyOptionUrls([O("Pottenbakkerij", "http://club.nl/"), O("Elders", "https://elders.nl/")], f, 1000, { content: true });
    expect(r.dropped.map((d) => [d.option.name, d.reason])).toEqual([["Pottenbakkerij", "site_says_closed"]]);
    expect(r.kept.map((o) => o.name)).toEqual(["Elders"]); // the redirect was not followed (and not judged)
  });

  it("falls back to the front page when the page is gone, and judges that", async () => {
    const f = pages({ "https://x.nl/oud": { status: 404 }, "https://x.nl/": { status: 200, body: page("Snowworld is permanently closed") } });
    const r = await verifyOptionUrls([O("Snowworld", "https://x.nl/oud")], f, 1000, { content: true });
    expect(r.dropped[0].reason).toBe("site_says_closed");
  });
});
