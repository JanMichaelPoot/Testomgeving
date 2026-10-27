import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { ASSOCIATIONS } from "@/lib/discovery/associations";
import { ALL_ACTIVITIES, DOMAINS, getActivity } from "@/lib/discovery/library";
import type { Run } from "@/lib/discovery/engine/evaluate";
import { syntheticProfiles } from "@/lib/discovery/engine/synthetic";
import { buildBlindSheet, tallyPreferences } from "@/lib/discovery/eval/blind";
import { checkBook, checkEntry, checkSeedRun, isConcreteAction, type Finding } from "@/lib/discovery/eval/checks";
import { BudgetExceededError, BudgetMeter, priceOf } from "@/lib/discovery/eval/budget";
import { EngineNotAvailableError, getEngine } from "@/lib/discovery/eval/engines";
import { computeMetrics } from "@/lib/discovery/eval/metrics";
import { loadEvalProfiles, toSyntheticProfile } from "@/lib/discovery/eval/profiles";
import { renderReport } from "@/lib/discovery/eval/report";
import { buildResults } from "@/lib/discovery/eval/results";
import { runWithEngine } from "@/lib/discovery/eval/run";

// The evaluation harness (stage B1 of the knowledge-engine assignment). These tests run on the free,
// deterministic "seeds only" path: no API calls. They guard two things: that the harness itself is sound
// (the checks catch what they should, a paid run stays locked, the blind sheet hides the engines) and that
// the current engine still returns what the baseline says for the 20 fixed profiles.

const engine = getEngine("current");
const profiles = loadEvalProfiles();
const runs = runWithEngine(profiles.map(toSyntheticProfile), engine);
const errorsOf = (list: Finding[]) => list.filter((f) => f.severity === "error");

describe("the 20 fixed profiles", () => {
  it("are 20, uniquely named, and refer to things that exist", () => {
    expect(profiles).toHaveLength(20);
    expect(new Set(profiles.map((p) => p.id)).size).toBe(20);
    const cards = new Set(ASSOCIATIONS.map((c) => c.id));
    const domains = new Set(DOMAINS.map((d) => d.id));
    for (const p of profiles) {
      expect(p.month, p.id).toBeGreaterThanOrEqual(1);
      expect(p.month, p.id).toBeLessThanOrEqual(12);
      for (const id of p.stored.associations ?? []) expect(cards.has(id), `${p.id} card ${id}`).toBe(true);
      for (const id of p.stored.interests ?? []) expect(getActivity(id), `${p.id} activity ${id}`).toBeDefined();
      for (const d of p.stored.interestDomains ?? []) expect(domains.has(d), `${p.id} domain ${d}`).toBe(true);
    }
  });

  it("cover the kinds of visitors the audit asked for", () => {
    expect(profiles.filter((p) => p.kind === "cards").length).toBeGreaterThanOrEqual(3);
    expect(profiles.filter((p) => p.stored.purpose === "gift").length).toBeGreaterThanOrEqual(2);
    expect(profiles.filter((p) => p.edge).length).toBeGreaterThanOrEqual(4);
    expect(new Set(profiles.map((p) => p.stored.budget)).size).toBe(4);
    expect(new Set(profiles.map((p) => p.stored.timeAvailable)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(profiles.map((p) => p.stored.ageCategory)).size).toBeGreaterThanOrEqual(5);
  });

  it("give the same seeds every time (the run does not depend on the date)", () => {
    const again = runWithEngine(profiles.map(toSyntheticProfile), engine);
    expect(again.map((r) => r.result.seeds.map((s) => s.activityId))).toEqual(runs.map((r) => r.result.seeds.map((s) => s.activityId)));
  });

  it("pass every deterministic check on the current engine: hard limits, duplicates, spread, one wildcard", () => {
    const findings = runs.flatMap((r) => checkSeedRun(r, engine.library));
    expect(errorsOf(findings), JSON.stringify(errorsOf(findings))).toEqual([]);
  });

  it("still get the seeds of the baseline (an intended change of the engine refreshes scripts/eval/baseline/current.json)", () => {
    const baseline = JSON.parse(readFileSync(path.resolve("scripts/eval/baseline/current.json"), "utf8")) as { seeds: Record<string, string[]> };
    const now = Object.fromEntries(runs.map((r) => [r.profile.id, r.result.seeds.map((s) => `${s.direction}:${s.door}:${s.activityId}`)]));
    expect(now).toEqual(baseline.seeds);
  });

  it("keep the limits we cannot filter as verify flags (wheelchair, diet, children)", () => {
    const flags = (id: string) => new Set(runs.find((r) => r.profile.id === id)!.result.seeds.flatMap((s) => s.verify));
    expect(flags("P06").has("accessibility")).toBe(true);
    expect(flags("P07").has("dietary")).toBe(true);
    expect(flags("P05").has("children")).toBe(true);
  });

  it("ignore a contradictory wish (buiten of binnen) instead of treating it as a limit", () => {
    const p10 = runs.find((r) => r.profile.id === "P10")!;
    expect(p10.result.constraints.setting).toBeNull();
    expect(checkSeedRun(p10, engine.library).filter((f) => f.check === "hard:E1")).toEqual([]);
  });
});

describe("computeMetrics", () => {
  it("reports no hard violations and plausible numbers for the fixed profiles", () => {
    const m = computeMetrics(runs, engine.library);
    expect(m.profiles).toBe(20);
    expect(m.violations).toEqual({ E1: 0, E3: 0, E4: 0, E5: 0, E6: 0 });
    expect(m.worldsPerBook).toBeGreaterThan(4);
    expect(m.photoCategoriesPerBook).toBeGreaterThan(3);
    expect(Object.values(m.oneThingByDoor).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });

  it("is deterministic on synthetic visitors too", () => {
    const syn = syntheticProfiles(15, "eval-test", engine.library);
    const a = computeMetrics(runWithEngine(syn, engine), engine.library);
    const b = computeMetrics(runWithEngine(syn, engine), engine.library);
    expect(a).toEqual(b);
  }, 60_000);
});

describe("checkSeedRun catches what it should", () => {
  const base = runs.find((r) => r.profile.id === "P04")!; // budget: free
  const withSeedReplaced = (index: number, activityId: string): Run => {
    const seeds = base.result.seeds.map((s, i) => (i === index ? { ...s, activityId } : s));
    return { ...base, result: { ...base.result, seeds } };
  };

  it("flags an activity that costs more than the budget allows", () => {
    const pricey = ALL_ACTIVITIES.find((a) => a.cost === 3 && a.safety.tier !== 2 && !base.result.seeds.some((s) => s.activityId === a.id))!;
    const findings = checkSeedRun(withSeedReplaced(1, pricey.id), engine.library);
    expect(findings.some((f) => f.check === "hard:E1")).toBe(true);
  });

  it("flags the same activity twice in one book", () => {
    const findings = checkSeedRun(withSeedReplaced(1, base.result.seeds[0].activityId), engine.library);
    expect(findings.some((f) => f.check === "duplicates:id")).toBe(true);
  });

  it("flags two different activities with the same name once spelling is ignored", () => {
    const first = getActivity(base.result.seeds[0].activityId)!;
    const twin = { ...first, id: "twin-of-first", label: { nl: first.label.nl.toUpperCase(), en: first.label.en } };
    const lookup = (id: string) => (id === "twin-of-first" ? twin : getActivity(id));
    const library = { ...engine.library, activities: [...engine.library.activities, twin] };
    const findings = checkSeedRun(withSeedReplaced(1, "twin-of-first"), library, lookup);
    expect(findings.some((f) => f.check === "duplicates:name")).toBe(true);
  });

  it("flags too few worlds and a missing wildcard", () => {
    const oneWorld = ALL_ACTIVITIES.filter((a) => a.domain === "creative" && a.cost === 0).slice(0, 7);
    expect(oneWorld.length).toBeGreaterThanOrEqual(1);
    const seeds = base.result.seeds.map((s, i) => ({ ...s, direction: i === 6 ? ("adjacent" as const) : s.direction, activityId: ALL_ACTIVITIES.filter((a) => a.domain === "creative")[i].id }));
    const findings = checkSeedRun({ ...base, result: { ...base.result, seeds } }, engine.library);
    expect(findings.some((f) => f.check === "spread:domains")).toBe(true);
    expect(findings.some((f) => f.check === "seeds:wildcard")).toBe(true);
  });
});

// --- books -----------------------------------------------------------------------------------

function entry(over: Partial<IdeaBookEntry> = {}): IdeaBookEntry {
  return {
    title: "Pottenbakken zoals je stiekem wilde",
    intro: "Een middag klei tussen je handen.",
    why_it_fits: "Je koos handen vol klei.",
    details: ["Open de website van de bakkerij en kies een proefles.", "Boek een plek voor zaterdag."],
    first_action: "Open steckutrecht.nl en boek een plek bij een proefles.",
    practical: { estimated_cost: "€25–40", duration: "3 uur", difficulty: "easy", preparation: "" },
    location: null,
    requirements: [],
    image_suggestion: "",
    photo_category: "creative_workshop",
    door: "natural",
    scores: { relevance: 90, novelty: 20, feasibility: 80, surprise: 10, shareability: 40, effort: 30, cost: 35, social_fit: 60, challenge_level: 20 },
    activity_id: "pottenbakken",
    ...over,
  } as IdeaBookEntry;
}

function book(ideas: IdeaBookEntry[] = [], wildcard: IdeaBookEntry = entry({ door: "wildcard", activity_id: "wildcard-one" })): GeneratedIdeaBook {
  const six = ideas.length ? ideas : [1, 2, 3, 4, 5, 6].map((n) => entry({ activity_id: `idea-${n}` }));
  return { profile_summary: "", must_haves: [], preferences: [], ideas: six, wildcard, labels: {} as GeneratedIdeaBook["labels"] };
}

describe("checkBook", () => {
  it("accepts a clean book", () => {
    expect(checkBook(book())).toEqual([]);
  });

  it("fails an idea without a first action, and only warns about a vague one", () => {
    const missing = checkEntry(entry({ first_action: "  " }), "idea1");
    expect(errorsOf(missing).map((f) => f.check)).toContain("first_action:missing");
    const vague = checkEntry(entry({ first_action: "Kijk eens online naar iets leuks" }), "idea1");
    expect(vague.find((f) => f.check === "first_action:vague")?.severity).toBe("warn");
    expect(errorsOf(vague)).toEqual([]);
  });

  it("fails an exact price, opening times or a street address that nothing in the research supports", () => {
    const price = checkEntry(entry({ details: ["De proefles kost €35 per persoon."] }), "idea1");
    expect(errorsOf(price).map((f) => f.check)).toContain("facts:price_without_source");
    const hours = checkEntry(entry({ details: ["Ze zijn open van 10:00 tot 17:00."] }), "idea1");
    expect(errorsOf(hours).map((f) => f.check)).toContain("facts:hours_without_source");
    const address = checkEntry(entry({ details: ["Je vindt de bakkerij aan de Oudegracht 123."] }), "idea1");
    expect(errorsOf(address).map((f) => f.check)).toContain("facts:address_without_source");
  });

  it("accepts the same facts when this idea's research states them", () => {
    const places = [{ name: "Steck Utrecht", city: "Utrecht", url: "https://steckutrecht.nl", note: "Proefles €35, open van 10:00 tot 17:00, Oudegracht 123" }];
    const ok = checkEntry(entry({ places, details: ["De proefles kost €35 per persoon.", "Ze zijn open van 10:00 tot 17:00.", "Je vindt de bakkerij aan de Oudegracht 123."] }), "idea1");
    expect(errorsOf(ok)).toEqual([]);
  });

  it("does not count the designated approximate cost fields as invented facts", () => {
    expect(errorsOf(checkEntry(entry({ practical: { estimated_cost: "€35", duration: "3 uur", difficulty: "easy", preparation: "" } }), "idea1"))).toEqual([]);
  });

  it("fails the same activity twice in one book", () => {
    const dup = book([1, 2, 3, 4, 5, 6].map(() => entry({ activity_id: "pottenbakken" })));
    expect(checkBook(dup).some((f) => f.check === "duplicates:id")).toBe(true);
  });

  it("warns, never fails, when one opening word starts many of the suggestions of a book (B5 fill lines)", () => {
    const tipped = (n: number) => entry({ activity_id: `act-${n}`, fill: { timeline: ["a", "b", "c", "d"], takeaways: ["a", "b", "c"], suggestions: [`Noteer ${n}a`, `Neem ${n}b`, `Probeer ${n}c`] } });
    const findings = checkBook(book([1, 2, 3, 4, 5, 6].map(tipped)));
    const rep = findings.filter((f) => f.check === "fill:repetitive_opening");
    expect(rep.map((f) => f.message)).toEqual(['6 suggestions start with "neem"', '6 suggestions start with "noteer"', '6 suggestions start with "probeer"']);
    expect(rep.every((f) => f.severity === "warn")).toBe(true);
  });

  it("isConcreteAction wants a real instruction to anchor on", () => {
    expect(isConcreteAction("Open steckutrecht.nl en boek een plek bij een proefles.")).toBe(true);
    expect(isConcreteAction("Zoek op Google Maps naar 'kleiwerkplaats Utrecht' en bel er één.")).toBe(true);
    expect(isConcreteAction("Kijk eens online")).toBe(false);
    expect(isConcreteAction("Overweeg om iets te zoeken dat past bij je smaak.")).toBe(false);
  });
});

// --- report, blind sheet and the spending lock ------------------------------------------------

describe("report and blind sheet", () => {
  const result = buildResults({ engine: "current", mode: "seeds-only", source: "test", runs, lib: engine.library, generatedAt: "2026-10-27T10:00:00.000Z" });

  it("renders a report with the hard rules and one block per profile", () => {
    const md = renderReport(result);
    expect(md).toContain("Harde regels");
    expect(md).toContain("### P01");
    expect(md).toContain("### P20");
  });

  it("builds a blind sheet that never names the engines and keeps the sides in a separate key", () => {
    const other = { ...result, engine: "v2" as const, generatedAt: "2026-11-10T10:00:00.000Z" };
    const sheet = buildBlindSheet(result, other, { seed: "round-1" });
    expect(sheet.html).not.toMatch(/current|v2|seeds-only/);
    expect(sheet.html.match(/class="profile"/g)).toHaveLength(20);
    expect(Object.keys(sheet.key.sides)).toHaveLength(20);
    // both orders occur, and the same seed gives the same sheet
    expect(new Set(Object.values(sheet.key.sides).map((s) => s.A)).size).toBe(2);
    expect(buildBlindSheet(result, other, { seed: "round-1" }).html).toBe(sheet.html);
    expect(buildBlindSheet(result, other, { seed: "round-2" }).key.sides).not.toEqual(sheet.key.sides);
  });

  it("counts the votes against the key", () => {
    const sheet = buildBlindSheet(result, { ...result, engine: "v2" }, { seed: "t" });
    const rows = Object.keys(sheet.key.sides).map((profile) => ({ profile, question: "preference", answer: "B" }));
    const t = tallyPreferences([...rows, { profile: "P01", question: "relevance", answer: "5" }, { profile: "P02", question: "preference", answer: "geen" }], sheet.key);
    expect(t.first + t.second + t.none).toBe(21);
    expect(t.none).toBe(1);
  });
});

describe("engines and the spending lock", () => {
  it("knows current and v2, and refuses an unknown engine instead of quietly running another", () => {
    expect(getEngine("current").knowledgeV2).toBe(false);
    expect(getEngine("v2").knowledgeV2).toBe(true);
    expect(() => getEngine("nope")).toThrow(EngineNotAvailableError);
  });

  it("v2 selects differently from current (B4) but keeps every hard limit on the 20 fixed profiles", () => {
    const v2 = getEngine("v2");
    const v2Runs = runWithEngine(profiles.map(toSyntheticProfile), v2);
    const key = (r: Run) => r.sessions.map((s) => s.seeds.map((x) => `${x.direction}:${x.door}:${x.activityId}`).join(","));
    expect(v2Runs.map(key)).not.toEqual(runs.map(key));
    expect(v2.weights.strictFreeCost).toBe(true);
    expect(getEngine("current").weights.strictFreeCost).toBe(false);
    for (const run of v2Runs) expect(errorsOf(checkSeedRun(run, v2.library, undefined, { strictFreeCost: true })), run.profile.id).toEqual([]);
  }, 60_000);

  it("refuses a paid run without a confirmed cost, and runs nothing", () => {
    const cli = (...args: string[]) =>
      spawnSync(`npx tsx scripts/eval/run.ts ${args.join(" ")}`, { encoding: "utf8", shell: true, cwd: process.cwd(), timeout: 90_000 });
    const noConfirm = cli("--engine", "current", "--full", "--no-write");
    expect(noConfirm.status).toBe(2);
    expect(noConfirm.stdout).toContain("Nothing was run");
    const tooLow = cli("--engine", "current", "--full", "--confirm-cost", "1", "--no-write");
    expect(tooLow.status).toBe(2);
    expect(tooLow.stdout).toContain("Nothing was run");
    // two profiles with two engines is four books: one dollar covers the estimate, but a cap above the confirmed amount is refused
    const aboveConfirmed = cli("--engine", "current,v2", "--only", "P01,P12", "--full", "--confirm-cost", "1", "--max-usd", "2", "--no-write");
    expect(aboveConfirmed.status).toBe(2);
    expect(aboveConfirmed.stderr).toContain("not above the confirmed amount");
    const unknownProfile = cli("--engine", "current", "--only", "P99", "--no-write");
    expect(unknownProfile.status).toBe(2);
    expect(unknownProfile.stderr).toContain("Unknown profile");
  }, 240_000);

  it("runs both engines on the free path and only the profiles asked for", () => {
    const both = spawnSync("npx tsx scripts/eval/run.ts --engine current,v2 --only P01,P12 --no-write", { encoding: "utf8", shell: true, cwd: process.cwd(), timeout: 90_000 });
    expect(both.status).toBe(0);
    expect(both.stdout.match(/engine current, seeds-only/g)).toHaveLength(1);
    expect(both.stdout.match(/engine v2, seeds-only/g)).toHaveLength(1);
    expect(both.stdout).toContain("2 profielen");
  }, 120_000);
});

describe("the spending meter", () => {
  it("prices Sonnet and Haiku answers from their usage, including the cache and web searches", () => {
    expect(priceOf("claude-sonnet-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(12, 6);
    expect(priceOf("claude-haiku-4-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(6, 6);
    expect(priceOf("claude-sonnet-5", { cache_creation_input_tokens: 1_000_000 })).toBeCloseTo(2.5, 6);
    expect(priceOf("claude-sonnet-5", { cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.2, 6);
    expect(priceOf("claude-haiku-4-5", { server_tool_use: { web_search_requests: 5 } })).toBeCloseTo(0.05, 6);
    expect(priceOf("something-new", { input_tokens: 1_000_000 })).toBeCloseTo(2, 6); // unknown = the dearer rate
    expect(priceOf("claude-sonnet-5", undefined)).toBe(0);
  });

  it("adds up the cost of every answer and refuses a call that could go over the cap", async () => {
    const calls: string[] = [];
    const target = {
      create: async (args: { model: string }) => {
        calls.push(args.model);
        return { usage: { input_tokens: 10_000, output_tokens: 5_000 } }; // Sonnet: 0.02 + 0.05 = $0.07
      },
    };
    const meter = new BudgetMeter(0.3, 0.12);
    const restore = meter.wrap(target as never);
    await target.create({ model: "claude-sonnet-5" });
    await target.create({ model: "claude-sonnet-5" });
    expect(meter.spent).toBeCloseTo(0.14, 6);
    expect(meter.calls).toBe(2);
    // 0.14 spent + the 0.12 one more call may cost = 0.26 <= 0.30: allowed. After that it is 0.21 + 0.12 > 0.30.
    await target.create({ model: "claude-sonnet-5" });
    await expect(target.create({ model: "claude-sonnet-5" })).rejects.toBeInstanceOf(BudgetExceededError);
    expect(calls).toHaveLength(3);
    expect(meter.spent).toBeCloseTo(0.21, 6);
    restore();
    await target.create({ model: "claude-sonnet-5" }); // the original is back
    expect(calls).toHaveLength(4);
  });

  it("keeps room for calls that are still running, so two at once cannot both slip under the cap", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const target = { create: async () => { await gate; return { usage: { input_tokens: 1000, output_tokens: 1000 } }; } };
    const meter = new BudgetMeter(0.2, 0.12);
    meter.wrap(target as never);
    const first = target.create();
    await expect(target.create()).rejects.toBeInstanceOf(BudgetExceededError); // 1 in flight x 0.12 + this one 0.12 > 0.2
    release();
    await first;
  });

  it("only starts a whole book when it still fits", () => {
    const meter = new BudgetMeter(1);
    expect(meter.canStartBook()).toBe(true);
    meter.spent = 0.7;
    expect(meter.canStartBook()).toBe(true);
    meter.spent = 0.71;
    expect(meter.canStartBook()).toBe(false);
  });
});
