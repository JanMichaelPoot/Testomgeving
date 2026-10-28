import { describe, expect, it } from "vitest";
import { ALL_ACTIVITIES } from "@/lib/discovery/library";
import type { Activity } from "@/lib/discovery/types";
import { DEFAULT_QUEUE_CAP, applyMerges, buildReport, fingerprint, runImport } from "@/lib/knowledge/importer";
import { buildIndex, matchRecord, similarActivities } from "@/lib/knowledge/match";
import { normalizeRecord } from "@/lib/knowledge/normalize";
import { parseWikidata, type SparqlResult } from "@/lib/knowledge/parseWikidata";
import { autoReject } from "@/lib/knowledge/screen";
import type { ProposalFile, RawRecord } from "@/lib/knowledge/types";

// B3: parse, normalise, match (including the "never merge" cases), idempotency, and the review queue.

const act = (id: string, nl: string, en: string, extra: Partial<Activity> = {}): Activity => ({
  id,
  domain: "games",
  sub: ALL_ACTIVITIES.find((a) => a.domain === "games")!.sub,
  label: { nl, en },
  tags: ["strategy", "focus"],
  formats: null,
  intensity: null,
  level: null,
  cost: null,
  duration: null,
  setting: null,
  safety: { tier: 0 },
  entry: null,
  scene: "a wooden board with pieces on a table by a window in warm light",
  status: "concept",
  ...extra,
});
const rec = (id: string, en?: string, nl?: string, descEn?: string): RawRecord => ({
  source_id: "S3",
  source_record_id: id,
  labels: { ...(nl ? { nl } : {}), ...(en ? { en } : {}) },
  descriptions: descEn ? { en: descEn } : {},
});
const lib: Activity[] = [
  act("schaken", "Schaken", "Chess"),
  act("pottenbakken", "Pottenbakken", "Pottery"),
  act("klimmen", "Klimmen", "Climbing"),
  act("bordspellen", "Bordspellen", "Board games"),
];
const norm = (r: RawRecord) => normalizeRecord(r);

describe("parseWikidata", () => {
  const bind = (id: string, v: Record<string, string>) => ({
    item: { value: `http://www.wikidata.org/entity/${id}` },
    ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, { value: x }])),
  });
  const json: SparqlResult = {
    results: {
      bindings: [
        bind("Q20", { en: "chess", nl: "schaken", den: "board game" }),
        bind("Q20", { en: "chess", nl: "schaken", dnl: "bordspel" }),
        bind("Q3", { en: "Q3", nl: "undefined" }),
        bind("Q10", { en: "pottery" }),
        { item: { value: "http://example.org/not-wikidata" }, en: { value: "x" } },
      ],
    },
  };

  it("folds repeated rows into one record per Q-number, sorted by number", () => {
    const r = parseWikidata(json);
    expect(r.map((x) => x.source_record_id)).toEqual(["Q3", "Q10", "Q20"]);
    expect(r[2]).toMatchObject({ labels: { en: "chess", nl: "schaken" }, descriptions: { en: "board game", nl: "bordspel" } });
  });

  it("treats a Q-number or the text 'undefined' as 'no label'", () => {
    expect(parseWikidata(json)[0].labels).toEqual({});
  });

  it("does not depend on the row order", () => {
    const flipped: SparqlResult = { results: { bindings: [...json.results!.bindings!].reverse() } };
    expect(parseWikidata(flipped)).toEqual(parseWikidata(json));
  });
});

describe("matching: what may merge", () => {
  const index = buildIndex(lib);

  it("merges on an equal normalised name in the same language, ignoring case, accents and punctuation", () => {
    expect(matchRecord(norm(rec("Q1", "CHESS!", undefined)), index)).toMatchObject({ kind: "merge", activityId: "schaken", tier: "exact", lang: "en" });
    expect(matchRecord(norm(rec("Q2", undefined, "Pottënbakken")), index)).toMatchObject({ kind: "merge", activityId: "pottenbakken", lang: "nl" });
  });

  it("matches an alias, as a lower tier", () => {
    const withAlias = buildIndex([act("klimmen", "Klimmen", "Climbing", { aliases: { nl: ["bergsport"], en: [] } }), ...lib.filter((a) => a.id !== "klimmen")]);
    expect(matchRecord(norm(rec("Q3", undefined, "Bergsport")), withAlias)).toMatchObject({ kind: "merge", activityId: "klimmen", tier: "alias" });
  });

  it("never merges across languages: an English word that equals a Dutch label is not a match", () => {
    const tricky = buildIndex([act("bridge", "Bridge (kaartspel)", "Bridge"), act("brug", "Brug", "Bridge-building")]);
    expect(matchRecord(norm(rec("Q4", undefined, "Bridge")), tricky).kind).not.toBe("merge");
  });

  it("does NOT merge on shared words: correspondence chess is not chess", () => {
    const m = matchRecord(norm(rec("Q5", "correspondence chess", "correspondentieschaak")), buildIndex(lib));
    expect(m.kind).toBe("similar");
    expect(m).toMatchObject({ candidates: ["schaken"] });
  });

  it("does NOT merge bouldering with climbing: it is only a candidate for a person to look at", () => {
    const m = matchRecord(norm(rec("Q6", "bouldering", "boulderen")), buildIndex(lib));
    expect(m.kind).toBe("none");
    const m2 = matchRecord(norm(rec("Q7", "indoor climbing", "indoor klimmen")), buildIndex(lib));
    expect(m2.kind).toBe("similar");
  });

  it("does not suggest on a filler word: 'board game' words alone are generic", () => {
    expect(similarActivities(norm(rec("Q8", "card game", "kaartspel")), buildIndex(lib))).toEqual([]);
  });

  it("sends a name that two activities answer to, or two different activities in the two languages, to a person", () => {
    const clash = buildIndex([act("a", "Schaken", "Chess"), act("b", "Dammen", "Checkers")]);
    expect(matchRecord(norm(rec("Q9", "Chess", "Dammen")), clash)).toMatchObject({ kind: "ambiguous", candidates: ["a", "b"] });
  });
});

describe("rejection rules", () => {
  it("rejects what WINDOW never suggests, technical terms, generic fields, over-long names and records without a label", () => {
    expect(autoReject(norm(rec("Q1", "weapon collecting")))).toBe("unsafe_or_restricted");
    expect(autoReject(norm(rec("Q2", "Tyrosemiophilia")))).toBe("technical_term");
    expect(autoReject(norm(rec("Q3", "collecting")))).toBe("too_generic");
    expect(autoReject(norm(rec("Q4", "a".repeat(41))))).toBe("label_too_long");
    expect(autoReject(norm(rec("Q5")))).toBe("no_label");
    expect(autoReject(norm(rec("Q6", "sudoku", "sudoku")))).toBeNull();
  });
});

describe("the import as a whole", () => {
  const records: RawRecord[] = [
    rec("Q10", "chess", "schaken"),
    rec("Q11", "pottery", "pottenbakken"),
    rec("Q12", "bouldering", "boulderen", "climbing without ropes"),
    rec("Q13", "checkers", "dammen", "board game"),
    rec("Q14", "weapon collecting", "wapens verzamelen"),
    rec("Q15", "ant keeping"),
    rec("Q16", "indoor climbing", "indoor klimmen"),
    rec("Q17", "cat culture"),
  ];
  const proposals: ProposalFile = {
    source_id: "S3",
    accept: { checkers: { domain: "games", note: "dammen" } },
    unsure: { "ant keeping": { domain: "nature" } },
    merge: { "indoor climbing": { into: "klimmen" }, "bouldering": { into: "bestaat-niet" } },
    reject: { "cat culture": "geen activiteit" },
  };

  it("sorts every record into exactly one of merged, in review or rejected", () => {
    const r = runImport({ records, library: lib, proposals });
    const where = new Map<string, string[]>();
    const add = (id: string, w: string) => where.set(id, [...(where.get(id) ?? []), w]);
    r.merges.forEach((m) => add(m.source_record_id, "merged"));
    r.queue.forEach((q) => add(q.source_record_id, "review"));
    r.rejected.forEach((x) => add(x.source_record_id, "rejected"));
    for (const x of records) expect(where.get(x.source_record_id), x.source_record_id).toHaveLength(1);
    expect(r.merges.map((m) => m.source_record_id)).toEqual(["Q10", "Q11"]);
    expect(r.rejected.map((x) => [x.source_record_id, x.reason])).toEqual([["Q14", "unsafe_or_restricted"], ["Q17", "proposal_reject"]]);
  });

  it("puts a person's proposals first and ignores a merge proposal that names an unknown activity", () => {
    const r = runImport({ records, library: lib, proposals });
    expect(r.queue.map((q) => q.source_record_id)).toEqual(["Q13", "Q15", "Q16", "Q12"]);
    expect(r.queue.find((q) => q.source_record_id === "Q16")!.proposal).toMatchObject({ verdict: "merge", into: "klimmen", domain: "games" });
    expect(r.queue.find((q) => q.source_record_id === "Q12")!.proposal).toBeUndefined();
    expect(r.queue.find((q) => q.source_record_id === "Q15")!.needs_nl_label).toBe(true);
  });

  it("adds a suggested Dutch label only where the source has none, and marks the entry as still needing a real label", () => {
    const r = runImport({ records, library: lib, proposals: { ...proposals, nl_labels: { "ant keeping": "Mieren houden", checkers: "Iets anders" } } });
    const ants = r.queue.find((q) => q.source_record_id === "Q15")!;
    expect(ants).toMatchObject({ needs_nl_label: true, nl_suggestion: "Mieren houden" });
    // the source already has "dammen": a suggestion never replaces or sits next to source data
    expect(r.queue.find((q) => q.source_record_id === "Q13")!.nl_suggestion).toBeUndefined();
  });

  it("caps the queue; what falls under the cap is listed as rejected, never silently dropped", () => {
    const r = runImport({ records, library: lib, proposals, queueCap: 2 });
    expect(r.queue).toHaveLength(2);
    expect(r.rejected.filter((x) => x.reason === "below_queue_cap").map((x) => x.source_record_id)).toEqual(["Q12", "Q16"]);
    expect(DEFAULT_QUEUE_CAP).toBe(80);
  });

  it("keeps a reviewer's decision across runs: reject drops it, 'merge:<id>' turns it into a merge, a cap never removes it", () => {
    const first = runImport({ records, library: lib, proposals });
    const decided = first.queue.map((q) =>
      q.source_record_id === "Q12" ? { ...q, decision: "reject" as const } : q.source_record_id === "Q16" ? { ...q, decision: "merge:klimmen" as const } : q.source_record_id === "Q15" ? { ...q, decision: "accept" as const } : q,
    );
    const next = runImport({ records, library: lib, proposals, previousQueue: decided, queueCap: 1 });
    expect(next.rejected.find((x) => x.source_record_id === "Q12")!.reason).toBe("reviewer_reject");
    expect(next.merges.find((m) => m.source_record_id === "Q16")).toMatchObject({ activityId: "klimmen", tier: "reviewed" });
    expect(next.queue.find((q) => q.source_record_id === "Q15")!.decision).toBe("accept");
  });

  it("is idempotent: applying the merges and importing again gives the same outcome and adds nothing", () => {
    const run1 = runImport({ records, library: lib, proposals });
    const lib2 = applyMerges(lib, run1.merges, "S3");
    const run2 = runImport({ records, library: lib2, proposals, previousQueue: run1.queue });
    expect(run2.queue).toEqual(run1.queue);
    expect(run2.rejected).toEqual(run1.rejected);
    expect(run2.merges.every((m) => m.alreadyLinked)).toBe(true);
    expect(fingerprint(run2)).toBe(fingerprint(run1));
    const lib3 = applyMerges(lib2, run2.merges, "S3");
    expect(lib3).toEqual(lib2);
    // and the report is the same text both times
    const labels = { games: "Spel" };
    expect(buildReport({ result: run2, library: lib3, domainLabels: labels, sourceName: "t" })).toBe(buildReport({ result: run1, library: lib2, domainLabels: labels, sourceName: "t" }));
  });

  it("a decision file outlives the queue: it decides records that are not in the queue, and 'merge:<id>' is reviewed, before and after the names became aliases", () => {
    const decisions = { Q12: "reject" as const, Q16: "merge:klimmen" as const, Q13: "accept" as const };
    const run1 = runImport({ records, library: lib, proposals, decisions });
    expect(run1.rejected.find((x) => x.source_record_id === "Q12")!.reason).toBe("reviewer_reject");
    expect(run1.merges.find((m) => m.source_record_id === "Q16")).toMatchObject({ activityId: "klimmen", tier: "reviewed", alreadyLinked: false });
    const lib2 = applyMerges(lib, run1.merges, "S3");
    expect(lib2.find((a) => a.id === "klimmen")!.aliases?.nl).toContain("indoor klimmen");
    const run2 = runImport({ records, library: lib2, proposals, decisions });
    expect(run2.merges.find((m) => m.source_record_id === "Q16")).toMatchObject({ tier: "reviewed", alreadyLinked: true });
    expect(fingerprint(run2)).toBe(fingerprint(run1));
  });

  it("a record an activity was written from is 'added', not a merge, not a candidate, and not reviewed again", () => {
    const written = act("dammen", "Dammen", "Checkers", { provenance: { source_id: "S3", source_record_id: "Q13", method: "curated" } });
    const r = runImport({ records, library: [...lib, written], proposals, decisions: { Q13: "accept" } });
    expect(r.added).toEqual([{ source_record_id: "Q13", activityId: "dammen" }]);
    expect(r.merges.some((m) => m.source_record_id === "Q13")).toBe(false);
    expect(r.queue.some((q) => q.source_record_id === "Q13")).toBe(false);
  });

  it("adds a name the library lacks as an alias, once, and keeps the library valid", () => {
    const withAlias = runImport({ records: [rec("Q20", "chess", "schaakspel")], library: lib });
    expect(withAlias.merges[0].addAliases).toEqual({ nl: ["schaakspel"], en: [] });
    const applied = applyMerges(lib, withAlias.merges, "S3");
    const chess = applied.find((a) => a.id === "schaken")!;
    expect(chess.aliases).toEqual({ nl: ["schaakspel"], en: [] });
    expect(chess.source_links).toEqual([{ source_id: "S3", source_record_id: "Q20" }]);
  });

  it("does not add an alias that another activity already answers to", () => {
    const l = [act("schaken", "Schaken", "Chess"), act("dammen", "Dammen", "Checkers")];
    const r = runImport({ records: [rec("Q21", "chess", "dammen")], library: l });
    expect(r.merges).toEqual([]);
    expect(r.queue[0].reason).toBe("ambiguous_name");
  });

  it("never turns a record into an activity: the import result contains no Activity objects", () => {
    const r = runImport({ records, library: lib, proposals });
    expect(Object.keys(r).sort()).toEqual(["added", "merges", "queue", "records", "rejected", "source_id"]);
  });
});
