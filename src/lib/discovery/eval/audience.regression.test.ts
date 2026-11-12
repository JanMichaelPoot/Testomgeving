import { beforeAll, describe, expect, it } from "vitest";
import { clusterOf, MAX_PER_CLUSTER } from "@/lib/discovery/clusters";
import { getActivity } from "@/lib/discovery/library";
import { MIN_IMAGE_PICKS } from "@/lib/discovery/twoPages";
import { PERSONAS, runSession, type Persona, type Session } from "@/lib/discovery/eval/audience";
import {
  ALCOHOL_CENTRAL,
  DUTCH_BOUND,
  unsuitableForCalmPace,
  unsuitableForMeeting,
  unsuitableForQuiet,
  unsuitableForWheelchair,
  unsuitableForYoungKids,
} from "@/lib/discovery/suitability";

// The guard behind docs/doelgroeponderzoek.md: 16 personas (a child, a family with toddlers, a wheelchair user, a pensioner couple, an international
// resident, ...) go through the production intake logic and the production engine, SESSIONS visits each. It asserts what must always hold for each of
// them (no supervised idea for a calm pace, no alcohol when none is wanted, ...) and a few floors for the whole (variety, no standard idea in every book).
// The thresholds sit clearly above what the 30-session research measured, so a small library change does not trip them, but a lost need does.
// Free and deterministic: no API call. scripts/audience-research.ts is the report version of the same run.

const SESSIONS = 6;
const personaById = new Map(PERSONAS.map((p) => [p.id, p]));
let runs: Map<string, Session[]>;

beforeAll(() => {
  runs = new Map(PERSONAS.map((p) => [p.id, Array.from({ length: SESSIONS }, (_, i) => runSession(p, `guard-${p.id}-${i}`))]));
}, 240_000);

const activities = (id: string) => (runs.get(id) ?? []).flatMap((s) => s.seeds.map((x) => getActivity(x.id)!));
const share = (list: unknown[], bad: number) => (list.length ? bad / list.length : 0);

describe("the 16 audience personas, through the production engine", () => {
  it("every visit gives a full set of seven ideas", () => {
    for (const p of PERSONAS) for (const s of runs.get(p.id)!) expect(s.seeds.length, `${p.id}`).toBeGreaterThanOrEqual(7);
  });

  it("keeps what each stated need rules out of the book, for every visit", () => {
    const none = (id: string, bad: (a: ReturnType<typeof activities>[number]) => boolean, why: string) => {
      for (const a of activities(id)) expect(bad(a), `${id} (${personaById.get(id)!.label}) ${why}: ${a.id}`).toBe(false);
    };
    none("P04", unsuitableForYoungKids, "is not for young children");
    none("P10", unsuitableForWheelchair, "cannot be done from a wheelchair");
    none("P13", unsuitableForCalmPace, "is not calm");
    none("P14", unsuitableForCalmPace, "is not calm");
    none("P11", unsuitableForQuiet, "is loud, crowded or supervised");
    none("P16", (a) => ALCOHOL_CENTRAL.has(a.id), "is about alcohol");
    none("P12", (a) => DUTCH_BOUND.has(a.id), "is done in Dutch");
    none("P12", unsuitableForMeeting, "offers no way to meet people");
    none("P14", unsuitableForMeeting, "offers no way to meet people");
  });

  it("gives a pair and a group the forms of taking part they asked for", () => {
    for (const a of activities("P06")) expect(a.formats === null || a.formats.includes("duo"), `P06 ${a.id}`).toBe(true);
    for (const a of activities("P07")) expect(a.formats === null || a.formats.some((f) => f === "small_group" || f === "large_group"), `P07 ${a.id}`).toBe(true);
  });

  it("keeps the share of ideas that do not fit a persona's stage, practical limits or social form under a ceiling", () => {
    const limit: Record<string, number> = {};
    for (const p of PERSONAS) limit[p.id] = 0.3;
    for (const id of ["P04", "P06", "P07", "P12", "P13", "P14"]) limit[id] = 0.2;
    for (const p of PERSONAS) {
      const list = activities(p.id);
      const bad = list.filter((a) => !p.stage(a) || !p.feasible(a) || (a.formats !== null && !p.social(a))).length;
      expect(share(list, bad), `${p.id} (${p.label}) misses`).toBeLessThanOrEqual(limit[p.id]);
    }
  });

  it("never fills a book with one kind of activity (dances, walks, ...) beyond what the visitor chose", () => {
    let books = 0;
    let over = 0;
    for (const p of PERSONAS) {
      for (const s of runs.get(p.id)!) {
        books++;
        const per = new Map<string, number>();
        for (const x of s.seeds) {
          const k = clusterOf(x.id);
          if (k) per.set(k, (per.get(k) ?? 0) + 1);
        }
        if (Math.max(0, ...per.values()) > MAX_PER_CLUSTER) over++;
      }
    }
    // Only a visitor's own picks may take a kind past the cap, so it stays rare.
    expect(over / books).toBeLessThanOrEqual(0.1);
  });

  it("does not hand the same few ideas to everybody", () => {
    const perActivity = new Map<string, number>();
    let books = 0;
    for (const p of PERSONAS) {
      for (const s of runs.get(p.id)!) {
        books++;
        for (const id of new Set(s.seeds.map((x) => x.id))) perActivity.set(id, (perActivity.get(id) ?? 0) + 1);
      }
    }
    const [topId, top] = [...perActivity.entries()].sort((a, b) => b[1] - a[1])[0];
    expect(top / books, `${topId} is in too many books`).toBeLessThanOrEqual(0.25);
    for (const p of PERSONAS) expect(new Set(activities(p.id).map((a) => a.id)).size, `${p.id} gets too few different ideas`).toBeGreaterThanOrEqual(20);
  });

  it("shows enough of a taste on the first set of images that people rarely need 'Andere beelden' more than once", () => {
    const all: Persona[] = PERSONAS;
    const first = all.flatMap((p) => runs.get(p.id)!.map((s) => (s.firstSetHits >= MIN_IMAGE_PICKS ? 1 : 0)));
    const refresh = all.flatMap((p) => runs.get(p.id)!.map((s) => s.refreshes));
    expect(first.reduce((t: number, x) => t + x, 0) / first.length).toBeGreaterThanOrEqual(0.35);
    expect(refresh.reduce((t: number, x) => t + x, 0) / refresh.length).toBeLessThanOrEqual(1);
  });
});
