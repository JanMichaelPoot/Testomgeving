// Fix round "plan links": addresses, reader fit, prices and the check of a finished book. No network: the pages are made up here.
import { describe, expect, it } from "vitest";
import { findWebAddresses, linkFor, normalizeUrl, addressesIn, brokenAddress } from "@/lib/links/normalizeUrl";
import { isChildFocused, judgeFit, type FitPolicy } from "@/lib/links/pageFit";
import { guardPrices, priceOnPages } from "@/lib/links/prices";
import { searchInstruction, verifyBook } from "@/lib/links/verifyBook";
import { checkPage, verifyOptionUrls, type Fetcher } from "@/lib/claude/verifyUrls";
import { rejectedBlock } from "@/lib/claude/localResearch";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";

type Fake = { status: number; html?: string; location?: string } | "timeout" | "dns";

/** A fetcher over a made-up web; unknown addresses answer 404. */
function web(pages: Record<string, Fake | Fake[]>): Fetcher & { asked: string[] } {
  const asked: string[] = [];
  const calls = new Map<string, number>();
  const fetcher = (async (url: string) => {
    asked.push(url);
    const slashed = url.endsWith("/") ? url : `${url}/`;
    let page = pages[url] ?? pages[slashed] ?? { status: 404 };
    if (Array.isArray(page)) {
      const n = calls.get(url) ?? 0;
      calls.set(url, n + 1);
      page = page[Math.min(n, page.length - 1)];
    }
    if (page === "timeout") throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    if (page === "dns") throw Object.assign(new Error("fetch failed"), { cause: { code: "ENOTFOUND" } });
    const { status, html = "", location } = page;
    return { status, location, text: async () => html };
  }) as unknown as Fetcher & { asked: string[] };
  fetcher.asked = asked;
  return fetcher;
}

const html = (lang: string, title: string, extra = "") => `<html lang="${lang}"><head><title>${title}</title>${extra}</head><body><h1>${title}</h1></body></html>`;
const NL: FitPolicy = { country: "NL", language: "nl", localVenue: false, adultsOnly: true };

describe("normalizeUrl", () => {
  it("makes a bare domain and an http address absolute https", () => {
    expect(normalizeUrl("escape-kit.com")).toBe("https://escape-kit.com");
    expect(normalizeUrl("https://escape-kit.com/")).toBe("https://escape-kit.com/");
    expect(normalizeUrl("www.example.nl/tijden.")).toBe("https://www.example.nl/tijden");
    expect(normalizeUrl("http://www.astronomie-basel.ch/")).toBe("https://www.astronomie-basel.ch/");
    expect(normalizeUrl("//cdn.example.com/a")).toBe("https://cdn.example.com/a");
  });

  it.each(["", "/plan/pdf", "./escape-kit.com", "?token=abc", "mailto:a@b.nl", "javascript:alert(1)", "file:///etc/passwd", "localhost:3000", "https://127.0.0.1/x", "https://intranet/x", "https://user:pw@example.com/", "twee woorden.nl", "https://abc.supabase.co/storage/v1/object/sign/window-plans/x"])(
    "refuses %s",
    (bad) => expect(normalizeUrl(bad)).toBeNull(),
  );
});

describe("web addresses in running text", () => {
  it("finds bare domains, also endings like .ch, and keeps the sentence's full stop out", () => {
    expect(findWebAddresses("Go to escape-kit.com and visit astronomie-basel.ch.").map((f) => [f.text, f.url])).toEqual([
      ["escape-kit.com", "https://escape-kit.com"],
      ["astronomie-basel.ch", "https://astronomie-basel.ch"],
    ]);
  });

  it("does not take abbreviations, e-mail addresses, file names or prices for addresses", () => {
    for (const text of ["o.a. bij e.g. de balie, p.p. €20.69", "Mail info@atelier.nl", "Open report.pdf in node.js", "Om 20.00 uur."]) expect(findWebAddresses(text), text).toEqual([]);
  });

  it("links a printed domain to the checked page of that website", () => {
    const [found] = findWebAddresses("Open escape-kit.com now.");
    expect(linkFor(found, ["https://escape-kit.com/en/escape-room-kit/"])).toBe("https://escape-kit.com/en/escape-room-kit/");
    expect(linkFor(found, ["https://other.nl/"])).toBe("https://escape-kit.com");
  });
});

describe("does a page fit the reader?", () => {
  it("offers the language version of a French front page (the escape-kit.com case)", () => {
    const page = { url: "https://escape-kit.com/", html: html("fr-FR", "#1 Escape Game à la maison", '<link rel="alternate" hreflang="en" href="https://escape-kit.com/en/">') };
    expect(judgeFit(page, NL)).toEqual({ problem: "wrong_language", better: "https://escape-kit.com/en/" });
  });

  it("refuses another country's website, by its ending or by its path", () => {
    expect(judgeFit({ url: "https://www.jouet.fr/", html: html("fr", "Jouets") }, NL).problem).toBe("foreign_country");
    expect(judgeFit({ url: "https://www.etsy.com/ch/market/escape", html: html("en", "Escape") }, NL).problem).toBe("foreign_country");
    expect(judgeFit({ url: "https://shop.example.com/nl-nl/p", html: html("nl", "Winkel") }, NL).problem).toBeNull();
  });

  it("accepts the local language for a venue in the reader's own country only", () => {
    const german = { url: "https://sternwarte.ch/", html: html("de", "Sternwarte") };
    const swiss: FitPolicy = { country: "CH", language: "en", localVenue: true, adultsOnly: true };
    expect(judgeFit(german, swiss).problem).toBeNull();
    expect(judgeFit(german, { ...swiss, localVenue: false }).problem).toBe("wrong_language");
  });

  it("refuses a page for children when the reader is an adult, not one that names adults too", () => {
    expect(isChildFocused(html("nl", "Kinderfeestje escaperoom"))).toBe(true);
    expect(isChildFocused(html("fr", "Escape game enfants, ados, adultes"))).toBe(false);
    const kids = { url: "https://club.nl/", html: html("nl", "Striptekenen voor kinderen") };
    expect(judgeFit(kids, NL).problem).toBe("child_focused");
    expect(judgeFit(kids, { ...NL, adultsOnly: false }).problem).toBeNull();
  });
});

describe("the strict link check", () => {
  it("wants a 2xx answer: a refusal, a missing site and a timeout are all refused", async () => {
    const fetcher = web({ "https://a.nl/": { status: 403 }, "https://b.nl/": "dns", "https://c.nl/": "timeout" });
    expect(await checkPage("a.nl", null, { fetcher })).toEqual({ ok: false, reason: "http_403" });
    expect(await checkPage("b.nl", null, { fetcher })).toEqual({ ok: false, reason: "host_does_not_exist" });
    expect(await checkPage("c.nl", null, { fetcher })).toEqual({ ok: false, reason: "timeout" });
    expect(fetcher.asked.filter((u) => u === "https://c.nl")).toHaveLength(2);
  });

  it("gives a slow page one more try", async () => {
    const fetcher = web({ "https://slow.nl/": ["timeout", { status: 200, html: html("nl", "Atelier") }] });
    expect((await checkPage("slow.nl", null, { fetcher })).ok).toBe(true);
  });

  it("follows redirects to another site, but never to a local address", async () => {
    const fetcher = web({
      "https://old.nl/": { status: 301, location: "https://new.nl/" },
      "https://new.nl/": { status: 200, html: html("nl", "Atelier") },
      "https://evil.nl/": { status: 302, location: "http://127.0.0.1/admin" },
    });
    expect((await checkPage("old.nl", null, { fetcher })).ok).toBe(true);
    expect(await checkPage("evil.nl", null, { fetcher })).toEqual({ ok: false, reason: "not_a_public_website" });
    expect(fetcher.asked).not.toContain("http://127.0.0.1/admin");
  });

  it("swaps in the page's own version in the reader's language", async () => {
    const fetcher = web({
      "https://escape-kit.com/": { status: 200, html: html("fr", "Jeu", '<link rel="alternate" hreflang="en" href="/en/">') },
      "https://escape-kit.com/en/": { status: 200, html: html("en", "Escape kit") },
    });
    const result = await verifyOptionUrls([{ name: "Escape kit", city: "Online", url: "https://escape-kit.com/", note: "", until: null, rating: null }], fetcher, 100, { strict: true, fit: () => NL });
    expect(result.kept[0].url).toBe("https://escape-kit.com/en/");
  });

  it("tells a later search round which addresses were refused and why", () => {
    const block = rejectedBlock([{ activityId: "escape-doos", url: "https://escape-kit.com/", reason: "fit:wrong_language" }], ["escape-doos"]);
    expect(block).toContain("https://escape-kit.com/");
    expect(block).toContain("language the reader does not read");
    expect(rejectedBlock([], ["escape-doos"])).toBe("");
  });
});

describe("prices", () => {
  const page = "<div>Printable kit &euro; 20,69 per download</div>";

  it("keeps a price that stands on a checked page", () => {
    expect(priceOnPages(20.69, [page])).toBe(true);
    expect(guardPrices("Buy a kit for €20.69.", [page], "en").text).toBe("Buy a kit for €20.69.");
  });

  it("turns an unverified exact price into a labelled range", () => {
    expect(guardPrices("Buy a printable kit, €20.69.", [], "en").text).toBe("Buy a printable kit, €15–25 (estimate).");
    expect(guardPrices("vanaf €45 per les", [], "nl").text).toBe("€35–55 (schatting) per les");
  });

  it("labels an unverified range once, leaves free alone and fits a short field", () => {
    expect(guardPrices("€15–25", [], "nl").text).toBe("€15–25 (schatting)");
    expect(guardPrices("€15–25 (schatting)", [], "nl").text).toBe("€15–25 (schatting)");
    expect(guardPrices("Gratis, of €0", [], "nl").text).toBe("Gratis, of €0");
    expect(guardPrices("€25 per persoon, inclusief materiaal", [], "nl", 42).text).toBe("±€20–30 per persoon, inclusief materiaal");
  });
});

const SCORES = { relevance: 70, novelty: 60, feasibility: 75, surprise: 50, shareability: 60, effort: 50, cost: 40, social_fit: 60, challenge_level: 50 };
const entry = (over: Partial<IdeaBookEntry> = {}): IdeaBookEntry => ({
  title: "Avond vol raadsels",
  intro: "Een avond puzzelen.",
  why_it_fits: "Je koos puzzelen.",
  details: ["Zoek een tafel uit.", "Zet een timer."],
  first_action: "Leg je telefoon weg.",
  practical: { estimated_cost: "Gratis", duration: "2 uur", difficulty: "easy", preparation: "" },
  location: null,
  requirements: [],
  image_suggestion: "",
  photo_category: "social_games",
  door: "natural",
  scores: SCORES,
  ...over,
});

describe("the check of a finished book", () => {
  const french: GeneratedIdeaBook = {
    profile_summary: "",
    must_haves: [],
    preferences: [],
    ideas: [
      entry({
        activity_id: "escape-doos",
        details: ["Bestel bij Jeux Maison een pakket voor €20,69 op jeux-maison.fr.", "Print de bladen vanavond."],
        first_action: "Open jeux-maison.fr en kies een zaak.",
        places: [
          { name: "Jeux Maison", city: "Online", url: "https://jeux-maison.fr/", note: "Printbare spellen" },
          { name: "Puzzelwinkel", city: "Online", url: "https://puzzelwinkel.nl/", note: "Pakketten vanaf €12" },
        ],
      }),
    ],
    wildcard: entry({ door: "wildcard", first_action: "Kijk op puzzelwinkel.nl.", intro: "Meer op dood-adres.nl vandaag." }),
    labels: { steps_heading: "", first_action_heading: "", wildcard_heading: "", time_label: "", cost_label: "", location_heading: "", requirements_heading: "" },
  };
  const fetcher = web({
    "https://jeux-maison.fr/": { status: 200, html: html("fr", "Jeux à imprimer") },
    "https://puzzelwinkel.nl/": { status: 200, html: html("nl", "Puzzelwinkel", "<meta property='product' price: '12'>") },
  });

  it("leaves out a foreign place and points its steps to a search instruction in the reader's language", async () => {
    const { book, report } = await verifyBook(french, { language: "nl", country: "NL", adultsOnly: true, place: "Utrecht", fetcher });
    const [first] = book.ideas;
    expect(first.places?.map((p) => p.name)).toEqual(["Puzzelwinkel"]);
    expect(JSON.stringify(book)).not.toContain("jeux-maison");
    expect(first.first_action).toContain("Zoek op Google Maps");
    expect(first.first_action).toContain("Utrecht");
    expect(first.details[0]).toContain("Zoek op Google Maps");
    expect(first.details[1]).toBe("Print de bladen vanavond.");
    expect(report.rejected.map((r) => r.reason)).toContain("fit:foreign_country");
  });

  it("keeps an address of a checked place, and takes a dead one out of the sentence", async () => {
    const { book, report } = await verifyBook(french, { language: "nl", country: "NL", adultsOnly: true, place: "Utrecht", fetcher });
    expect(book.wildcard.first_action).toBe("Kijk op puzzelwinkel.nl.");
    expect(book.wildcard.intro).toBe("Meer op een aanbieder vandaag.");
    expect(report.rejected.some((r) => r.url.includes("dood-adres"))).toBe(true);
  });

  it("writes the instruction without any address", () => {
    for (const language of ["nl", "en"] as const) expect(findWebAddresses(searchInstruction("pottenbakken", "Utrecht", language, false))).toEqual([]);
  });
});

describe("the first part of a broken address", () => {
  const whole = addressesIn({ steps: ["Reserveer via bartsboekje.com/kat-en-bakkie-utrecht. Of bel."], site: "https://club.test/agenda/" });

  it("links to the whole one", () => {
    const found = brokenAddress("of reserveer via bartsboekje.com/kat-en-bakkie-utrec", whole);
    expect(found && found !== "unclear" ? found.found.url : found).toBe("https://bartsboekje.com/kat-en-bakkie-utrecht");
    // broken before the ending of the host, where the part reads as another address
    const early = brokenAddress("via bartsboekje.co", whole);
    expect(early && early !== "unclear" ? early.found.url : early).toBe("https://bartsboekje.com/kat-en-bakkie-utrecht");
  });

  it("leaves a complete address and ordinary words alone, and links nothing when it is unclear", () => {
    expect(brokenAddress("via bartsboekje.com/kat-en-bakkie-utrecht", whole)).toBeNull();
    expect(brokenAddress("neem een boek mee.", whole)).toBeNull();
    expect(brokenAddress("zie club.test/agen", whole)).not.toBeNull();
    expect(brokenAddress("zie voorbeeld.nl/pag", addressesIn(["voorbeeld.nl/pagina-een", "voorbeeld.nl/pagina-twee"]))).toBe("unclear");
  });
});
