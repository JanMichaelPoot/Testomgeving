import { describe, expect, it, vi } from "vitest";
import type { GeneratedIdeaBook, IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { addsNoFacts, grammarPass, rewriteFailedIdeas, runQualityGate, type ModelCall } from "./qualityRepair";
import { qaBook, rewriteTargets, type QaContext } from "./qualityGate";

const CTX: QaContext = { locale: "nl", month: 10 };

function idea(title: string, extra: Partial<IdeaBookEntry> = {}): IdeaBookEntry {
  return {
    title,
    intro: `Een korte kennismaking met ${title}.`,
    why_it_fits: `Dit sluit aan bij wat jij zocht met ${title}.`,
    details: [`Zoek een plek voor ${title} in de buurt.`, `Boek een eerste les voor ${title}.`],
    first_action: `Open de website van ${title} en boek een proefles voor volgende week.`,
    practical: { estimated_cost: "€40", duration: "Een halve dag", difficulty: "easy", preparation: "" },
    location: null,
    requirements: [],
    image_suggestion: "",
    photo_category: "creative_workshop",
    door: "natural",
    scores: { relevance: 70, novelty: 60, feasibility: 75, surprise: 50, shareability: 60, effort: 50, cost: 40, social_fit: 60, challenge_level: 50 },
    ...extra,
  } as IdeaBookEntry;
}

const SHARED = "Het past bij de tijd die je hebt en het budget dat je opgaf.";

function repeatedBook(): GeneratedIdeaBook {
  const ideas = ["A", "B", "C", "D", "E", "F"].map((t) => idea(`Idee ${t}`));
  ideas[0] = { ...ideas[0], why_it_fits: `Mooi. ${SHARED}` };
  ideas[1] = { ...ideas[1], why_it_fits: SHARED };
  return {
    profile_summary: "Je zoekt rust.",
    must_haves: [],
    preferences: [],
    ideas,
    wildcard: idea("Wildcard"),
    labels: { steps_heading: "", first_action_heading: "", wildcard_heading: "", time_label: "", cost_label: "", location_heading: "", requirements_heading: "" },
  };
}

const rewriteRow = (entry: IdeaBookEntry, where: string, why: string) => ({ where, intro: entry.intro, why_it_fits: why, details: entry.details, first_action: entry.first_action });

describe("no new facts", () => {
  it("lets a rewrite drop facts but never add one", () => {
    expect(addsNoFacts("Kijk op klei.nl, €35 per les.", "Kijk op klei.nl.")).toBe(true);
    expect(addsNoFacts("Kijk op klei.nl, €35 per les.", "Kijk op klei.nl, €45 per les.")).toBe(false);
    expect(addsNoFacts("Boek een plek.", "Boek een plek op https://x.nl/boeken")).toBe(false);
  });
});

describe("rewriting the ideas that failed", () => {
  it("rewrites only the targeted idea and keeps the rest", async () => {
    const book = repeatedBook();
    const targets = rewriteTargets(qaBook(book, CTX));
    expect([...targets.keys()]).toEqual(["idea2"]);
    const call: ModelCall = vi.fn(async () => ({ ideas: [rewriteRow(book.ideas[1], "idea2", "Een eigen, specifieke reden voor Idee B.")] }));
    const out = await rewriteFailedIdeas(book, targets, CTX, call);
    expect(out.ideas[1].why_it_fits).toBe("Een eigen, specifieke reden voor Idee B.");
    expect(out.ideas[0]).toBe(book.ideas[0]);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("refuses a rewrite that adds a fact, drops a detail or leaves a field empty", async () => {
    const book = repeatedBook();
    const targets = rewriteTargets(qaBook(book, CTX));
    for (const bad of [
      { ...rewriteRow(book.ideas[1], "idea2", "Nu voor €99 per les."), },
      { ...rewriteRow(book.ideas[1], "idea2", "Nieuwe reden."), details: ["Maar één detail."] },
      { ...rewriteRow(book.ideas[1], "idea2", "   ") },
    ]) {
      const out = await rewriteFailedIdeas(book, targets, CTX, async () => ({ ideas: [bad] }));
      expect(out.ideas[1]).toBe(book.ideas[1]);
    }
  });

  it("leaves the book as it was when the model call fails", async () => {
    const book = repeatedBook();
    const out = await rewriteFailedIdeas(book, rewriteTargets(qaBook(book, CTX)), CTX, async () => null);
    expect(out).toBe(book);
  });
});

describe("the grammar pass", () => {
  it("applies a fix of similar length that adds no fact, and rejects the others", async () => {
    const book = repeatedBook();
    const call: ModelCall = async () => ({
      fixes: [
        { path: "idea1.intro", text: "Een korte kennismaking met Idee A, rustig." },
        { path: "idea2.intro", text: "Een korte kennismaking met Idee B voor €12." },
        { path: "idea3.intro", text: "Kort." },
        { path: "profile_summary", text: "Je zoekt echt rust." },
      ],
    });
    const { book: out, changed } = await grammarPass(book, CTX, call);
    expect(out.ideas[0].intro).toBe("Een korte kennismaking met Idee A, rustig.");
    expect(out.ideas[1].intro).toBe(book.ideas[1].intro);
    expect(out.ideas[2].intro).toBe(book.ideas[2].intro);
    expect(out.profile_summary).toBe("Je zoekt echt rust.");
    expect(changed).toBe(2);
  });

  it("does nothing on an empty or failed answer", async () => {
    const book = repeatedBook();
    expect((await grammarPass(book, CTX, async () => ({ fixes: [] }))).book).toBe(book);
    expect((await grammarPass(book, CTX, async () => null)).book).toBe(book);
  });
});

describe("the whole gate", () => {
  it("repairs what it can for free, rewrites the repeat once, then proofreads once", async () => {
    const book = repeatedBook();
    book.ideas[2] = { ...book.ideas[2], intro: "Van het station → het park." };
    const seen: string[] = [];
    const call: ModelCall = async ({ tool }) => {
      seen.push(tool.name);
      if (tool.name === "rewrite_ideas") return { ideas: [rewriteRow(book.ideas[1], "idea2", "Een eigen, specifieke reden voor Idee B.")] };
      return { fixes: [] };
    };
    const result = await runQualityGate(book, CTX, { call, grammar: true });
    expect(seen).toEqual(["rewrite_ideas", "fix_text"]);
    expect(result.book.ideas[2].intro).toBe("Van het station, het park.");
    expect(result.book.ideas[1].why_it_fits).toBe("Een eigen, specifieke reden voor Idee B.");
    expect(result.remaining).toEqual([]);
    expect(result.foundBefore.map((i) => i.code)).toEqual(expect.arrayContaining(["exposed_reasoning", "repeated_sentence"]));
    expect(result.log.join(" ")).toMatch(/exposed_reasoning_removed/);
    expect(result.log.join(" ")).toMatch(/rewrite_round_1/);
  });

  it("tries at most twice per idea, then reports what is left instead of failing", async () => {
    const book = repeatedBook();
    const call = vi.fn(async () => ({ ideas: [] }));
    const result = await runQualityGate(book, CTX, { call, grammar: false });
    expect(call).toHaveBeenCalledTimes(2);
    expect(result.remaining.map((i) => i.code)).toContain("repeated_sentence");
  });

  it("asks nothing of the model for a clean book except the proofreading", async () => {
    const clean = repeatedBook();
    clean.ideas[0] = idea("Idee A");
    clean.ideas[1] = idea("Idee B");
    const call = vi.fn(async () => ({ fixes: [] }));
    const result = await runQualityGate(clean, CTX, { call, grammar: true });
    expect(call).toHaveBeenCalledTimes(1);
    expect(result.remaining).toEqual([]);
    const none = vi.fn(async () => ({ fixes: [] }));
    await runQualityGate(clean, CTX, { call: none, grammar: false });
    expect(none).not.toHaveBeenCalled();
  });

  it("never throws: a broken model call hands the book back", async () => {
    const book = repeatedBook();
    const result = await runQualityGate(book, CTX, {
      call: async () => {
        throw new Error("boom");
      },
      grammar: true,
    });
    expect(result.log).toContain("gate_failed");
    expect(result.book).toBe(book);
  });
});
