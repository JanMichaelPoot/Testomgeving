"use client";

import { fillName } from "@/lib/recipientName";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/Button";
import { LocationAutocomplete } from "@/components/ui/LocationAutocomplete";
import { HOME_COUNTRY, countryOptions } from "@/lib/countries";
import type { GeoHint } from "@/lib/geo";
import { WindowFrame, type WindowKind } from "@/components/window/WindowFrame";
import { WindowDownload } from "@/components/window/WindowDownload";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/posthog/client";
import { checkPicks, saveIntake, type IntakeAnswers } from "@/app/intake/actions";
import { CheckoutPanel } from "@/components/window/CheckoutPanel";
import { TestModeBanner } from "@/components/window/TestModeBanner";
import { activityImage, domainImage } from "@/lib/discovery/paths";
import { ASSOCIATION_ROUNDS, averageAxes, tagProfile, type AssociationCard, type AssociationLibrary, type AssociationRound } from "@/lib/discovery/associationProfile";
import { assocProfile } from "@/lib/discovery/associationLayer";
import { MAX_CONCRETE_PICKS, MAX_IMAGE_PICKS, MAX_REFRESHES, composeConcretePage, registerMix, sampleBalancedBatch, type RegisteredCard } from "@/lib/discovery/twoPages";
import type { ConcretePool } from "@/lib/discovery/concretePool";
import { buildProfileStory } from "@/lib/discovery/profileStory";
import { ProfileStep, type ReadingRequest } from "@/components/window/ProfileStep";
import { interpretProfile } from "@/app/intake/interpret";
import { directionOrder, initialDirections, rotateDirections, sampleRoundCards, sampleWorldExamples } from "@/lib/discovery/associationSampling";
import { loadSeen, recordSeen } from "@/lib/associationSeen";
import { buildSill, buildWindowItems, windowImageHref } from "@/lib/vensterPanes";
import { layoutWindow } from "@/lib/windowLayout";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { DRAFT_VERSION, TWO_PAGE_LAYOUT, chapterOf, migrateDraftPage, migrateTwoPageDraft, pagesFor, type AnyVensterPageId } from "@/lib/vensterPages";
import { parseMustHaves } from "@/lib/discovery/engine/constraints";
import { hiddenByNeeds } from "@/lib/discovery/needs";
import { activityContextLean, allowedForContext, imagePreference, isForOther, normalizeSearchContext, type SearchContext } from "@/lib/discovery/audience";
import { ContextIcon } from "@/components/window/ContextIcon";
import { BUDGET_STEPS, budgetStepIndex, currentBudget } from "@/lib/budgetOptions";
import { DEFAULT_DISTANCE_KM, DISTANCE_KM_STEPS, DISTANCE_OVER_100, distanceClassFor, distanceStepIndex } from "@/lib/distanceOptions";
import { StepSlider } from "@/components/ui/StepSlider";
import { DiscoveryFlow } from "@/components/window/DiscoveryFlow";

// The image intake ("Het venster", WindowInto/WINDOW_Bouwopdracht_Venster_Fase0-8.md, fase 3).
// Seven short screens in four chapters (see vensterPages.ts):
//   0 direction · 1 places · 2 moments · 3 senses (optional)      "Jouw beelden"
//   4 where and how much room                                      "Praktisch"
//   5 with whom (+ age, hard limits)                               "Met wie"
//   6 "Zo kijken wij door jouw venster": the profile, the sliders, the one open line   "Jouw venster"
// Every image lands in the window (WindowFrame), which stays in view: a sticky panel on a
// computer, an icon that opens it on a phone. Only questions that change the search are
// asked (vraag-audit, WindowInto/WINDOW_Vraag-audit_Fase1-1.md); the server derives the rest
// (src/lib/discovery/imageIntake.ts). Works for oneself and, with other wording, for somebody else (child, other adult, group).

type PageId = AnyVensterPageId;
const ROUND_OF: Partial<Record<PageId, AssociationRound>> = { places: "places", moments: "moments", senses: "senses" };
const PANE_OF: Partial<Record<PageId, WindowKind>> = { worlds: "worlds", places: "places", moments: "moments", senses: "senses", images: "images", concrete: "picks" };
/** The two-page intake needs this many images and picks to continue (the plan advises 5-8 and 3-6; the copy says so). */
const MIN_IMAGES_REQUIRED = 3;
const MAX_PER_ROUND = 5;
const MAX_WORLDS = 4;
const SWIPE_THRESHOLD = 90;
const DRAFT_KEY = "window-venster-draft-v1";
// The two-page intake keeps its own draft, so a draft of the four-round intake is never read as one of these.
const DRAFT_KEY_TWO = "window-venster-draft-images2";

/** What page 2 showed: per screen the activity ids and which of them were the exploring slots. */
interface ConcreteState {
  /** The images chosen on page 1 when this was composed; another choice there composes page 2 again. */
  key: string;
  batches: { id: string; explore: boolean }[][];
}

const EMPTY: IntakeAnswers = {
  situation: "",
  purpose: "self",
  purposeFollowUp: "",
  ageCategory: "",
  location: "",
  country: "",
  searchDistance: "city",
  searchDistanceKm: DEFAULT_DISTANCE_KM,
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
  searchContext: "",
  intakeVariant: "associations",
  associations: [],
  associationCorrections: [],
  recipientName: "",
};

interface Draft {
  /** Layout version (vensterPages.ts); drafts without one use the old eight screens. */
  v?: number;
  page: number;
  answers: IntakeAnswers;
  limitChips: string[];
  /** Which images of each round this session shows (see associationSampling.ts). */
  seed: string;
  /** The images this browser had seen when the session began; fixed, so the cards stay put on a reload. */
  seen?: string[];
  /** Two-page intake: the extra pages of images ("Andere beelden"), as card ids. */
  imageMore?: string[][];
  /** Two-page intake: page 2 as it was shown. */
  concrete?: ConcreteState | null;
  /** Two-page intake: layout of the pages (vensterPages.ts TWO_PAGE_LAYOUT); a draft without it had no start page. */
  layout?: number;
  /** Two-page intake: page 1 as it was first shown, with the search context it was drawn for (so a late change of context moves nothing). */
  imageFirst?: { ctx: string; ids: string[] } | null;
}

function newSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

function loadDraft(key: string): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    if (!d.answers) return null;
    return {
      v: DRAFT_VERSION,
      page: key === DRAFT_KEY_TWO ? migrateTwoPageDraft(d.page ?? 0, d.layout) : migrateDraftPage(d.page ?? 0, d.v),
      answers: { ...EMPTY, ...d.answers },
      limitChips: d.limitChips ?? [],
      seed: d.seed || newSeed(),
      seen: Array.isArray(d.seen) ? d.seen : undefined,
      imageMore: Array.isArray(d.imageMore) ? d.imageMore : undefined,
      concrete: d.concrete ?? null,
      imageFirst: d.imageFirst ?? null,
    };
  } catch {
    return null;
  }
}

function saveDraft(key: string, d: Draft) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ ...d, v: DRAFT_VERSION, layout: TWO_PAGE_LAYOUT }));
  } catch {
    // Storage unavailable: the draft is simply not kept.
  }
}

function clearDraft(key: string) {
  try {
    window.sessionStorage.removeItem(key);
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

/** How many of a list of (possibly unknown) registers are in each register: the numbers the two-page events carry. */
function registerCounts(list: (string | undefined)[]) {
  const c = { expressive: 0, nurturing: 0, technical: 0, nature: 0 };
  for (const r of list) if (r && r in c) c[r as keyof typeof c] += 1;
  return c;
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Check() {
  return (
    <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-light text-accent-dark shadow sm:h-7 sm:w-7">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** Answers from an older draft or session carry the three-way distance only: the slider needs kilometres. "Who comes along" is no longer asked. */
function withKm(a: IntakeAnswers): IntakeAnswers {
  const km = a.searchDistanceKm ?? (a.searchDistance === "hour" ? 50 : a.searchDistance === "anywhere" ? DISTANCE_OVER_100 : DEFAULT_DISTANCE_KM);
  return { ...a, searchDistanceKm: km, searchDistance: distanceClassFor(km), company: [] };
}

/** "Other images" / "other activities": the one action that is always worth pressing, so it looks like one. */
const MORE_BUTTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-accent-dark bg-accent-dark px-5 text-[15px] font-semibold text-paper shadow-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60 disabled:opacity-50 max-sm:w-full";

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3v5h-5M3 21v-5h5" />
    </svg>
  );
}

/** How many have been chosen against how many are needed: dots that fill up, and a plain sentence for what is still missing. */
function ChoiceProgress({ chosen, needed, chosenText, missingText, className }: { chosen: number; needed: number; chosenText: string; missingText: string | null; className?: string }) {
  const enough = chosen >= needed;
  return (
    <div
      aria-live="polite"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border-2 px-4 py-3",
        enough ? "border-gold/60 bg-gold/10" : "border-accent-dark/40 bg-paper",
        className,
      )}
    >
      <span className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: needed }).map((_, i) => (
          <span key={i} className={cn("size-3.5 rounded-full border-2", i < chosen ? "border-gold bg-gold" : "border-accent-dark/40")} />
        ))}
      </span>
      <p className="text-sm font-semibold text-ink">{chosenText}</p>
      {!enough && missingText && <p className="text-sm text-ink/80">{missingText}</p>}
    </div>
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

/** What the last screen needs to take the payment itself (the separate checkout page is gone for this intake, D3). */
export interface WizardPayment {
  dict: Dictionary["checkout"];
  price: string;
  /** True for a visitor whose device already has the opt-in cookie (herhalingsgeheugen). */
  rememberInitially: boolean;
  /** The text of the test banner on the test preview; the banner itself always shows (it holds the "skip payment" test button). */
  testNotice?: string;
  /** Stripe sent the visitor back after a cancelled or failed payment. */
  paymentFailed: boolean;
  /** The price-test variant this visitor was shown; null while the test is off. */
  priceVariant: string | null;
}

export function AssociationWizard({
  intakeDict,
  dict,
  library,
  domains,
  initial,
  payment,
  flow,
  concretePool,
  geo,
  locale,
}: {
  intakeDict: Dictionary["intake"];
  dict: Dictionary["venster"];
  library: AssociationLibrary;
  domains: { id: string; label: string }[];
  /** Changing choices before paying: stored answers and the page to open on. */
  initial?: { answers: IntakeAnswers; page: number };
  payment: WizardPayment;
  /** "images2": the intake in two image pages (docs/fase4-opzet.md). Absent: the four rounds. */
  flow?: "images2";
  /** Two-page intake: the activities page 2 draws from (server-built, one language, in season). */
  concretePool?: ConcretePool;
  /** Where the visitor's connection seems to be: pre-fills the country and place (always editable). */
  geo?: GeoHint | null;
  locale: "nl" | "en";
}) {
  const flow2 = flow === "images2";
  const pages = pagesFor(flow);
  const draftKey = flow2 ? DRAFT_KEY_TWO : DRAFT_KEY;
  const variantName = flow2 ? "images2" : "associations";
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>({ ...EMPTY, ...(flow2 ? { intakeFlow: "images2" as const } : {}) });
  // Two pages: extra pages of images ("Andere beelden") and page 2 as shown.
  const [imageMore, setImageMore] = useState<string[][]>([]);
  // Which set of images or activities is in view: null = the newest. Going back through the sets loses nothing that was chosen.
  const [imageView, setImageView] = useState<number | null>(null);
  const [concreteView, setConcreteView] = useState<number | null>(null);
  const [concrete, setConcrete] = useState<ConcreteState | null>(null);
  // Two pages: page 1 as first shown (and the search context it was drawn for), kept so choosing or a late change of context moves nothing.
  const [imageFirst, setImageFirst] = useState<{ ctx: string; ids: string[] } | null>(null);
  // Two pages: chosen activities that a limit of the situation screen rules out (asked of the server when the profile screen is open).
  const [dropped, setDropped] = useState<{ id: string; reason: string }[]>([]);
  // The `limitsKey` the `dropped` list was computed for: the portrait names the person's own picks only once the check has run for the current answers.
  const [droppedFor, setDroppedFor] = useState("");
  const [limitChips, setLimitChips] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // The place and country were filled in from the connection and not touched since: a note says so.
  const [geoFilled, setGeoFilled] = useState<{ location: string; country: string } | null>(null);
  const [mode, setMode] = useState<"grid" | "swipe">("grid");
  const [swipeIdx, setSwipeIdx] = useState(0);
  const [windowOpen, setWindowOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which variant of every card family this session shows; the images this browser saw before
  // are read once, so the cards do not shift while the visitor is choosing.
  const [seed, setSeed] = useState("");
  // The direction tapped last: its example activities show in one line under the grid.
  const [hintWorld, setHintWorld] = useState<string | null>(null);
  // Ten of the directions at a time; "show other directions" walks on through the rest (what is chosen stays).
  const [rotated, setRotated] = useState<string[] | null>(null);
  const hintDomain = domains.find((d) => d.id === hintWorld) ?? null;
  const directionKey = domains.map((d) => d.id).join("|");
  const order = useMemo(() => directionOrder(directionKey.split("|"), seed || "initial"), [directionKey, seed]);
  const shownIds = rotated ?? initialDirections(order, answers.interestDomains ?? []);
  const shownDomains = shownIds.map((id) => domains.find((d) => d.id === id)).filter((d): d is { id: string; label: string } => !!d);
  const [seenBefore, setSeenBefore] = useState<string[]>([]);
  const pageEnteredAt = useRef(0);
  const startedAt = useRef(0);

  const pageId: PageId = pages[page];
  // "For somebody else": the start page's child / other adult / group. The "...Gift" keys of the copy hold that wording.
  const searchContext = normalizeSearchContext(answers.searchContext);
  const forOther = isForOther(answers);
  // The first name as typed ("" when there is none): texts with variants then use the one that never names the person (see recipientName.ts).
  const name = (answers.recipientName ?? "").trim();
  const group = searchContext === "group";
  const fill = (s: string) => fillName(s, name, { group, fallback: dict.recipientFallback });
  const pick = (self: string, otherText: string) => fill(forOther ? otherText : self);

  // Restore once on mount: stored answers when editing, else a draft of this tab.
  useEffect(() => {
    if (initial) {
      const split = splitLimits(initial.answers.mustHaves ?? "", dict.who.limitChips);
      /* eslint-disable react-hooks/set-state-in-effect -- one-time, hydration-safe restore */
      // The "how" and age answers are no longer asked: whatever an older session holds must not steer the book unseen.
      setAnswers(withKm({ ...EMPTY, ...initial.answers, budget: currentBudget(initial.answers.budget ?? ""), socialFormats: [], ageCategory: "" }));
      setLimitChips(split.chips);
      setPage(Math.min(Math.max(initial.page, 0), pages.length - 1));
      setSeed(newSeed());
      setSeenBefore(loadSeen());
    } else {
      const draft = loadDraft(draftKey);
      if (draft && (draft.page > 0 || (draft.answers.associations ?? []).length > 0 || draft.answers.location.trim().length > 0 || normalizeSearchContext(draft.answers.searchContext) !== "unknown")) {
        setAnswers(
          withKm({
            ...draft.answers,
            ...(flow2 ? { intakeFlow: "images2" as const } : {}),
            budget: currentBudget(draft.answers.budget ?? ""),
            socialFormats: [],
            ageCategory: "",
            purpose: "self",
          }),
        );
        setLimitChips(draft.limitChips);
        setPage(draft.page);
        setSeed(draft.seed);
        setSeenBefore(draft.seen ?? loadSeen());
        setImageMore(draft.imageMore ?? []);
        setConcrete(draft.concrete ?? null);
        setImageFirst(draft.imageFirst ?? null);
      } else {
        setSeed(newSeed());
        setSeenBefore(loadSeen());
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    setHydrated(true);
    startedAt.current = now();
    trackEvent("intake_started", { wizard_variant: variantName, editing: !!initial });
    // Runs once: `initial` is fixed for a mounted wizard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-fill the country and place from the connection (Vercel's headers, see lib/geo.ts) as an indication: only when nothing was answered yet
  // (no stored answers, no draft with a place), only once, and always editable.
  const geoDone = useRef(false);
  useEffect(() => {
    if (!hydrated || geoDone.current) return;
    geoDone.current = true;
    if (initial || !geo) return;
    if (answers.location.trim() !== "" || (answers.country ?? "") !== "") return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time pre-fill after the draft was restored */
    setAnswers((prev) => ({ ...prev, location: geo.city, country: geo.country }));
    setGeoFilled({ location: geo.city, country: geo.country });
    /* eslint-enable react-hooks/set-state-in-effect */
    // Runs once, after the restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    if (hydrated && seed) saveDraft(draftKey, { page, answers, limitChips, seed, seen: seenBefore, imageMore, concrete, imageFirst });
  }, [hydrated, page, answers, limitChips, seed, seenBefore, draftKey, imageMore, concrete, imageFirst]);

  useEffect(() => {
    if (!hydrated) return;
    pageEnteredAt.current = now();
    trackEvent("intake_page_viewed", { wizard_variant: variantName, page: pageId, index: page, of: pages.length });
    if (pageId === "profile") trackEvent("profile_viewed");
    // Only when the page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, page]);

  // --- derived ---------------------------------------------------------------------------
  const chosen = answers.associations ?? [];
  const round = ROUND_OF[pageId];
  // One variant per card family, nine of the twelve families a round; chosen cards always stay in their round.
  const chosenKey = chosen.join("|");
  const decks = useMemo(() => {
    const out = {} as Record<AssociationRound, AssociationCard[]>;
    for (const r of ASSOCIATION_ROUNDS) {
      // Before the session seed exists (the first render) a fixed seed gives the same nine as the server drew.
      out[r] = sampleRoundCards(library.cards, r, { seed: seed || "initial", seen: seenBefore, keep: chosenKey ? chosenKey.split("|") : [] });
    }
    return out;
    // `chosenKey` only keeps what is already picked in place; it cannot change another family.
  }, [library.cards, seed, seenBefore, chosenKey]);
  const roundCards = round ? decks[round] : [];
  const chosenInRound = roundCards.filter((c) => chosen.includes(c.id)).length;

  // --- two-page intake: page 1 (balanced images) and page 2 (concrete activities that follow from them) ------------------
  const registered = useMemo(
    () => library.cards.filter((c): c is AssociationCard & RegisteredCard => c.register !== undefined),
    [library.cards],
  );
  const cardById = useMemo(() => new Map(library.cards.map((c) => [c.id, c])), [library.cards]);
  // The first page depends on the session seed (and what this browser saw) only, never on what is chosen, so choosing moves nothing.
  // It leans on who the search is for (audience.ts) but only that: choosing moves nothing. Once shown it is kept in the draft.
  const computedFirst = useMemo(
    () =>
      flow2 && seed
        ? sampleBalancedBatch(registered, {
            seed,
            seen: seenBefore,
            prefer:
              searchContext === "child" || searchContext === "group"
                ? (card, index) => imagePreference(card, { context: searchContext, chosenTags: {}, refresh: 0, index })
                : undefined,
          }).map((c) => c.id)
        : [],
    [flow2, seed, registered, seenBefore, searchContext],
  );
  const firstImages = imageFirst && imageFirst.ids.length > 0 && (imageFirst.ctx === searchContext || (answers.associations ?? []).length > 0) ? imageFirst.ids : computedFirst;
  const imageBatches = [firstImages, ...imageMore];
  const imageViewIdx = Math.min(imageView ?? imageBatches.length - 1, imageBatches.length - 1);
  const currentImageIds = imageBatches[imageViewIdx] ?? [];
  const currentImages = currentImageIds.map((id) => cardById.get(id)).filter((c): c is AssociationCard => !!c);
  const imageRefreshes = imageMore.length;
  const picks = answers.interests ?? [];
  const chosenImagesKey = chosen.join("|");
  // Page 2 is composed again when the images or who the search is for change.
  // Going with children (the start page chip) keeps the same short list of unsuitable activities off page 2 as a young searcher does.
  const chipNeeds = useMemo(() => parseMustHaves(limitChips.join("; ")), [limitChips]);
  const withKids = chipNeeds.verify.includes("children");
  // The same applies to the other needs the chips state (suitability.ts, needs.ts): what is known not to suit them is not offered on page 2.
  const needsKey = `${withKids ? "+kids" : ""}${(["youngKids", "wheelchair", "calmPace", "noAlcohol", "quiet", "meetPeople", "withOne", "withGroup"] as const).map((k) => (chipNeeds[k] ? `+${k}` : "")).join("")}`;
  const concreteKey = `${searchContext}${needsKey}#${chosenImagesKey}`;
  const allActivities = concretePool?.activities;
  const poolById = useMemo(() => new Map((allActivities ?? []).map((a) => [a.id, a])), [allActivities]);
  // For a child or young person nothing with alcohol, gambling, weapons or heavy tools is offered.
  const poolActivities = useMemo(
    () =>
      allActivities?.filter(
        (a) =>
          allowedForContext(a, searchContext) &&
          (!withKids || allowedForContext(a, "child")) &&
          !hiddenByNeeds(a.unfit, chipNeeds),
      ),
    [allActivities, searchContext, withKids, chipNeeds],
  );
  const contextPrefer = useMemo(
    () =>
      searchContext === "child" || searchContext === "group"
        ? (a: { tags: readonly string[] }) => 0.5 + activityContextLean(a.tags, searchContext)
        : undefined,
    [searchContext],
  );
  const concreteBatches = concrete?.key === concreteKey ? concrete.batches : [];
  const concreteViewIdx = Math.min(concreteView ?? concreteBatches.length - 1, Math.max(0, concreteBatches.length - 1));
  const currentConcrete = concreteBatches[concreteViewIdx] ?? [];
  const concreteRefreshes = Math.max(0, concreteBatches.length - 1);
  // The images chosen on page 1 are what page 2 follows (and how they divide over the registers, a number nobody sees).
  function concreteInput() {
    const ids = chosenImagesKey ? chosenImagesKey.split("|") : [];
    const cards = ids.map((id) => cardById.get(id)).filter((c): c is AssociationCard => !!c);
    return {
      profile: tagProfile(library.cards, ids),
      // The association layer (server-side flag): the images carry what they evoke only while it is on.
      assocProfile: cards.some((c) => c.assoc) ? assocProfile(cards) : undefined,
      axes: averageAxes(library.cards, ids),
      genericTags: new Set(concretePool?.genericTags ?? []),
      mix: registerMix(cards.filter((c): c is AssociationCard & RegisteredCard => c.register !== undefined)),
    };
  }
  useEffect(() => {
    if (!flow2 || !hydrated || !seed || !poolActivities || pageId !== "concrete") return;
    if (concrete?.key === concreteKey) return;
    const slots = composeConcretePage(poolActivities, { seed, keep: picks, prefer: contextPrefer, ...concreteInput() });
    // Page 2 is composed once per set of chosen images and then kept in the draft, so a reload shows the same page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConcrete({ key: concreteKey, batches: [slots.map((x) => ({ id: x.activity.id, explore: x.explore }))] });
    // concreteInput reads only the values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow2, hydrated, seed, poolActivities, pageId, concreteKey, concrete?.key]);
  // The profile screen names a chosen activity that the limits given afterwards rule out, instead of letting it go missing from the book.
  const limitsKey = [answers.budget, answers.timeAvailable, answers.mustHaves, limitChips.join(","), (answers.socialFormats ?? []).join(","), picks.join(","), chosenImagesKey, JSON.stringify(answers.axesOverride ?? {})].join("|");
  useEffect(() => {
    if (!flow2 || !hydrated || pageId !== "profile") return;
    let cancelled = false;
    const mustHaves = limitChips.join("; ");
    checkPicks({ ...answers, mustHaves, intakeVariant: "associations", intakeFlow: "images2" })
      .then((list) => {
        if (cancelled) return;
        setDropped(list);
        setDroppedFor(limitsKey);
      })
      .catch(() => {
        if (cancelled) return;
        setDropped([]);
        setDroppedFor(limitsKey);
      });
    return () => {
      cancelled = true;
    };
    // The key lists every answer the check reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow2, hydrated, pageId, limitsKey]);
  // Page 1 as first shown is kept (with the context it was drawn for), so a later choice or change of context does not move it.
  useEffect(() => {
    if (!flow2 || !hydrated || !seed || pageId !== "images" || computedFirst.length === 0) return;
    if (imageFirst && (imageFirst.ctx === searchContext || (answers.associations ?? []).length > 0)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImageFirst({ ctx: searchContext, ids: computedFirst });
    // Only when the page or the context changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow2, hydrated, seed, pageId, searchContext, computedFirst]);
  // Remember which images were shown, for the next visit.
  const imagesShownKey = flow2 ? currentImageIds.join("|") : "";
  useEffect(() => {
    if (hydrated && seed && imagesShownKey) recordSeen(imagesShownKey.split("|"));
  }, [hydrated, seed, imagesShownKey]);

  // Remember which images this round showed, so the next visit prefers other ones.
  const shownKey = round ? decks[round].map((c) => c.id).join("|") : "";
  useEffect(() => {
    if (hydrated && seed && shownKey) recordSeen(shownKey.split("|"));
  }, [hydrated, seed, shownKey]);

  const windowItems = useMemo(
    () => buildWindowItems(answers, { cards: library.cards, domains, activities: poolActivities }, dict),
    [answers, library.cards, domains, dict, poolActivities],
  );
  // The window is complete when its screen (the profile) opens: how many images it holds and how many panes they became.
  useEffect(() => {
    if (!hydrated || pageId !== "profile") return;
    trackEvent("window_completed", { images: windowItems.length, panes: layoutWindow(windowItems).panes.length });
    // Only when the page changes; the items at that moment are what the window holds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, page]);
  const activeKind = PANE_OF[pageId];
  const exportHref = windowImageHref(answers);
  const sill = buildSill(answers, intakeDict, dict);

  // The profile screen's sentences are built from fixed parts (profileStory.ts), cheap enough to
  // compute on every render of that screen.
  const profile =
    pageId === "profile"
      ? buildProfileStory(
          {
            cards: library.cards,
            tagLabels: library.tagLabels,
            chosen,
            corrections: answers.associationCorrections ?? [],
            override: answers.axesOverride,
            timeAvailable: answers.timeAvailable,
            budget: answers.budget,
            searchDistance: answers.searchDistance,
            company: answers.company,
            socialFormats: answers.socialFormats ?? [],
            mustHaves: limitChips.join("; "),
            forOther,
            name,
            group,
            fallbackName: dict.recipientFallback,
            // A pick that a limit rules out ("Dit kon niet mee") is not a starting point either.
            picks: flow2 ? (droppedFor === limitsKey ? picks.filter((id) => !dropped.some((d) => d.id === id)) : []).map((id) => poolById.get(id)?.label).filter((l): l is string => !!l) : undefined,
          },
          dict.profile,
        )
      : null;

  const canContinue = (() => {
    switch (pageId) {
      case "start":
        // The place is what the real-places search starts from, so it is the one required answer.
        return answers.location.trim().length > 0;
      case "images":
        return chosen.length >= MIN_IMAGES_REQUIRED;
      case "concrete":
        return picks.length >= 1 || !!answers.surpriseMe;
      case "worlds":
        return (answers.interestDomains ?? []).length > 0 || !!answers.surpriseMe;
      case "places":
      case "moments":
        return chosenInRound > 0;
      case "situation":
        // The place is what the real-places search starts from, so it is not optional.
        return answers.location.trim().length > 0 && !!answers.timeAvailable && !!answers.budget;
      default:
        return true;
    }
  })();

  // Why "Next" is greyed out, in a line above the bar (nothing once it is active; the last screen, the profile, has no "Next").
  const continueHint = (() => {
    if (canContinue) return "";
    const h = dict.nav.hint;
    switch (pageId) {
      case "start":
        return h.missing.replace("{list}", h.place);
      case "images":
        return h.images.replace("{n}", String(MIN_IMAGES_REQUIRED));
      case "concrete":
        return h.concrete;
      case "worlds":
        return h.worlds;
      case "places":
      case "moments":
        return h.round;
      case "situation": {
        const missing = [
          answers.location.trim().length === 0 && h.place,
          !answers.timeAvailable && h.time,
          !answers.budget && h.budget,
        ].filter((x): x is string => !!x);
        return h.missing.replace("{list}", missing.join(", "));
      }
      default:
        return "";
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
    if (want && flow2) {
      // Two pages: eight images in all, from whichever page.
      if (current.length >= MAX_IMAGE_PICKS) {
        setNotice(dict.twoPages.images.max);
        return;
      }
    } else if (want) {
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

  /** Page 2: choose or drop an activity (at most six; choosing one ends "choose for me"). */
  function togglePick(id: string) {
    const current = answers.interests ?? [];
    if (!current.includes(id) && current.length >= MAX_CONCRETE_PICKS) {
      setNotice(dict.twoPages.concrete.max.replace("{max}", String(MAX_CONCRETE_PICKS)));
      return;
    }
    setNotice(null);
    setAnswers((prev) => {
      const list = prev.interests ?? [];
      return { ...prev, surpriseMe: false, interests: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
    });
  }

  /** "Andere beelden": a new page of images, none of the families shown before; what was chosen stays. */
  function moreImages() {
    if (imageRefreshes >= MAX_REFRESHES) return;
    // The follow-up page deepens what was chosen so far and, on every other card, opens something not yet chosen (audience.ts imagePreference).
    const chosenTags = tagProfile(library.cards, chosen);
    const next = sampleBalancedBatch(registered, {
      seed,
      refresh: imageRefreshes + 1,
      keep: chosen,
      exclude: imageBatches.flat(),
      seen: seenBefore,
      prefer: (card, index) => imagePreference(card, { context: searchContext, chosenTags, refresh: imageRefreshes + 1, index }),
    }).map((c) => c.id);
    setImageMore((prev) => [...prev, next]);
    setImageView(null);
    setNotice(null);
  }

  /** "Andere activiteiten": a new page of activities, none shown before; what was chosen stays. */
  function moreConcrete() {
    if (!poolActivities || concreteRefreshes >= MAX_REFRESHES) return;
    const shown = concreteBatches.flat().map((x) => x.id);
    const slots = composeConcretePage(poolActivities, { seed, refresh: concreteRefreshes + 1, keep: picks, exclude: shown, prefer: contextPrefer, ...concreteInput() });
    setConcrete({ key: concreteKey, batches: [...concreteBatches, slots.map((x) => ({ id: x.activity.id, explore: x.explore }))] });
    setConcreteView(null);
    setNotice(null);
  }

  /** "Kies voor mij": no activities of their own; the engine chooses from the images alone. */
  function chooseForMe() {
    setNotice(null);
    setAnswers((prev) => ({ ...prev, surpriseMe: !prev.surpriseMe, interests: [] }));
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
    setSwipeIdx(0);
    setPage(to);
    setWindowOpen(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    trackEvent("intake_page_back", { wizard_variant: variantName, page: pageId, index: page });
    go(Math.max(0, page - 1));
  }

  function next() {
    if (!canContinue) return;
    const duration = msSince(pageEnteredAt.current);
    if (round) {
      trackEvent("association_round_completed", { round, selected: chosenInRound, mode, duration_ms: duration });
    }
    if (pageId === "images") {
      const n = registerCounts(chosen.map((id) => cardById.get(id)?.register));
      trackEvent("images_done", { wizard_variant: variantName, selected: chosen.length, refreshes: imageRefreshes });
      trackEvent("images_page_completed", { selected: chosen.length, refreshes: imageRefreshes, n_expressive: n.expressive, n_nurturing: n.nurturing, n_technical: n.technical, n_nature: n.nature });
    }
    if (pageId === "concrete") {
      const n = registerCounts(picks.map((id) => poolById.get(id)?.register));
      const explored = new Set(concreteBatches.flat().filter((x) => x.explore).map((x) => x.id));
      trackEvent("activities_done", {
        wizard_variant: variantName,
        selected: picks.length,
        refreshes: concreteRefreshes,
        explore_picked: picks.filter((id) => explored.has(id)).length,
      });
      trackEvent("concrete_page_completed", {
        selected: picks.length,
        refreshes: concreteRefreshes,
        explore_picked: picks.filter((id) => explored.has(id)).length,
        n_expressive: n.expressive,
        n_nurturing: n.nurturing,
        n_technical: n.technical,
        n_nature: n.nature,
      });
    }
    if (pageId === "situation") trackEvent("situation_done", { wizard_variant: variantName, duration_ms: duration });
    if (pageId === "start") {
      trackEvent("situation_done", { wizard_variant: variantName, duration_ms: duration });
      trackEvent("search_context_set", {
        context: searchContext,
        has_limits: answers.timeAvailable !== "" || answers.budget !== "" || limitChips.length > 0,
      });
    }
    trackEvent("intake_page_completed", { wizard_variant: variantName, page: pageId, index: page, duration_ms: duration });
    // The last screen has no "next": paying is on that screen itself (saveForPayment below).
    if (page < pages.length - 1) go(page + 1);
  }

  // What the model-written reading is made from (ids only; the server rebuilds the facts). Only for the screen that shows it.
  const readingRequest: ReadingRequest | null =
    pageId === "profile" && chosen.length > 0
      ? {
          associations: chosen,
          interests: flow2 ? picks.filter((id) => droppedFor !== limitsKey || !dropped.some((d) => d.id === id)) : [],
          corrections: answers.associationCorrections ?? [],
          axesOverride: answers.axesOverride,
          searchContext: answers.searchContext,
          purpose: answers.purpose,
          recipientName: answers.recipientName,
        }
      : null;

  // On the last screen the order block is below the reading: a bar button jumps to it until it is in view.
  const [orderInView, setOrderInView] = useState(false);
  useEffect(() => {
    if (pageId !== "profile" || typeof IntersectionObserver === "undefined") return;
    const el = document.getElementById("bestellen");
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setOrderInView(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageId, hydrated]);

  // Set once the answers are stored: a second try (a failed payment start) then replaces them in the same session.
  const stored = useRef(false);

  /** Stores the answers right before the payment starts; throws (with a message for the visitor) when that is not allowed. */
  async function saveForPayment() {
    const mustHaves = limitChips.join("; ");
    const final: IntakeAnswers = { ...answers, socialFormats: [], ageCategory: "", mustHaves, intakeVariant: "associations", ...(flow2 ? { intakeFlow: "images2" as const, interestDomains: [] } : {}) };
    trackEvent("profile_agreed", {
      adjusted: Object.keys(answers.axesOverride ?? {}).length > 0 || (answers.associationCorrections ?? []).length > 0,
    });
    trackEvent("profile_reflection", { has_reflection: answers.personalReflection.trim().length > 0 });
    trackEvent("intake_submitted", {
      wizard_variant: variantName,
      pages: pages.length,
      total_ms: msSince(startedAt.current),
      images: (final.associations ?? []).length,
    });
    let result: Awaited<ReturnType<typeof saveIntake>>;
    try {
      result = await saveIntake(final, initial || stored.current ? { edit: true } : {});
    } catch (err) {
      trackEvent("intake_submit_failed", { wizard_variant: variantName });
      throw new Error(dict.errorGeneric, { cause: err });
    }
    if (!result.ok) throw new Error(dict.testLimit.body);
    stored.current = true;
    clearDraft(draftKey);
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
  const chapter = chapterOf(pageId);
  // Two pages: start page, then the images, then the window. Four rounds: images, situation, window.
  const chapterNames = flow2 ? [dict.chapters.situation, dict.chapters.images, dict.chapters.extra] : [dict.chapters.images, dict.chapters.situation, dict.chapters.extra];
  const windowTitle = dict.nav.windowTitle;

  const roundPage = (r: AssociationRound) => {
    const copy = dict.rounds[r];
    const cards = decks[r];
    const current = cards[swipeIdx];
    const nextCard = cards[swipeIdx + 1];
    return (
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold-text">{copy.kicker}</p>
        <h1 className="mt-2 font-serif text-[28px] leading-tight text-ink sm:text-4xl">{pick(copy.heading, copy.headingGift)}</h1>
        <p className={cn("mt-2 text-ink/70", mode === "swipe" && "hidden sm:block")}>{copy.sub}</p>
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
          <span className="text-sm font-medium text-ink/70" aria-live="polite">
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
                <p className="mt-3 text-center text-xs text-ink/70" aria-live="polite">
                  {dict.roundUi.of.replace("{i}", String(swipeIdx + 1)).replace("{n}", String(cards.length))} · {dict.roundUi.swipeHint}
                </p>
              </>
            ) : (
              <div className="rounded-lg border border-border bg-paper p-6 text-center">
                <p className="font-serif text-2xl text-ink">{dict.roundUi.roundDone}</p>
                <p className="mt-2 text-ink/70">{dict.roundUi.roundDoneBody.replace("{n}", String(chosenInRound))}</p>
                <button type="button" className="mt-3 text-sm font-semibold text-accent underline" onClick={() => setMode("grid")}>
                  {dict.roundUi.seeAll}
                </button>
              </div>
            )}
          </div>
        ) : null}

        <div className={cn("mt-5 grid grid-cols-3 gap-2 sm:gap-3", mode === "swipe" && "hidden sm:grid")}>
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
                <Image src={c.image} alt="" fill sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8 text-xs font-semibold leading-tight text-white sm:px-3 sm:pb-3 sm:pt-10 sm:text-sm sm:leading-snug">
                  {c.label}
                </span>
                <span className="absolute right-1.5 top-1.5 sm:right-2 sm:top-2">{on ? <Check /> : <span className="block h-6 w-6 rounded-full border-2 border-white/80 bg-black/10 sm:h-7 sm:w-7" />}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  /**
   * Previous / next through the sets of images or activities already shown, and the button for a brand new set at the end. A choice
   * is never lost by going back: what was chosen stays chosen whichever set it came from.
   */
  const setControls = (opts: { total: number; view: number; setView: (i: number | null) => void; canMore: boolean; onMore: () => void; moreLabel: string; moreSub: string; noMore: string; disabled?: boolean }) => {
    const btn =
      "inline-flex min-h-11 items-center rounded-lg border border-border bg-paper px-4 text-sm font-semibold text-ink transition hover:border-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60 disabled:opacity-50";
    const atEnd = opts.view >= opts.total - 1;
    return (
      <>
        {opts.view > 0 && (
          <button type="button" data-testid="set-prev" disabled={opts.disabled} onClick={() => opts.setView(opts.view - 1)} className={btn}>
            {dict.twoPages.sets.prev}
          </button>
        )}
        {opts.total > 1 && (
          <span className="text-sm font-medium text-ink/70" aria-live="polite" data-testid="set-counter">
            {dict.twoPages.sets.counter.replace("{i}", String(opts.view + 1)).replace("{n}", String(opts.total))}
          </span>
        )}
        {!atEnd ? (
          <button type="button" data-testid="set-next" disabled={opts.disabled} onClick={() => opts.setView(opts.view + 1 >= opts.total - 1 ? null : opts.view + 1)} className={btn}>
            {dict.twoPages.sets.next}
          </button>
        ) : opts.canMore ? (
          <>
            <button type="button" data-testid="set-more" disabled={opts.disabled} onClick={opts.onMore} className={MORE_BUTTON}>
              <RefreshIcon />
              {opts.moreLabel}
            </button>
            <span className="text-sm text-ink/70">{opts.moreSub}</span>
          </>
        ) : (
          <span className="text-sm text-ink/70">{opts.noMore}</span>
        )}
      </>
    );
  };

  /** The start page's "voor wie": sets who the search is for; picks that are not offered to this audience go. */
  function chooseContext(ctx: SearchContext) {
    setAnswers((prev) => {
      const nextCtx = normalizeSearchContext(ctx);
      const interests = (prev.interests ?? []).filter((id) => {
        const a = poolById.get(id);
        return !a || allowedForContext(a, nextCtx);
      });
      return {
        ...prev,
        searchContext: ctx,
        interests,
        // For yourself there is no other name to keep.
        ...(nextCtx === "self" ? { recipientName: "" } : {}),
        // A group has no single age; for a child or young person the age is read from the context and the images.
        ...(nextCtx === "group" || nextCtx === "child" ? { ageCategory: "" } : {}),
      };
    });
  }

  const countries = useMemo(() => countryOptions(locale), [locale]);
  const country = answers.country || HOME_COUNTRY;
  function chooseCountry(code: string) {
    setAnswers((prev) => ((prev.country || HOME_COUNTRY) === code ? prev : { ...prev, country: code, location: "" }));
    setGeoFilled(null);
  }
  const showGeoNote = !!geoFilled && answers.location === geoFilled.location && (answers.country ?? "") === geoFilled.country;

  // The start page ("Eerst de basis"): who we search for, where, and the few limits. Only the place is required.
  const startPage = (() => {
    const sectionLabel = "text-xs font-bold uppercase tracking-[0.09em] text-gold-text";
    return (
      <div className="space-y-9">
        <div>
          <p className={sectionLabel}>{dict.start.kicker}</p>
          <h1 className="mt-2 font-serif text-[28px] leading-tight text-ink sm:text-4xl">{dict.start.heading}</h1>
          <p className="mt-2 text-ink/70">{dict.start.sub}</p>
          <p className="mt-3 rounded-lg bg-surface-active px-4 py-3 text-sm text-ink/80">{dict.start.optionalNote}</p>
        </div>

        <section aria-labelledby="start-who" className="space-y-3">
          <div>
            <p className={sectionLabel}>{dict.start.sections.who}</p>
            <h2 id="start-who" className="mt-1 font-semibold text-ink">
              {dict.start.who.label}
            </h2>
            <p className="mt-1 text-sm text-ink/70">{dict.start.who.sub}</p>
          </div>
          {/* Two big, recognisable choices: for yourself, or for somebody else. Choosing nothing means for yourself. */}
          <div role="group" aria-labelledby="start-who" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["self", "other"] as const).map((kind) => {
              const on = kind === "self" ? !forOther : forOther;
              const text = kind === "self" ? dict.start.who.options.self : dict.start.who.otherCard;
              return (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={on}
                  data-audience={kind}
                  data-context={kind === "self" ? "self" : undefined}
                  onClick={() => (kind === "self" ? chooseContext("self") : forOther ? undefined : chooseContext("adult"))}
                  className={cn(
                    "flex min-h-28 items-center gap-4 rounded-xl border-2 p-4 text-left transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60",
                    on ? (kind === "self" ? "border-accent-dark bg-accent-dark text-paper" : "border-gold bg-accent-dark text-paper") : "border-border bg-paper text-ink hover:border-walnut-light",
                  )}
                >
                  <ContextIcon context={kind === "self" ? "self" : "adult"} className={on ? "text-gold-light" : "text-accent-dark"} />
                  <span className="flex flex-col gap-1">
                    <span className="text-lg font-semibold leading-snug">{text.label}</span>
                    <span className={cn("text-sm leading-snug", on ? "text-paper/80" : "text-ink/70")}>{text.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {forOther && (
            <div className="rounded-xl border border-border bg-surface-active p-4">
              <p id="start-other" className="text-sm font-semibold text-ink">
                {dict.start.who.otherPrompt}
              </p>
              <div role="group" aria-labelledby="start-other" className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(["child", "adult", "group"] as const).map((c) => {
                  const on = searchContext === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      data-context={c}
                      onClick={() => chooseContext(c)}
                      className={cn(
                        "flex min-h-14 items-center gap-3 rounded-lg border-2 px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60",
                        on ? "border-accent-dark bg-accent-dark text-paper" : "border-border bg-paper text-ink hover:border-walnut-light",
                      )}
                    >
                      <ContextIcon context={c} size={32} className={on ? "text-gold-light" : "text-accent-dark"} />
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold leading-snug">{dict.start.who.options[c].label}</span>
                        <span className={cn("text-xs leading-snug", on ? "text-paper/80" : "text-ink/70")}>{dict.start.who.options[c].sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {searchContext !== "group" && (
                <div className="mt-4 max-w-sm">
                  <label htmlFor="recipient" className="block text-sm font-semibold text-ink">
                    {dict.start.who.nameLabel}
                  </label>
                  <input
                    id="recipient"
                    value={answers.recipientName ?? ""}
                    onChange={(e) => set("recipientName", e.target.value.slice(0, 40))}
                    placeholder={dict.recipientPlaceholder}
                    className="mt-2 min-h-11 w-full rounded-lg border border-border bg-paper px-4 py-3 text-ink outline-none placeholder:text-ink/70 focus:border-ink"
                  />
                </div>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="start-where" className="space-y-5">
          <div>
            <p className={sectionLabel}>{dict.start.sections.where}</p>
            <label id="start-where" htmlFor="location" className="mt-1 block font-semibold text-ink">
              {pick(dict.room.locationLabel, dict.room.locationLabelGift)}
              <span className="ml-1 text-red-700" aria-hidden="true">
                *
              </span>
              <span className="sr-only"> ({dict.start.required})</span>
            </label>
            <p className="mt-1 text-sm text-ink/70">{dict.room.locationSub}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:items-end">
              <div>
                <label htmlFor="country" className="block text-xs font-bold uppercase tracking-[0.09em] text-ink/70">
                  {dict.start.country.label}
                </label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => chooseCountry(e.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-border bg-paper px-3 py-3 text-ink outline-none focus:border-ink"
                >
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="[&_input]:mt-2">
                <LocationAutocomplete
                  tidy
                  id="location"
                  country={country}
                  locale={locale}
                  required
                  describedBy={showGeoNote ? "geo-note" : undefined}
                  value={answers.location}
                  onChange={(v) => {
                    set("location", v);
                    setGeoFilled(null);
                  }}
                  placeholder={dict.room.locationPlaceholder}
                />
              </div>
            </div>
            {showGeoNote && (
              <p id="geo-note" className="mt-2 text-sm text-ink/70" role="status">
                {dict.start.country.geoNote}
              </p>
            )}
          </div>
          <StepSlider
            id="distance-km"
            label={dict.start.distance.label}
            hint={dict.start.distance.hint}
            steps={DISTANCE_KM_STEPS.map((km) => ({
              tick: km > 100 ? dict.start.distance.tickOver100 : String(km),
              label: km > 100 ? dict.start.distance.over100 : dict.start.distance.upTo.replace("{km}", String(km)),
            }))}
            index={Math.max(0, distanceStepIndex(answers.searchDistanceKm ?? DEFAULT_DISTANCE_KM))}
            unsetText=""
            onChange={(i) => {
              const km = DISTANCE_KM_STEPS[i];
              setAnswers((prev) => (prev.searchDistanceKm === km ? prev : { ...prev, searchDistanceKm: km, searchDistance: distanceClassFor(km) }));
            }}
          />
        </section>

        <section aria-labelledby="start-limits" className="space-y-6">
          <div>
            <p className={sectionLabel}>
              {dict.start.sections.limits} · {dict.start.limits.optional}
            </p>
            <h2 id="start-limits" className="mt-1 font-semibold text-ink">
              {dict.start.limits.chipsLabel}
            </h2>
            <p className="mt-1 text-sm text-ink/70">{dict.start.limits.sub}</p>
          </div>
          <fieldset>
            <legend className="font-semibold text-ink">{forOther ? dict.start.limits.timeLabelOther : dict.room.timeLabel}</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {intakeDict.timeAvailable.options.map((o) => (
                <Chip key={o.value} selected={answers.timeAvailable === o.value} onClick={() => set("timeAvailable", answers.timeAvailable === o.value ? "" : o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </fieldset>
          <StepSlider
            id="budget-pp"
            label={dict.start.budget.label}
            hint={dict.start.budget.hint}
            steps={BUDGET_STEPS.map((b) => ({
              tick: b.euro === null ? "∞" : "€" + b.euro,
              label: b.euro === null ? dict.start.budget.any : dict.start.budget.upTo.replace("{n}", String(b.euro)),
            }))}
            index={budgetStepIndex(answers.budget) >= 0 ? budgetStepIndex(answers.budget) : null}
            unsetText={dict.start.budget.unset}
            onChange={(i) => setAnswers((prev) => (prev.budget === BUDGET_STEPS[i].value ? prev : { ...prev, budget: BUDGET_STEPS[i].value }))}
            onClear={() => set("budget", "")}
            clearLabel={dict.start.budget.clear}
          />
          <div role="group" aria-labelledby="start-chips" className="space-y-4">
            <div>
              <h3 id="start-chips" className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                {dict.start.limits.chipsTitle}
                <span className="rounded-full border border-border bg-surface-active px-2.5 py-0.5 text-xs font-medium text-ink/70">{dict.start.limits.optional}</span>
              </h3>
              <p className="mt-1 text-sm text-ink/70">{dict.start.limits.chipsSub}</p>
            </div>
            {dict.start.limits.groups.map((g) => (
              <fieldset key={g.title}>
                <legend className="text-xs font-bold uppercase tracking-[0.09em] text-ink/70">{g.title}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {g.chips.map((c) => (
                    <Chip key={c} selected={limitChips.includes(c)} onClick={() => setLimitChips((prev) => toggle(prev, c))}>
                      {c}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            ))}
            <p className="text-sm italic text-ink/65">{dict.start.limits.chipsSkip}</p>
          </div>
        </section>
      </div>
    );
  })();

  // Page 1 of the two-page intake: eighteen images, mixed from places, moments and senses.
  const imagesPage = (
    <div>
      <DiscoveryFlow active="diverge" copy={dict.twoPages.flow} className="mb-5" />
      <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold-text">{dict.twoPages.images.kicker}</p>
      <h1 className="mt-2 font-serif text-[28px] leading-tight text-ink sm:text-4xl">{pick(dict.twoPages.images.heading, dict.twoPages.images.headingGift)}</h1>
      <p className="mt-2 text-ink/70">{pick(dict.twoPages.images.sub, dict.twoPages.images.subGift)}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ChoiceProgress
          chosen={chosen.length}
          needed={MIN_IMAGES_REQUIRED}
          chosenText={dict.twoPages.images.chosen.replace("{n}", String(chosen.length))}
          missingText={dict.twoPages.images.min.replace("{n}", String(MIN_IMAGES_REQUIRED))}
          className="flex-1"
        />
        {imageViewIdx >= imageBatches.length - 1 && imageRefreshes < MAX_REFRESHES && (
          <button type="button" data-testid="set-more-top" onClick={moreImages} className={MORE_BUTTON}>
            <RefreshIcon />
            {dict.twoPages.images.more}
          </button>
        )}
      </div>
      {notice && (
        <p className="mt-3 rounded-md bg-surface-active px-3 py-2 text-sm text-ink/80" role="status">
          {notice}
        </p>
      )}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {currentImages.map((c) => {
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
              <Image src={c.image} alt="" fill sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8 text-xs font-semibold leading-tight text-white sm:px-3 sm:pb-3 sm:pt-10 sm:text-sm sm:leading-snug">
                {c.label}
              </span>
              <span className="absolute right-1.5 top-1.5 sm:right-2 sm:top-2">{on ? <Check /> : <span className="block h-6 w-6 rounded-full border-2 border-white/80 bg-black/10 sm:h-7 sm:w-7" />}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {setControls({
          total: imageBatches.length,
          view: imageViewIdx,
          setView: setImageView,
          canMore: imageRefreshes < MAX_REFRESHES,
          onMore: moreImages,
          moreLabel: dict.twoPages.images.more,
          moreSub: dict.twoPages.images.moreSub,
          noMore: dict.twoPages.images.noMore,
        })}
      </div>
    </div>
  );

  // Page 2: eighteen concrete activities that follow from page 1, three of them outside what the images pointed at.
  const concretePage = (
    <div>
      <DiscoveryFlow active="converge" copy={dict.twoPages.flow} className="mb-5" />
      <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold-text">{dict.twoPages.concrete.kicker}</p>
      <h1 className="mt-2 font-serif text-[28px] leading-tight text-ink sm:text-4xl">{pick(dict.twoPages.concrete.heading, dict.twoPages.concrete.headingGift)}</h1>
      <p className="mt-2 text-ink/70">{pick(dict.twoPages.concrete.sub, dict.twoPages.concrete.subGift)}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ChoiceProgress
          chosen={answers.surpriseMe ? 1 : picks.length}
          needed={1}
          chosenText={dict.twoPages.concrete.chosen.replace("{n}", String(picks.length))}
          missingText={dict.twoPages.concrete.min}
          className="flex-1"
        />
        {concreteViewIdx >= concreteBatches.length - 1 && concreteRefreshes < MAX_REFRESHES && (
          <button type="button" data-testid="set-more-top" onClick={moreConcrete} className={MORE_BUTTON}>
            <RefreshIcon />
            {dict.twoPages.concrete.more}
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-ink/70">{dict.twoPages.concrete.multi.replace("{max}", String(MAX_CONCRETE_PICKS))}</p>
      {notice && (
        <p className="mt-3 rounded-md bg-surface-active px-3 py-2 text-sm text-ink/80" role="status">
          {notice}
        </p>
      )}
      <div className={cn("mt-4 grid grid-cols-3 gap-2 sm:gap-3", answers.surpriseMe && "opacity-50")}>
        {currentConcrete.map(({ id, explore }) => {
          const a = poolById.get(id);
          if (!a) return null;
          const on = picks.includes(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => togglePick(id)}
              className={cn(
                "group relative aspect-[4/5] overflow-hidden rounded-lg text-left transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60",
                explore && !on && "outline outline-2 outline-dashed outline-offset-2 outline-gold",
                on && "ring-[3px] ring-gold ring-offset-2 ring-offset-cream",
              )}
            >
              <Image src={activityImage(id)} alt="" fill sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-8 text-xs font-semibold leading-tight text-white sm:px-3 sm:pb-3 sm:pt-10 sm:text-sm sm:leading-snug">
                {explore && <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-gold-light">{dict.twoPages.concrete.maybe}</span>}
                {a.label}
              </span>
              <span className="absolute right-1.5 top-1.5 sm:right-2 sm:top-2">{on ? <Check /> : <span className="block h-6 w-6 rounded-full border-2 border-white/80 bg-black/10 sm:h-7 sm:w-7" />}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {setControls({
          total: Math.max(1, concreteBatches.length),
          view: concreteViewIdx,
          setView: setConcreteView,
          canMore: concreteRefreshes < MAX_REFRESHES,
          onMore: moreConcrete,
          moreLabel: dict.twoPages.concrete.more,
          moreSub: dict.twoPages.concrete.moreSub,
          noMore: dict.twoPages.concrete.noMore,
          disabled: !!answers.surpriseMe,
        })}
        <button
          type="button"
          aria-pressed={!!answers.surpriseMe}
          onClick={chooseForMe}
          className={cn(
            "inline-flex min-h-11 flex-col items-start justify-center rounded-lg border-2 border-dashed px-4 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60",
            answers.surpriseMe ? "border-accent-dark bg-accent-dark text-gold-light" : "border-gold bg-paper text-accent-dark",
          )}
        >
          <span className="text-sm font-semibold">✦ {dict.twoPages.concrete.chooseForMe}</span>
          <span className="text-xs opacity-75">{pick(dict.twoPages.concrete.chooseForMeSub, dict.twoPages.concrete.chooseForMeSubGift)}</span>
        </button>
      </div>
      {!answers.surpriseMe && picks.length > 0 && picks.length < 3 && <p className="mt-3 text-sm text-ink/70">{dict.twoPages.concrete.moreSub}</p>}
    </div>
  );

  const body = (() => {
    switch (pageId) {
      case "start":
        return startPage;
      case "images":
        return imagesPage;
      case "concrete":
        return concretePage;
      case "worlds":
        return (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold-text">{dict.chapters.images}</p>
            <h1 className="mt-2 font-serif text-[28px] leading-tight text-ink sm:text-4xl">{pick(dict.worlds.heading, dict.worlds.headingGift)}</h1>
            <p className="mt-2 text-ink/70">{dict.worlds.sub}</p>
            {forOther && (
              <div className="mt-5 max-w-sm">
                <label htmlFor="recipient" className="block text-sm font-semibold text-ink">
                  {dict.recipientLabel}
                </label>
                <input
                  id="recipient"
                  value={answers.recipientName ?? ""}
                  onChange={(e) => set("recipientName", e.target.value.slice(0, 40))}
                  placeholder={dict.recipientPlaceholder}
                  className="mt-2 w-full rounded-lg border border-border bg-paper px-4 py-3 text-ink outline-none placeholder:text-ink/70 focus:border-ink"
                />
              </div>
            )}
            {/* Same grid and tile shape as the image rounds, so the photos are as large as on the other pages. */}
            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
              {shownDomains.map((d) => {
                const on = (answers.interestDomains ?? []).includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setHintWorld(d.id);
                      toggleWorld(d.id);
                    }}
                    className={cn(
                      "group relative aspect-[4/5] overflow-hidden rounded-lg text-left transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60",
                      on && "ring-[3px] ring-gold ring-offset-2 ring-offset-cream",
                      answers.surpriseMe && "opacity-50",
                    )}
                  >
                    <Image src={domainImage(d.id)} alt="" fill sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-2 pb-2 pt-8 text-xs font-semibold leading-tight text-white sm:px-3 sm:pb-3 sm:pt-10 sm:text-sm sm:leading-snug">
                      {d.label}
                    </span>
                    <span className="absolute right-1.5 top-1.5 sm:right-2 sm:top-2">{on ? <Check /> : <span className="block h-6 w-6 rounded-full border-2 border-white/80 bg-black/10 sm:h-7 sm:w-7" />}</span>
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={!!answers.surpriseMe}
                onClick={() => setAnswers((prev) => ({ ...prev, surpriseMe: !prev.surpriseMe, interestDomains: [] }))}
                className={cn(
                  "col-span-2 flex min-h-28 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 text-center transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60",
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
            {order.length > shownDomains.length && !answers.surpriseMe && (
              <button
                type="button"
                onClick={() => setRotated(rotateDirections(order, shownIds, answers.interestDomains ?? []))}
                className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border bg-paper px-4 text-sm font-semibold text-ink transition hover:border-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60"
              >
                {dict.worlds.more}
              </button>
            )}
            <p className="mt-3 text-sm text-ink/70" aria-live="polite">
              {answers.surpriseMe ? dict.worlds.surpriseSub : dict.worlds.chosen.replace("{n}", String((answers.interestDomains ?? []).length))}
            </p>
            {/* The examples that used to sit on every tile: one line for the direction touched last. */}
            {hintDomain && !answers.surpriseMe && (
              <p className="mt-1 text-sm text-ink/70" aria-live="polite">
                <span className="font-semibold text-ink/75">{hintDomain.label}:</span>{" "}
                {sampleWorldExamples(library.worldExamples?.[hintDomain.id] ?? [], seed || "initial", hintDomain.id).join(" · ")}
              </p>
            )}
          </div>
        );
      case "places":
      case "moments":
      case "senses":
        return roundPage(pageId);
      case "profile":
        return profile ? (
          <ProfileStep
            copy={dict.profile}
            story={profile}
            heading={pick(dict.profile.heading, dict.profile.headingGift)}
            windowView={
              <div className="flex flex-col items-center">
                <WindowFrame items={windowItems} size="hero" sill={sill || undefined} title={windowTitle} className="max-w-[320px]" />
                {exportHref && <WindowDownload href={exportHref} label={dict.nav.windowDownload} images={windowItems.length} />}
              </div>
            }
            readingRequest={readingRequest}
            fetchReading={interpretProfile}
            orderCue={dict.nav.scrollCue}
            missTitle={pick(dict.profile.missTitle, dict.profile.missTitleGift)}
            reflection={answers.personalReflection}
            onReflection={(text) => set("personalReflection", text)}
            notes={
              flow2 && dropped.length > 0 ? (
                <section className="mt-10 rounded-lg border border-gold/60 bg-paper p-5" aria-labelledby="dropped-title">
                  <h2 id="dropped-title" className="font-serif text-xl text-ink">
                    {dict.twoPages.dropped.title}
                  </h2>
                  <p className="mt-1 text-sm text-ink/65">{dict.twoPages.dropped.body}</p>
                  <ul className="mt-3 space-y-1 text-sm text-ink/80">
                    {dropped.map((d) => (
                      <li key={d.id}>
                        <span className="font-semibold">{poolById.get(d.id)?.label ?? d.id}</span>:{" "}
                        {dict.twoPages.dropped.reasons[d.reason as keyof typeof dict.twoPages.dropped.reasons] ?? ""}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={() => go(pages.indexOf(flow2 ? "start" : "situation"))} className="min-h-11 rounded-lg border border-border bg-cream px-4 text-sm font-semibold text-ink hover:border-ink">
                      {dict.twoPages.dropped.editSituation}
                    </button>
                    <button type="button" onClick={() => go(pages.indexOf("concrete"))} className="min-h-11 rounded-lg border border-border bg-cream px-4 text-sm font-semibold text-ink hover:border-ink">
                      {dict.twoPages.dropped.editChoices}
                    </button>
                  </div>
                </section>
              ) : null
            }
            payment={
              (
              <section id="bestellen" aria-labelledby="order-title" className="scroll-mt-24 overflow-hidden rounded-lg border border-border bg-paper">
                <TestModeBanner notice={payment.testNotice} />
                <div className="flex flex-col gap-6 p-5 sm:p-6">
                  <div>
                    <h2 id="order-title" className="font-serif text-xl leading-tight text-ink sm:text-2xl">
                      {pick(dict.checkout.heading, dict.checkout.headingGift)}
                    </h2>
                    <div className="mt-4 flex items-baseline gap-2 rounded-lg bg-surface-active px-4 py-3">
                      <span className="font-serif text-3xl font-semibold text-ink">{payment.price}</span>
                      <span className="text-xs text-ink/70">{payment.dict.priceCaption}</span>
                    </div>
                    <ul className="mt-4 flex flex-col gap-2.5">
                      {dict.checkout.whatYouGet.map((line) => (
                        <li key={line} className="flex items-start gap-3 text-sm leading-relaxed text-ink/75">
                          <span aria-hidden="true" className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold-light text-accent-dark">
                            <svg width="9" height="9" viewBox="0 0 12 10" fill="none">
                              <path d="M1 5l3.5 4L11 1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                          {line}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-5 text-xs leading-relaxed text-ink/70">{dict.checkout.freeNote}</p>
                  </div>
                  <div>
                    {payment.paymentFailed && (
                      <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                        {payment.dict.errorPaymentFailed}
                      </p>
                    )}
                    <CheckoutPanel dict={payment.dict} price={payment.price} rememberInitially={payment.rememberInitially} beforePay={saveForPayment} priceVariant={payment.priceVariant} />
                  </div>
                </div>
              </section>
              )
            }
          />
        ) : null;
      case "situation": {
        return (
          <div className="space-y-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold-text">{dict.chapters.situation}</p>
              <h1 className="mt-2 font-serif text-[28px] leading-tight text-ink sm:text-4xl">{pick(dict.situation.heading, dict.situation.headingGift)}</h1>
            </div>
            <div>
              <label htmlFor="location" className="block font-semibold text-ink">
                {pick(dict.room.locationLabel, dict.room.locationLabelGift)}
              </label>
              <p className="mt-1 text-sm text-ink/70">{dict.room.locationSub}</p>
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
            <fieldset>
              <legend className="font-semibold text-ink">{dict.start.limits.chipsLabel}</legend>
              <p className="mt-1 text-sm text-ink/70">{dict.start.limits.chipsSub}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {dict.who.limitChips.map((c) => (
                  <Chip key={c} selected={limitChips.includes(c)} onClick={() => setLimitChips((prev) => toggle(prev, c))}>
                    {c}
                  </Chip>
                ))}
              </div>
            </fieldset>
          </div>
        );
      }
    }
  })();

  if (!hydrated) return <div className="min-h-[70vh] w-full" aria-hidden="true" />;

  const isProfile = pageId === "profile";
  // On a phone, while swiping through a round, the bottom bar holds the yes/no buttons.
  const swiping = mode === "swipe" && !!round && swipeIdx < roundCards.length;
  const isLast = page === pages.length - 1;
  const optionalRound = pageId === "senses" && chosenInRound === 0;
  const primaryLabel = optionalRound ? dict.roundUi.skip : dict.nav.next;
  // The Back button says where it goes (two-page intake), so going back to change an earlier choice is never a guess.
  const backLabel = flow2 ? (pageId === "profile" ? dict.twoPages.backTo.concrete : pageId === "concrete" ? dict.twoPages.backTo.images : pageId === "images" ? dict.twoPages.backTo.start : dict.nav.back) : dict.nav.back;

  return (
    <div className="w-full pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-0">
      {/* Progress: three chapters plus the optional last question, and the window icon on a phone. */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-1.5" aria-hidden="true">
          {chapterNames.map((n, i) => (
            <span key={n} className={cn("h-1.5 flex-1 rounded-full", i < chapter ? "bg-gold" : i === chapter ? "bg-accent-dark" : "bg-border")} />
          ))}
        </div>
        <span className="whitespace-nowrap text-xs font-semibold text-ink/70">
          {chapter + 1} · {chapterNames[chapter]}
        </span>
        {flow2 && pageId !== "start" && (
          <span
            data-testid="audience-pill"
            data-audience={forOther ? "other" : "self"}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold",
              forOther ? "border-gold bg-gold/15 text-ink" : "border-accent-dark/30 bg-paper text-accent-dark",
            )}
          >
            <ContextIcon context={forOther ? (group ? "group" : searchContext === "child" ? "child" : "adult") : "self"} size={18} />
            {group ? dict.start.who.pill.group : forOther ? (name ? dict.start.who.pill.named.replace("{name}", name) : dict.start.who.pill.other) : dict.start.who.pill.self}
          </span>
        )}
        <button
          type="button"
          onClick={() => setWindowOpen(true)}
          // The picture stays 40px wide; the button around it is 44px so it is a proper touch target.
          className="flex w-11 shrink-0 items-center justify-center lg:hidden"
          aria-label={dict.nav.windowOpen}
        >
          <span className="block w-10">
            <WindowFrame items={windowItems} size="icon" title={windowTitle} />
          </span>
        </button>
      </div>

      {/* Inside the long first chapter: where we are among direction, place, moment and sense. (The two-page intake has the
          "first wide, then sharp" indicator on its pages instead.) */}
      {!flow2 && chapter === 0 && (
        <ol className="-mt-3 mb-6 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.08em]" aria-label={dict.chapters.images}>
          {[dict.panes.worlds, dict.panes.places, dict.panes.moments, dict.panes.senses].map((label, i) => {
            const here = page;
            return (
              <li key={label} aria-current={i === here ? "step" : undefined} className={cn("flex items-center gap-1.5", i === here ? "text-ink" : "text-ink/70")}>
                <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", i === here ? "bg-accent-dark" : i < here ? "bg-gold" : "bg-border")} />
                {label}
              </li>
            );
          })}
        </ol>
      )}

      {initial && (
        <p className="mb-5 rounded-lg border border-border bg-surface-active px-4 py-3 text-sm text-ink/70" role="status">
          {intakeDict.editBanner}
        </p>
      )}

      <div className={cn("grid gap-10", !isProfile && "lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]")}>
        <div key={pageId} className="animate-window-page-fade min-w-0">
          {body}
          {error && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {(
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
              <p
                id="continue-hint"
                aria-live="polite"
                className={cn("mx-auto mb-2 max-w-6xl text-center text-xs text-ink/70 lg:text-left", !continueHint && "hidden", swiping && "hidden sm:block")}
              >
                {continueHint}
              </p>
              <div className={cn("mx-auto flex max-w-6xl items-center gap-3", swiping && "hidden sm:flex")}>
                {page > 0 && (
                  <Button variant="secondary" onClick={back} aria-label={backLabel} className="px-4">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className={isLast ? "inline" : "hidden sm:inline"}>{backLabel}</span>
                  </Button>
                )}
                {/* The last screen pays itself (the order block above): "Terug" stays in the bar, plus a button that jumps to the order. */}
                {isLast && isProfile && !orderInView && (
                  <Button href="#bestellen" data-testid="to-order" className="flex-1 lg:flex-none lg:min-w-56">
                    {dict.nav.toOrder}
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Button>
                )}
                {!isLast && (
                  <Button
                    variant="hero"
                    onClick={next}
                    disabled={!canContinue}
                    aria-describedby={continueHint ? "continue-hint" : undefined}
                    className="min-h-14 flex-1 text-base font-semibold lg:min-w-64 lg:flex-none"
                  >
                    {primaryLabel}
                    <span aria-hidden="true" className="cta-arrow inline-block">
                      →
                    </span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {!isProfile && (
          <aside className="hidden lg:block">
            <div className="sticky top-8 rounded-2xl border border-border bg-paper p-6">
              <p className="font-serif text-xl text-ink">{windowTitle}</p>
              <div className="mx-auto mt-4 w-full max-w-[280px]">
                <WindowFrame items={windowItems} size="panel" sill={sill || undefined} title={windowTitle} activeKind={activeKind} />
              </div>
              {!sill && <p className="mt-4 text-sm text-ink/70">{dict.sill.empty}</p>}
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
              <WindowFrame items={windowItems} size="panel" sill={sill || undefined} title={windowTitle} activeKind={activeKind} />
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
