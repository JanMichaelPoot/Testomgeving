import { describe, expect, it } from "vitest";
import { ALL_ACTIVITIES } from "@/lib/discovery/library";
import { coverage, discoveryNeighbours, recognitionNeighbours, resolveLinks, strongestIn } from "./derive";
import { loadLibrary } from "./load";
import { parseLink, validateLibrary, type AppView } from "./validate";
import type { Library, RefActivity } from "./types";

const app: AppView = {
  activities: ALL_ACTIVITIES.map((a) => ({ id: a.id, nl: a.label.nl, en: a.label.en, aliases: [...(a.aliases?.nl ?? []), ...(a.aliases?.en ?? [])] })),
};

function fresh(): Library {
  return structuredClone(loadLibrary());
}
const errorsOf = (lib: Library) => validateLibrary(lib, app).filter((i) => i.level === "error");
const first = (lib: Library): RefActivity => lib.activities.find((a) => a.match === "new")!;

describe("the shipped reference library", () => {
  it("has no errors against its own rules and the app's library; warnings may only be about spread", () => {
    const issues = validateLibrary(loadLibrary(), app);
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
    for (const w of issues) expect(w.where).toBe("spread");
  });

  it("warns when one association is on most activities or the discovery links all run through a few themes", () => {
    const lib = fresh();
    // Mutation: put the same association on every activity and the "hardly discriminates" warning must appear.
    for (const a of lib.activities) if (!a.links.some((l) => l.startsWith("humor:"))) a.links.push("humor:2:E");
    expect(validateLibrary(lib, app).some((i) => /"humor" is on .*hardly discriminates/.test(i.message))).toBe(true);
    // Mutation: move every discovery link onto the same association and the concentration warning must appear.
    for (const a of lib.activities) {
      a.links = a.links.map((l) => (l.endsWith(":O") ? "geschiedenis:3:O" : l));
    }
    expect(validateLibrary(lib, app).some((i) => /discovery links concentrate/.test(i.message))).toBe(true);
  });

  it("covers all 20 categories and every association is used", () => {
    const lib = loadLibrary();
    const cov = coverage(lib);
    expect(lib.categories).toHaveLength(20);
    expect(Object.keys(cov.byCategory)).toHaveLength(20);
    expect(cov.associationsUsed).toBe(cov.associationsTotal);
    expect(cov.discoveryLinks).toBeGreaterThanOrEqual(lib.activities.length * 2);
  });

  it("uses all six relation forms and reaches all ten association domains", () => {
    const cov = coverage(loadLibrary());
    for (const r of ["D", "T", "E", "V", "M", "O"] as const) expect(cov.byRelation[r]).toBeGreaterThan(0);
    expect(Object.keys(cov.byDomain)).toHaveLength(10);
  });

  it("matches the app: every exact or close match points at a real app activity, new ones are really new", () => {
    const lib = loadLibrary();
    const appIds = new Set(app.activities.map((a) => a.id));
    for (const a of lib.activities) {
      if (a.match === "new") expect(a.legacy_id).toBeNull();
      else expect(appIds.has(a.legacy_id!)).toBe(true);
    }
  });

  it("keeps the 30 associations of the first workbook, each exactly once", () => {
    const lib = loadLibrary();
    const v0 = lib.associations.filter((a) => a.v0_id).map((a) => a.v0_id);
    expect(new Set(v0).size).toBe(30);
    expect(v0).toHaveLength(30);
  });

  it("derives skills and experiences from the links instead of storing them", () => {
    const lib = loadLibrary();
    const a = lib.activities.find((x) => x.slug === "pottenbakken")!;
    const links = resolveLinks(lib, a);
    expect(strongestIn(links, ["skills"], "nl")).toContain("Vakmanschap");
    expect(strongestIn(links, ["experiences", "senses"], "en")).toContain("Touch and texture");
    expect(links[0].score).toBe(5);
  });
});

describe("recognition and discovery", () => {
  const lib = loadLibrary();
  it("recognition finds alike activities, discovery finds other categories reached through a discovery link", () => {
    for (const slug of ["pottenbakken", "sterrenkijken", "speleologie", "fermenteren"]) {
      const a = lib.activities.find((x) => x.slug === slug)!;
      const rec = recognitionNeighbours(lib, a, 5);
      const dis = discoveryNeighbours(lib, a, 5);
      expect(rec.length).toBe(5);
      expect(dis.length).toBeGreaterThan(0);
      const recIds = new Set(recognitionNeighbours(lib, a, 10).map((n) => n.activity.id));
      const discoveryLinks = new Set(a.links.filter((l) => l.endsWith(":O")).map((l) => l.split(":")[0]));
      for (const n of dis) {
        expect(n.activity.category).not.toBe(a.category);
        expect(recIds.has(n.activity.id)).toBe(false);
        expect(discoveryLinks.has(n.via[0])).toBe(true);
      }
    }
  });

  it("recognition puts a pottery neighbour among crafts, not among sports", () => {
    const a = lib.activities.find((x) => x.slug === "pottenbakken")!;
    const cats = recognitionNeighbours(lib, a, 5).map((n) => n.activity.category);
    expect(cats.every((c) => ["CAT-01", "CAT-02", "CAT-03", "CAT-04"].includes(c))).toBe(true);
  });
});

describe("the rules catch what they are meant to catch", () => {
  it("rejects too few links, too few discovery links, and an unknown association", () => {
    let lib = fresh();
    first(lib).links = first(lib).links.slice(0, 5);
    expect(errorsOf(lib).some((e) => /needs 12 to 20/.test(e.message))).toBe(true);

    lib = fresh();
    const a = first(lib);
    a.links = a.links.map((l) => l.replace(/:O$/, ":T"));
    expect(errorsOf(lib).some((e) => /discovery links/.test(e.message))).toBe(true);

    lib = fresh();
    first(lib).links[0] = "bestaat-niet:3:D";
    expect(errorsOf(lib).some((e) => /unknown association/.test(e.message))).toBe(true);
  });

  it("rejects a discovery link without a reason, and a reason without a discovery link", () => {
    let lib = fresh();
    const a = first(lib);
    delete a.why[Object.keys(a.why)[0]];
    expect(errorsOf(lib).some((e) => /needs a reason/.test(e.message))).toBe(true);

    lib = fresh();
    first(lib).why["bos"] = { nl: "Een reden die nergens bij hoort, maar wel lang genoeg is.", en: "A reason that belongs to nothing, though long enough." };
    expect(errorsOf(lib).some((e) => /not a discovery link/.test(e.message))).toBe(true);
  });

  it("rejects a relation form that points at the wrong kind of association", () => {
    const lib = fresh();
    const a = first(lib);
    // "hout" is a material: it can be linked as M, not as V.
    a.links[0] = "hout:3:V";
    expect(errorsOf(lib).some((e) => /may only point at/.test(e.message))).toBe(true);
  });

  it("rejects a bad score, a duplicate link and links that stay in too few domains", () => {
    let lib = fresh();
    first(lib).links[0] = "bos:9:D";
    expect(errorsOf(lib).some((e) => /is not "association:score:relation"/.test(e.message))).toBe(true);

    lib = fresh();
    const a = first(lib);
    a.links.push(a.links[0]);
    expect(errorsOf(lib).some((e) => /linked twice/.test(e.message))).toBe(true);

    lib = fresh();
    const b = first(lib);
    b.links = ["hout:5:M", "klei:5:M", "textiel:5:M", "metaal:5:M", "glas:5:M", "papier:5:M", "steen:5:M", "leer:5:M", "verf:5:M", "planten:5:M", "creativiteit:5:V", "precisie:5:V"];
    b.why = {};
    expect(errorsOf(lib).some((e) => /association domains/.test(e.message))).toBe(true);
  });

  it("rejects a 'new' activity that already exists in the app, and a wrong crosswalk", () => {
    let lib = fresh();
    const a = first(lib);
    a.nl = "Pottenbakken";
    expect(errorsOf(lib).some((e) => /marked new but/.test(e.message))).toBe(true);

    lib = fresh();
    const ex = lib.activities.find((x) => x.match === "exact")!;
    ex.legacy_id = "bestaat-niet";
    expect(errorsOf(lib).some((e) => /not an app activity/.test(e.message))).toBe(true);

    lib = fresh();
    const dup = lib.activities.find((x) => x.match === "exact")!;
    const other = lib.activities.find((x) => x.match === "exact" && x !== dup)!;
    other.legacy_id = dup.legacy_id;
    other.slug = dup.legacy_id!;
    expect(errorsOf(lib).length).toBeGreaterThan(0);
  });

  it("rejects duplicate names and duplicate ids", () => {
    let lib = fresh();
    lib.activities[1].nl = lib.activities[0].nl;
    expect(errorsOf(lib).some((e) => /is also the name of/.test(e.message))).toBe(true);

    lib = fresh();
    lib.activities[1].id = lib.activities[0].id;
    expect(errorsOf(lib).some((e) => /duplicate id/.test(e.message))).toBe(true);
  });

  it("does not let unknown facets be filled with a made-up value", () => {
    const lib = fresh();
    const a = first(lib);
    (a.facets as unknown as { cost: number }).cost = 9;
    expect(errorsOf(lib).some((e) => /facets.cost/.test(e.message))).toBe(true);
    const lib2 = fresh();
    first(lib2).facets.cost = null;
    expect(errorsOf(lib2)).toEqual([]);
  });
});

describe("the quality review round", () => {
  it("has reviewed every record once and keeps them all on Concept until a person approves them", () => {
    const lib = loadLibrary();
    for (const a of lib.activities) {
      expect(a.qa?.round).toBe(1);
      expect(a.status).toBe("Concept");
    }
  });

  it("has the associations added by the review and scope notes where terms overlap", () => {
    const lib = loadLibrary();
    expect(lib.associations.length).toBeGreaterThanOrEqual(127);
    const slugs = new Set(lib.associations.map((x) => x.slug));
    for (const s of ["muziek", "taal", "spel", "mobiliteit", "ambacht", "online", "uitgaan", "cultuurplek", "leren", "snelheid", "luisteren", "conditie", "coordinatie", "kans", "miniatuur"]) expect(slugs.has(s)).toBe(true);
    const withScope = lib.associations.filter((x) => x.scope);
    expect(withScope.length).toBeGreaterThanOrEqual(29);
    for (const x of withScope) expect(x.scope!.nl.length > 10 && x.scope!.en.length > 10).toBe(true);
  });

  it("rejects an unknown qa result, a half-empty scope and a trivial note", () => {
    const lib = fresh();
    lib.activities[0].qa = { round: 1, result: "maybe" as never };
    expect(errorsOf(lib).some((i) => /qa\.result/.test(i.message))).toBe(true);
    const lib2 = fresh();
    lib2.associations[0].scope = { nl: "iets", en: "" };
    expect(errorsOf(lib2).some((i) => /scope/.test(i.message))).toBe(true);
    const lib3 = fresh();
    lib3.activities[0].qa_notes = ["ok"];
    expect(errorsOf(lib3).some((i) => /qa_notes/.test(i.message))).toBe(true);
  });
});

describe("link syntax", () => {
  it("parses association:score:relation and refuses everything else", () => {
    expect(parseLink("hout:5:M")).toEqual({ association: "hout", score: 5, relation: "M" });
    expect(parseLink("hout:0:M")).toBeNull();
    expect(parseLink("hout:5:X")).toBeNull();
    expect(parseLink("hout:5")).toBeNull();
  });
});
