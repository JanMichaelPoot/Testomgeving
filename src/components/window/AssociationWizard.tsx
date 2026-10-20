"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/Button";
import { LocationAutocomplete } from "@/components/ui/LocationAutocomplete";
import { WindowFrame, type WindowPaneKey } from "@/components/window/WindowFrame";
import { cn } from "@/lib/utils";
import { isRedirectError } from "@/lib/isRedirectError";
import { trackEvent } from "@/lib/posthog/client";
import { submitIntake, type IntakeAnswers } from "@/app/intake/actions";
import { domainImage } from "@/lib/discovery/paths";
import { ASSOCIATION_ROUNDS, reflectionSentence, type AssociationCard, type AssociationLibrary, type AssociationRound } from "@/lib/discovery/associationProfile";
import { sampleRoundCards } from "@/lib/discovery/associationSampling";
import { loadSeen, recordSeen } from "@/lib/associationSeen";
import { buildSill, buildVensterPanes } from "@/lib/vensterPanes";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { VENSTER_PAGES, type VensterPageId } from "@/lib/vensterPages";
import { ageOptionsFor } from "@/lib/ageOptions";

// The image intake ("Het venster", WindowInto/WINDOW_Bouwopdracht_Venster_Fase0-8.md, fase 3).
// Eight short screens in three chapters:
//   0 worlds · 1 places · 2 moments · 3 senses (optional) · 4 "your window takes shape"
//   5 where and how much room · 6 with whom (+ age, hard limits) · 7 one optional open question
// Every image lands in the window (WindowFrame), which stays in view: a sticky panel on a
// computer, an icon that opens it on a phone. Only questions that change the search are
// asked (vraag-audit, WindowInto/WINDOW_Vraag-audit_Fase1-1.md); the server derives the rest
// (src/lib/discovery/imageIntake.ts). Works for oneself and, with other wording, as a gift.

type PageId = VensterPageId;
const ROUND_OF: Partial<Record<PageId, AssociationRound>> = { places: "places", moments: "moments", senses: "senses" };
const PANE_OF: Partial<Record<PageId, WindowPaneKey>> = { worlds: "worlds", places: "places", moments: "moments", senses: "senses" };
const MAX_PER_ROUND = 5;
const MAX_WORLDS = 4;
const SWIPE_THRESHOLD = 90;
const DRAFT_KEY = "window-venster-draft-v1";

const EMPTY: IntakeAnswers = {
  situation: "",
  purpose: "self",
  purposeFollowUp: "",
  ageCategory: "",
  location: "",
  searchDistance: "city",
  freeTimePattern: "",
  practicalToWild: "either",
  timeAvailable: "",
  budget: "",
  effort: "some",
  solutionTypes: ["activity"],
  mustHaves: "",
  preferences: "",
  company: [],
  personalReflection: "",
  interests: [],
  interestDomains: [],
  socialFormats: [],
  surpriseMe: false,
  intakeVariant: "associations",
  associations: [],
  associationCorrections: [],
  recipientName: "",
};

interface Draft {
  page: number;
  answers: IntakeAnswers;
  limitChips: string[];
  limitText: string;
  /** Which images of each round this session shows (see associationSampling.ts). */
  seed: string;
  /** The images this browser had seen when the session began; fixed, so the cards stay put on a reload. */
  seen?: string[];
}

function newSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

function loadDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    if (!d.answers) return null;
    return { page: d.page ?? 0, answers: { ...EMPTY, ...d.answers }, limitChips: d.limitChips ?? [], limitText: d.limitText ?? "", seed: d.seed || newSeed(), seen: Array.isArray(d.seen) ? d.seen : undefined };
  } catch {
    return null;
  }
}

function saveDraft(d: Draft) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // Storage unavailable: the draft is simply not kept.
  }
}

function clearDraft() {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to do.
  }
}

/** Splits stored must-haves back into the chips that were ticked and the free text. */
function splitLimits(mustHaves: string, chips: string[]): { chips: string[]; text: string } {
  const parts = mustHaves.split(/\s*;\s*/).map((p) => p.trim()).filter(Boolean);
  return { chips: parts.filter((p) => chips.includes(p)), text: parts.filter((p) => !chips.includes(p)).join("; ") };
}

// Event-time clock for the measurement events (kept out of the component body).
function msSince(start: number): number {
  return Math.round(performance.now() - start);
}

function now(): number {
  return performance.now();
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Check() {
  return (
    <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-light text-accent-dark shadow">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/40",
        selected ? "border-accent-dark bg-accent-dark text-paper" : "border-border bg-paper text-ink hover:border-walnut-light",
      )}
    >
      {children}
    </button>
  );
}

export function AssociationWizard({
  intakeDict,
  dict,
  library,
  domains,
  initial,
  initialPurpose = "self",
}: {
  intakeDict: Dictionary["intake"];
  dict: Dictionary["venster"];
  library: AssociationLibrary;
  domains: { id: string; label: string }[];
  /** Changing choices before paying: stored answers and the page to open on. */
  initial?: { answers: IntakeAnswers; page: number };
  /** From the landing page's two buttons (?for=gift). */
  initialPurpose?: "self" | "gift";
}) {
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>({ ...EMPTY, purpose: initialPurpose });
  const [limitChips, setLimitChips] = useState<string[]>([]);
  const [limitText, setLimitText] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<"grid" | "swipe">("grid");
  const [swipeIdx, setSwipeIdx] = useState(0);
  const [fixing, setFixing] = useState(false);
  const [windowOpen, setWindowOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which variant of every card family this session shows; the images this browser saw before
  // are read once, so the cards do not shift while the visitor is choosing.
  const [seed, setSeed] = useState("");
  const [seenBefore, setSeenBefore] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const pageEnteredAt = useRef(0);
  const startedAt = useRef(0);

  const pageId: PageId = VENSTER_PAGES[page];
  const gift = answers.purpose === "gift";
  const name = (answers.recipientName ?? "").trim() || dict.recipientFallback;
  const fill = (s: string) => s.replaceAll("{name}", name);
  const pick = (self: string, giftText: string) => fill(gift ? giftText : self);

  // Restore once on mount: stored answers when editing, else a draft of this tab.
  useEffect(() => {
    if (initial) {
      const split = splitLimits(initial.answers.mustHaves ?? "", dict.who.limitChips);
      /* eslint-disable react-hooks/set-state-in-effect -- one-time, hydration-safe restore */
      setAnswers({ ...EMPTY, ...initial.answers });
      setLimitChips(split.chips);
      setLimitText(split.text);
      setPage(Math.min(Math.max(initial.page, 0), VENSTER_PAGES.length - 1));
      setSeed(newSeed());
      setSeenBefore(loadSeen());
    } else {
      const draft = loadDraft();
      if (draft && (draft.page > 0 || (draft.answers.associations ?? []).length > 0)) {
        setAnswers({ ...draft.answers, purpose: draft.answers.purpose === "gift" || initialPurpose === "gift" ? "gift" : "self" });
        setLimitChips(draft.limitChips);
        setLimitText(draft.limitText);
        setPage(draft.page);
        setSeed(draft.seed);
        setSeenBefore(draft.seen ?? loadSeen());
      } else {
        setSeed(newSeed());
        setSeenBefore(loadSeen());
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    setHydrated(true);
    startedAt.current = now();
    trackEvent("intake_started", { wizard_variant: "associations", editing: !!initial, gift: initialPurpose === "gift" });
    // Runs once: `initial` and `initialPurpose` are fixed for a mounted wizard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated && seed) saveDraft({ page, answers, limitChips, limitText, seed, seen: seenBefore });
  }, [hydrated, page, answers, limitChips, limitText, seed, seenBefore]);

  useEffect(() => {
    if (!hydrated) return;
    pageEnteredAt.current = now();
    trackEvent("intake_page_viewed", { wizard_variant: "associations", page: pageId, index: page, of: VENSTER_PAGES.length });
    // Only when the page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, page]);

  // --- derived ---------------------------------------------------------------------------
  const chosen = answers.associations ?? [];
  const round = ROUND_OF[pageId];
  // One variant per card family, nine cards a round; chosen cards always stay in their round.
  const chosenKey = chosen.join("|");
  const decks = useMemo(() => {
    const out = {} as Record<AssociationRound, AssociationCard[]>;
    for (const r of ASSOCIATION_ROUNDS) {
      out[r] = seed
        ? sampleRoundCards(library.cards, r, { seed, seen: seenBefore, keep: chosenKey ? chosenKey.split("|") : [] })
        : library.cards.filter((c) => c.round === r && (c.family ?? c.id) === c.id);
    }
    return out;
    // `chosenKey` only keeps what is already picked in place; it cannot change another family.
  }, [library.cards, seed, seenBefore, chosenKey]);
  const roundCards = round ? decks[round] : [];
  const chosenInRound = roundCards.filter((c) => chosen.includes(c.id)).length;

  // Remember which images this round showed, so the next visit prefers other ones.
  const shownKey = round ? decks[round].map((c) => c.id).join("|") : "";
  useEffect(() => {
    if (hydrated && seed && shownKey) recordSeen(shownKey.split("|"));
  }, [hydrated, seed, shownKey]);

  const panes = useMemo(
    () =>
      buildVensterPanes(answers, { cards: library.cards, domains }, dict, {
        active: PANE_OF[pageId],
      }),
    [answers, library.cards, domains, dict, pageId],
  );
  const sill = buildSill(answers, intakeDict, dict);

  const reflection = reflectionSentence(library, chosen, answers.associationCorrections ?? [], {
    prefix: pick(dict.reflection.prefix, dict.reflection.prefixGift),
    and: dict.reflection.and,
    nothing: dict.reflection.nothing,
    leanings: dict.reflection.leanings,
  });

  const canContinue = (() => {
    switch (pageId) {
      case "worlds":
        return (answers.interestDomains ?? []).length > 0 || !!answers.surpriseMe;
      case "places":
      case "moments":
        return chosenInRound > 0;
      case "room":
        return !!answers.timeAvailable && !!answers.budget;
      case "who":
        return answers.company.length > 0;
      default:
        return true;
    }
  })();

  // --- actions ---------------------------------------------------------------------------
  function set<K extends keyof IntakeAnswers>(key: K, value: IntakeAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function toggleWorld(id: string) {
    setAnswers((prev) => {
      const current = prev.interestDomains ?? [];
      if (!current.includes(id) && current.length >= MAX_WORLDS) return prev;
      return { ...prev, surpriseMe: false, interestDomains: toggle(current, id) };
    });
  }

  function toggleCard(id: string, force?: boolean) {
    const current = answers.associations ?? [];
    const has = current.includes(id);
    const want = force ?? !has;
    if (want === has) return;
    if (want) {
      const card = library.cards.find((c) => c.id === id);
      const inRound = library.cards.filter((c) => c.round === card?.round && current.includes(c.id)).length;
      if (inRound >= MAX_PER_ROUND) {
        setNotice(dict.roundUi.max);
        return;
      }
    }
    setNotice(null);
    set("associations", want ? [...current, id] : current.filter((x) => x !== id));
  }

  function swipe(liked: boolean) {
    const card = roundCards[swipeIdx];
    if (!card) return;
    trackEvent("association_swipe", { id: card.id, liked });
    toggleCard(card.id, liked);
    setSwipeIdx((i) => i + 1);
  }

  function go(to: number) {
    setError(null);
    setNotice(null);
    setFixing(false);
    setSwipeIdx(0);
    setPage(to);
    setWindowOpen(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    trackEvent("intake_page_back", { wizard_variant: "associations", page: pageId, index: page });
    go(Math.max(0, page - 1));
  }

  function next() {
    if (!canContinue) return;
    const duration = msSince(pageEnteredAt.current);
    if (round) {
      trackEvent("association_round_completed", { round, selected: chosenInRound, mode, duration_ms: duration });
    }
    trackEvent("intake_page_completed", { wizard_variant: "associations", page: pageId, index: page, duration_ms: duration });
    if (page < VENSTER_PAGES.length - 1) {
      go(page + 1);
      return;
    }
    submit();
  }

  function reflectionAnswer(agreed: boolean) {
    if (!agreed) {
      setFixing(true);
      return;
    }
    trackEvent("association_reflection", { agreed: !fixing, corrections: answers.associationCorrections ?? [] });
    next();
  }

  function submit() {
    const mustHaves = [...limitChips, limitText.trim()].filter(Boolean).join("; ");
    const final: IntakeAnswers = { ...answers, mustHaves, intakeVariant: "associations" };
    trackEvent("intake_submitted", {
      wizard_variant: "associations",
      pages: VENSTER_PAGES.length,
      total_ms: msSince(startedAt.current),
      images: (final.associations ?? []).length,
    });
    startTransition(async () => {
      try {
        await submitIntake(final, initial ? { edit: true } : {});
      } catch (err) {
        if (isRedirectError(err)) {
          clearDraft();
          throw err;
        }
        trackEvent("intake_submit_failed", { wizard_variant: "associations" });
        setError(dict.errorGeneric);
      }
    });
  }

  // --- swipe gesture -------------------------------------------------------------------------
  const drag = useRef<{ x0: number; dx: number } | null>(null);
  const [dx, setDx] = useState(0);
  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    drag.current = { x0: e.clientX, dx: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current.dx = e.clientX - drag.current.x0;
    setDx(drag.current.dx);
  }
  function onPointerUp() {
    const d = drag.current?.dx ?? 0;
    drag.current = null;
    setDx(0);
    if (Math.abs(d) > SWIPE_THRESHOLD) swipe(d > 0);
  }

  // --- pieces --------------------------------------------------------------------------------
  const chapter = page <= 4 ? 0 : page === 5 ? 1 : page === 6 ? 2 : 3;
  const chapterNames = [dict.chapters.images, dict.chapters.room, dict.chapters.who, dict.chapters.extra];
  const windowTitle = dict.nav.windowTitle;

  const roundPage = (r: AssociationRound) => {
    const copy = dict.rounds[r];
    const cards = decks[r];
    const current = cards[swipeIdx];
    const nextCard = cards[swipeIdx + 1];
    return (
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold">{copy.kicker}</p>
        <h1 className="mt-2 font-serif text-[28px] leading-tight text-ink sm:text-4xl">{pick(copy.heading, copy.headingGift)}</h1>
        <p className={cn("mt-2 text-ink/60", mode === "swipe" && "hidden sm:block")}>{copy.sub}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div role="group" className="inline-flex rounded-full border border-border bg-paper p-1 sm:hidden">
            {(["grid", "swipe"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m);
                  setSwipeIdx(0);
                }}
                className={cn("rounded-full px-4 py-1.5 text-xs font-semibold", mode === m ? "bg-accent-dark text-paper" : "text-ink/70")}
              >
                {m === "grid" ? dict.roundUi.grid : dict.roundUi.swipe}
              </button>
            ))}
          </div>
          <span className="text-sm font-medium text-ink/60" aria-live="polite">
            {dict.roundUi.chosen.replace("{n}", String(chosenInRound))}
          </span>
        </div>
        {notice && (
          <p className="mt-3 rounded-md bg-surface-active px-3 py-2 text-sm text-ink/80" role="status">
            {notice}
          </p>
        )}

        {mode === "swipe" ? (
          <div className="mt-4 sm:hidden">
            {current ? (
              <>
                <div className="relative mx-auto h-[min(44vh,440px)] w-full max-w-sm">
                  {nextCard && (
                    <div className="absolute inset-0 translate-y-3 scale-95 overflow-hidden rounded-2xl opacity-70">
                      <Image src={nextCard.image} alt="" fill sizes="90vw" className="object-cover" />
                    </div>
                  )}
                  <div
                    className="absolute inset-0 touch-pan-y select-none overflow-hidden rounded-2xl shadow-[0_18px_40px_-18px_rgba(60,41,32,0.5)]"
                    style={{ transform: `translateX(${dx}px) rotate(${dx / 18}deg)`, transition: dx === 0 ? "transform 0.25s" : "none" }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                  >
                    <Image src={current.image} alt={current.label} fill sizes="90vw" className="pointer-events-none object-cover" priority />
                    <span
                      className="absolute left-5 top-5 rotate-[-10deg] rounded-md border-[3px] border-gold-light px-3 py-1 text-lg font-extrabold text-gold-light"
                      style={{ opacity: Math.max(0, dx / 100) }}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span
                      className="absolute right-5 top-5 rotate-[10deg] rounded-md border-[3px] border-white px-3 py-1 text-lg font-extrabold text-white"
                      style={{ opacity: Math.max(0, -dx / 100) }}
                      aria-hidden="true"
                    >
                      ✕
                    </span>
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-5 pt-16 font-serif text-2xl leading-tight text-white">
                      {current.label}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-center text-xs text-ink/50" aria-live="polite">
                  {dict.roundUi.of.replace("{i}", String(swipeIdx + 1)).replace("{n}", String(cards.length))} · {dict.roundUi.swipeHint}
                </p>
              </>
            ) : (
              <div className="rounded-lg border border-border bg-paper p-6 text-center">
                <p className="font-serif text-2xl text-ink">{dict.roundUi.roundDone}</p>
                <p className="mt-2 text-ink/60">{dict.roundUi.roundDoneBody.replace("{n}", String(chosenInRound))}</p>
                <button type="button" className="mt-3 text-sm font-semibold text-accent underline" onClick={() => setMode("grid")}>
                  {dict.roundUi.seeAll}
                </button>
              </div>
            )}
          </div>
        ) : null}

        <div className={cn("mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3", mode === "swipe" && "hidden sm:grid")}>
          {cards.map((c) => {
            const on = chosen.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCard(c.id)}
                className={cn(
                  "group relative aspect-[4/5] overflow-hidden rounded-lg text-left transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60",
                  on && "ring-[3px] ring-gold ring-offset-2 ring-offset-cream",
                )}
              >
                <Image src={c.image} alt="" fill sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 45vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-10 text-sm font-semibold leading-snug text-white">
                  {c.label}
                </span>
                <span className="absolute right-2 top-2">{on ? <Check /> : <span className="block h-7 w-7 rounded-full border-2 border-white/80 bg-black/10" />}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const body = (() => {
    switch (pageId) {
      case "worlds":
        return (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold">{dict.chapters.images}</p>
            <h1 className="mt-2 font-serif text-[28px] leading-tight text-ink sm:text-4xl">{pick(dict.worlds.heading, dict.worlds.headingGift)}</h1>
            <p className="mt-2 text-ink/60">{dict.worlds.sub}</p>
            {gift && (
              <div className="mt-5 max-w-sm">
                <label htmlFor="recipient" className="block text-sm font-semibold text-ink">
                  {dict.recipientLabel}
                </label>
                <input
                  id="recipient"
                  value={answers.recipientName ?? ""}
                  onChange={(e) => set("recipientName", e.target.value.slice(0, 40))}
                  placeholder={dict.recipientPlaceholder}
                  className="mt-2 w-full rounded-lg border border-border bg-paper px-4 py-3 text-ink outline-none placeholder:text-ink/35 focus:border-ink"
                />
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {domains.map((d) => {
                const on = (answers.interestDomains ?? []).includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleWorld(d.id)}
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-lg text-left transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60",
                      on && "ring-[3px] ring-gold ring-offset-2 ring-offset-cream",
                      answers.surpriseMe && "opacity-50",
                    )}
                  >
                    <Image src={domainImage(d.id)} alt="" fill sizes="(min-width: 1024px) 170px, 45vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-10 text-sm font-semibold leading-snug text-white">
                      {d.label}
                    </span>
                    <span className="absolute right-2 top-2">{on ? <Check /> : <span className="block h-7 w-7 rounded-full border-2 border-white/80 bg-black/10" />}</span>
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={!!answers.surpriseMe}
                onClick={() => setAnswers((prev) => ({ ...prev, surpriseMe: !prev.surpriseMe, interestDomains: [] }))}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 text-center transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60",
                  answers.surpriseMe ? "border-accent-dark bg-accent-dark text-gold-light" : "border-gold bg-paper text-accent-dark",
                )}
              >
                <span aria-hidden="true" className="text-2xl">
                  ✦
                </span>
                <span className="font-serif text-lg">{dict.worlds.surprise}</span>
                <span className="text-xs opacity-75">{dict.worlds.surpriseSub}</span>
              </button>
            </div>
            <p className="mt-3 text-sm text-ink/60" aria-live="polite">
              {answers.surpriseMe ? dict.worlds.surpriseSub : dict.worlds.chosen.replace("{n}", String((answers.interestDomains ?? []).length))}
            </p>
          </div>
        );
      case "places":
      case "moments":
      case "senses":
        return roundPage(pageId);
      case "reflection":
        return (
          <div className="rounded-2xl bg-accent-dark px-5 py-7 text-paper sm:px-8 sm:py-9">
            <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold-light">{dict.reflection.kicker}</p>
            <h1 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">{pick(dict.reflection.heading, dict.reflection.headingGift)}</h1>
            <div className="mx-auto mt-6 w-56 sm:w-64">
              <WindowFrame panes={panes} size="hero" title={windowTitle} />
            </div>
            <p className="mt-6 font-serif text-xl leading-snug sm:text-2xl" aria-live="polite">
              {reflection.sentence} {reflection.words.length > 0 && <em>{dict.reflection.question}</em>}
            </p>
            {fixing && (
              <div className="mt-5">
                <p className="text-sm font-semibold text-gold-light">{dict.reflection.fixPrompt}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {library.correctionTags.map((t) => {
                    const on = (answers.associationCorrections ?? []).includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setAnswers((prev) => {
                            const cur = prev.associationCorrections ?? [];
                            if (!cur.includes(t) && cur.length >= 3) return prev;
                            return { ...prev, associationCorrections: toggle(cur, t) };
                          })
                        }
                        className={cn(
                          "min-h-11 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                          on ? "bg-gold-light text-accent-dark" : "bg-accent text-gold-light hover:bg-walnut-light/40",
                        )}
                      >
                        {library.tagLabels[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => reflectionAnswer(true)}
                className="min-h-12 rounded-full bg-gold-light px-6 text-sm font-bold text-accent-dark transition hover:bg-gold"
              >
                {fixing ? dict.reflection.fixDone : dict.reflection.yes}
              </button>
              {!fixing && reflection.words.length > 0 && (
                <button
                  type="button"
                  onClick={() => reflectionAnswer(false)}
                  className="min-h-12 rounded-full border border-walnut-light px-6 text-sm font-semibold text-paper transition hover:border-gold-light"
                >
                  {dict.reflection.no}
                </button>
              )}
            </div>
          </div>
        );
      case "room":
        return (
          <div className="space-y-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold">{dict.chapters.room}</p>
              <h1 className="mt-2 font-serif text-[28px] leading-tight text-ink sm:text-4xl">{pick(dict.room.heading, dict.room.headingGift)}</h1>
            </div>
            <div>
              <label htmlFor="location" className="block font-semibold text-ink">
                {pick(dict.room.locationLabel, dict.room.locationLabelGift)}
              </label>
              <p className="mt-1 text-sm text-ink/60">{dict.room.locationSub}</p>
              <LocationAutocomplete
                tidy
                id="location"
                value={answers.location}
                onChange={(v) => set("location", v)}
                placeholder={dict.room.locationPlaceholder}
              />
            </div>
            <fieldset>
              <legend className="font-semibold text-ink">{dict.room.distanceLabel}</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {dict.room.distanceOptions.map((o) => (
                  <Chip key={o.value} selected={answers.searchDistance === o.value} onClick={() => set("searchDistance", o.value)}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="font-semibold text-ink">{dict.room.timeLabel}</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {intakeDict.timeAvailable.options.map((o) => (
                  <Chip key={o.value} selected={answers.timeAvailable === o.value} onClick={() => set("timeAvailable", o.value)}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="font-semibold text-ink">{dict.room.budgetLabel}</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {intakeDict.budget.options.map((o) => (
                  <Chip key={o.value} selected={answers.budget === o.value} onClick={() => set("budget", o.value)}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </fieldset>
          </div>
        );
      case "who": {
        const how = [...new Map(answers.company.flatMap((c) => dict.who.howOptions[c] ?? []).map((o) => [o.value, o])).values()];
        return (
          <div className="space-y-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold">{dict.chapters.who}</p>
              <h1 className="mt-2 font-serif text-[28px] leading-tight text-ink sm:text-4xl">{pick(dict.who.heading, dict.who.headingGift)}</h1>
            </div>
            <fieldset>
              <legend className="font-semibold text-ink">{pick(dict.who.companyLabel, dict.who.companyLabelGift)}</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {intakeDict.company.options.map((o) => (
                  <Chip
                    key={o.value}
                    selected={answers.company.includes(o.value)}
                    onClick={() =>
                      setAnswers((prev) => {
                        const company = toggle(prev.company, o.value);
                        const allowed = new Set(["any", ...company.flatMap((c) => (dict.who.howOptions[c] ?? []).map((x) => x.value))]);
                        return { ...prev, company, socialFormats: (prev.socialFormats ?? []).filter((f) => allowed.has(f)) };
                      })
                    }
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            </fieldset>
            {how.length > 0 && (
              <fieldset>
                <legend className="font-semibold text-ink">{dict.who.howLabel}</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {how.map((o) => (
                    <Chip
                      key={o.value}
                      selected={(answers.socialFormats ?? []).includes(o.value)}
                      onClick={() => set("socialFormats", toggle((answers.socialFormats ?? []).filter((f) => f !== "any"), o.value))}
                    >
                      {o.label}
                    </Chip>
                  ))}
                  <Chip selected={(answers.socialFormats ?? []).includes("any")} onClick={() => set("socialFormats", (answers.socialFormats ?? []).includes("any") ? [] : ["any"])}>
                    {dict.who.anyLabel}
                  </Chip>
                </div>
              </fieldset>
            )}
            <fieldset>
              <legend className="font-semibold text-ink">{pick(dict.who.ageLabel, dict.who.ageLabelGift)}</legend>
              <p className="mt-1 text-sm text-ink/60">{dict.who.ageSub}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ageOptionsFor(intakeDict.ageCategory.options, gift, answers.ageCategory).map((o) => (
                  <Chip key={o.value} selected={answers.ageCategory === o.value} onClick={() => set("ageCategory", answers.ageCategory === o.value ? "" : o.value)}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="font-semibold text-ink">{dict.who.limitsLabel}</legend>
              <p className="mt-1 text-sm text-ink/60">{dict.who.limitsSub}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {dict.who.limitChips.map((c) => (
                  <Chip key={c} selected={limitChips.includes(c)} onClick={() => setLimitChips((prev) => toggle(prev, c))}>
                    {c}
                  </Chip>
                ))}
              </div>
              <input
                value={limitText}
                onChange={(e) => setLimitText(e.target.value.slice(0, 200))}
                placeholder={dict.who.limitsPlaceholder}
                aria-label={dict.who.limitsPlaceholder}
                className="mt-3 w-full rounded-lg border border-border bg-paper px-4 py-3 text-ink outline-none placeholder:text-ink/35 focus:border-ink"
              />
            </fieldset>
          </div>
        );
      }
      case "extra":
        return (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold">{dict.chapters.extra}</p>
            <h1 className="mt-2 font-serif text-[28px] leading-tight text-ink sm:text-4xl">{pick(dict.extra.heading, dict.extra.headingGift)}</h1>
            <p className="mt-2 text-ink/60">{dict.extra.sub}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {dict.extra.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("personalReflection", s)}
                  className="rounded-full border border-border bg-paper px-3.5 py-1.5 text-xs text-ink/70 transition-colors hover:border-ink/40 hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
            <textarea
              value={answers.personalReflection}
              onChange={(e) => set("personalReflection", e.target.value.slice(0, 400))}
              placeholder={dict.extra.placeholder}
              aria-label={pick(dict.extra.heading, dict.extra.headingGift)}
              rows={4}
              className="mt-4 w-full rounded-lg border border-border bg-paper px-4 py-3 leading-relaxed text-ink outline-none placeholder:text-ink/35 focus:border-ink"
            />
          </div>
        );
    }
  })();

  if (!hydrated) return <div className="min-h-[70vh] w-full" aria-hidden="true" />;

  const isReflection = pageId === "reflection";
  // On a phone, while swiping through a round, the bottom bar holds the yes/no buttons.
  const swiping = mode === "swipe" && !!round && swipeIdx < roundCards.length;
  const isLast = page === VENSTER_PAGES.length - 1;
  const optionalRound = pageId === "senses" && chosenInRound === 0;
  const primaryLabel = isLast
    ? isPending
      ? dict.nav.submitting
      : dict.nav.submit
    : optionalRound
      ? dict.roundUi.skip
      : dict.nav.next;

  return (
    <div className="w-full pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-0">
      {/* Progress: three chapters plus the optional last question, and the window icon on a phone. */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-1.5" aria-hidden="true">
          {chapterNames.map((n, i) => (
            <span key={n} className={cn("h-1.5 flex-1 rounded-full", i < chapter ? "bg-gold" : i === chapter ? "bg-accent-dark" : "bg-border")} />
          ))}
        </div>
        <span className="whitespace-nowrap text-xs font-semibold text-ink/60">
          {chapter + 1} · {chapterNames[chapter]}
        </span>
        <button
          type="button"
          onClick={() => setWindowOpen(true)}
          className="w-10 shrink-0 lg:hidden"
          aria-label={dict.nav.windowOpen}
        >
          <WindowFrame panes={panes} size="icon" title={windowTitle} />
        </button>
      </div>

      {/* Inside the long first chapter: where we are among direction, place, moment and sense. */}
      {chapter === 0 && (
        <ol className="-mt-3 mb-6 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.08em]" aria-label={dict.chapters.images}>
          {[dict.panes.worlds, dict.panes.places, dict.panes.moments, dict.panes.senses].map((label, i) => (
            <li
              key={label}
              aria-current={i === page ? "step" : undefined}
              className={cn("flex items-center gap-1.5", i === page ? "text-ink" : i < page ? "text-ink/60" : "text-ink/35")}
            >
              <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", i === page ? "bg-accent-dark" : i < page ? "bg-gold" : "bg-border")} />
              {label}
            </li>
          ))}
        </ol>
      )}

      {initial && (
        <p className="mb-5 rounded-lg border border-border bg-surface-active px-4 py-3 text-sm text-ink/70" role="status">
          {intakeDict.editBanner}
        </p>
      )}

      <div className={cn("grid gap-10", !isReflection && "lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]")}>
        <div key={pageId} className="animate-window-page-fade min-w-0">
          {body}
          {error && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {!isReflection && (
            <div
              data-testid="wizard-bar"
              className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-cream/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:static lg:mt-10 lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0"
            >
              {swiping && (
                <div className="mx-auto flex max-w-sm items-center justify-center gap-6 sm:hidden">
                  <button
                    type="button"
                    onClick={() => swipe(false)}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-paper text-ink"
                    aria-label={dict.roundUi.no}
                  >
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => swipe(true)}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-dark text-gold-light"
                    aria-label={dict.roundUi.yes}
                  >
                    <svg width="24" height="24" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M8 13.5S2.5 10.2 2.5 6.4A2.9 2.9 0 018 4.8a2.9 2.9 0 015.5 1.6C13.5 10.2 8 13.5 8 13.5z" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              )}
              <div className={cn("mx-auto flex max-w-6xl items-center gap-3", swiping && "hidden sm:flex")}>
                {page > 0 && (
                  <Button variant="secondary" onClick={back} disabled={isPending} aria-label={dict.nav.back} className="px-4">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="hidden sm:inline">{dict.nav.back}</span>
                  </Button>
                )}
                <Button onClick={next} disabled={!canContinue || isPending} className="flex-1 lg:flex-none lg:min-w-56">
                  {primaryLabel}
                </Button>
                {isLast && !answers.personalReflection.trim() && !isPending && (
                  <span className="hidden text-sm text-ink/50 sm:inline">{dict.extra.skip}</span>
                )}
              </div>
            </div>
          )}
          {isReflection && (
            <button type="button" onClick={back} className="mt-4 text-sm font-semibold text-accent underline">
              {dict.nav.back}
            </button>
          )}
        </div>

        {!isReflection && (
          <aside className="hidden lg:block">
            <div className="sticky top-8 rounded-2xl border border-border bg-paper p-6">
              <p className="font-serif text-xl text-ink">{windowTitle}</p>
              <div className="mx-auto mt-4 w-full max-w-[280px]">
                <WindowFrame panes={panes} size="panel" sill={sill || undefined} title={windowTitle} />
              </div>
              {!sill && <p className="mt-4 text-sm text-ink/50">{dict.sill.empty}</p>}
            </div>
          </aside>
        )}
      </div>

      {windowOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-accent-dark/80 p-6 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={windowTitle}
          onClick={() => setWindowOpen(false)}
        >
          <div className="w-full max-w-xs rounded-2xl bg-paper p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-serif text-xl text-ink">{windowTitle}</p>
            <div className="mx-auto mt-4 w-60">
              <WindowFrame panes={panes} size="panel" sill={sill || undefined} title={windowTitle} />
            </div>
            <Button className="mt-5 w-full" onClick={() => setWindowOpen(false)}>
              {dict.nav.windowClose}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
