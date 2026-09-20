"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ShareButton } from "@/components/window/ShareButton";
import { IdeaDetail } from "@/components/window/IdeaDetail";
import { IdeaFeedback } from "@/components/window/IdeaFeedback";
import { WindowMark } from "@/components/window/WindowMark";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/posthog/client";
import { describeDiscoveryProfile } from "@/lib/discoveryProfile";
import {
  CHALLENGE_DOOR_ORDER,
  DOOR_ORDER,
  orderIdeasByDoor,
  pickOneThingIndex,
} from "@/lib/possibilityMap";
import type { IdeaFeedbackValue } from "@/app/plan/actions";
import type { IdeaBookEntry, IdeaDoor } from "@/lib/claude/ideaBookTypes";
import type { CharacterProfile } from "@/lib/characterProfile";
import type { Locale } from "@/lib/language";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Screen =
  | { type: "profile" }
  | { type: "preferences" }
  | { type: "discovery" }
  | { type: "map" }
  | { type: "idea"; idea: IdeaBookEntry; index: number; originalIndex: number }
  | { type: "wildcard" }
  | { type: "done" };

// A regular idea's door is always one of the 4 non-wildcard doors (Fase 3's
// normalizeEntry only ever assigns "wildcard" to the dedicated wildcard
// slot) — but the type itself still allows "wildcard", so this stays a
// small defensive lookup rather than a direct index, and doubles as the one
// place that decides "no legend copy for this door" (there isn't one for
// "wildcard" — that screen already has its own framing).
function doorCopy(
  door: IdeaDoor,
  doors: Dictionary["plan"]["book"]["doors"]
): { label: string; description: string } | null {
  return door === "wildcard" ? null : doors[door];
}

// Renders the paid Idea Book as a single "book" experience — one screen at
// a time — instead of one long scrolling list, per the "Idea Book-layout
// als boek" item in the WINDOW Ervaringsontwerp roadmap.
//
// Fase 4 (New Result Experience) added four screens to that book: a
// Discovery Profile (a soft reflection of the character profile from Fase
// 2), a Possibility Map (the Open Doors legend plus a jump-to-any-idea
// overview, with the "One Thing" pick highlighted), and — on every idea
// screen — a door badge and a "What if…" eyebrow. The ideas themselves are
// walked in door order (natural → discovery → unexpected → stretch) rather
// than Claude's original array order, so paging forward reads as a
// deliberate journey further from the comfort zone, ending at the
// wildcard.
//
// Fase 6 (Interaction & Retention) added three more pieces, all web-only —
// the PDF keeps rendering the door-order/One-Thing pick exactly as before:
// a thumbs-style reaction under every idea (see IdeaFeedback.tsx), a
// Challenge Mode toggle on the Possibility Map screen that walks the same
// doors back-to-front and reweights the One Thing pick toward challenge/
// novelty (see possibilityMap.ts), and a repeat-use nudge on the closing
// "done" screen.
export function IdeaBookViewer({
  title,
  profileSummary,
  mustHaves,
  preferences,
  ideas,
  wildcard,
  characterProfile,
  locale,
  labels,
  pdfChromeDict,
  planDict,
  pdfUrl,
  shareUrl,
  showEmailedCopy,
  planId,
  feedback,
}: {
  title: string;
  profileSummary: string;
  mustHaves: string[];
  preferences: string[];
  ideas: IdeaBookEntry[];
  wildcard: IdeaBookEntry | null;
  characterProfile: CharacterProfile | null;
  locale: Locale;
  labels: Record<string, string>;
  pdfChromeDict: Dictionary["pdfChrome"];
  planDict: Dictionary["plan"];
  pdfUrl: string | null;
  shareUrl: string;
  showEmailedCopy: boolean;
  planId: string;
  feedback: Record<string, IdeaFeedbackValue>;
}) {
  const hasPreferences = mustHaves.length > 0 || preferences.length > 0;
  const totalActions = ideas.reduce((sum, idea) => sum + idea.details.length, 0)
    + (wildcard?.details.length ?? 0);

  const [challengeMode, setChallengeMode] = useState(false);
  const activeDoorOrder = challengeMode ? CHALLENGE_DOOR_ORDER : DOOR_ORDER;

  const orderedIdeas = useMemo(
    () => orderIdeasByDoor(ideas, activeDoorOrder),
    [ideas, activeDoorOrder]
  );
  const oneThingIndex = useMemo(
    () => pickOneThingIndex(ideas, { challengeMode }),
    [ideas, challengeMode]
  );
  const discoveryLines = useMemo(
    () => (characterProfile ? describeDiscoveryProfile(characterProfile, locale) : []),
    [characterProfile, locale]
  );

  // Fase 9/10 ("Bekijk dit idee" → real PDF) — the printed/emailed PDF's
  // page order is always the fixed DOOR_ORDER (src/lib/pdf/ideaBook.ts
  // never receives the web-only Challenge Mode toggle), so this has to be
  // computed separately from `orderedIdeas` above, which follows
  // `activeDoorOrder` and can be reversed. Page 1 is the cover, 2 is the
  // profile, 3 is the Possibility Map, so the first idea always lands on
  // page 4 — see CLAUDE.md's Stap 33/34 log for why that layout is fixed.
  const fixedOrderedIdeas = useMemo(() => orderIdeasByDoor(ideas), [ideas]);
  const pdfPageByOriginalIndex = useMemo(() => {
    const map = new Map<number, number>();
    fixedOrderedIdeas.forEach(({ originalIndex }, i) => map.set(originalIndex, 4 + i));
    return map;
  }, [fixedOrderedIdeas]);
  const wildcardPdfPage = 4 + ideas.length;

  function pdfHrefForPage(page: number): string | null {
    return pdfUrl ? `${pdfUrl}#page=${page}` : null;
  }

  const screens = useMemo<Screen[]>(() => {
    const list: Screen[] = [{ type: "profile" }];
    if (hasPreferences) list.push({ type: "preferences" });
    if (characterProfile) list.push({ type: "discovery" });
    if (orderedIdeas.length > 0) list.push({ type: "map" });
    orderedIdeas.forEach(({ idea, originalIndex }, index) =>
      list.push({ type: "idea", idea, index, originalIndex })
    );
    if (wildcard) list.push({ type: "wildcard" });
    list.push({ type: "done" });
    return list;
  }, [hasPreferences, characterProfile, orderedIdeas, wildcard]);

  // The Possibility Map's cards jump straight into the idea screens, which
  // sit contiguously right after "map" in the same order as orderedIdeas —
  // built together above, so this stays correct without re-searching by
  // value on every render.
  const firstIdeaScreenIndex = screens.findIndex((s) => s.type === "map") + 1;

  const [screenIndex, setScreenIndex] = useState(0);
  const screen = screens[screenIndex];
  const isFirst = screenIndex === 0;
  const isLast = screenIndex === screens.length - 1;

  function goBack() {
    setScreenIndex((prev) => Math.max(0, prev - 1));
  }
  function goNext() {
    setScreenIndex((prev) => Math.min(screens.length - 1, prev + 1));
  }
  function goTo(i: number) {
    setScreenIndex(Math.max(0, Math.min(screens.length - 1, i)));
  }

  return (
    <div>
      {/* Clickable progress strip — jump straight to any screen already
          reached, matching the WINDOW prototype's book navigation. */}
      <div className="flex items-center gap-1">
        {screens.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i + 1}`}
            onClick={() => i <= screenIndex && goTo(i)}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i === screenIndex
                ? "bg-accent"
                : i < screenIndex
                  ? "cursor-pointer bg-accent/50 hover:bg-accent/70"
                  : "cursor-default bg-ink/10"
            )}
          />
        ))}
      </div>

      <div className="mt-8">
        {screen.type === "profile" && (
          <div>
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/40 bg-accent-dark text-white">
              <WindowMark onDark className="h-7 w-7" />
            </div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
              {planDict.book.profileEyebrow}
            </p>
            <h1 className="mt-2 font-serif text-3xl text-ink sm:text-4xl">{title}</h1>
            <p className="mt-4 text-lg text-ink/70">{profileSummary}</p>

            <div className="mt-8 grid grid-cols-3 gap-4 border-y border-accent/10 py-6 text-center">
              <div>
                <p className="font-serif text-3xl font-semibold text-accent">{ideas.length}</p>
                <p className="mt-1 text-xs text-ink/60">{planDict.book.statsIdeasLabel}</p>
              </div>
              <div>
                <p className="font-serif text-3xl font-semibold text-accent">{totalActions}</p>
                <p className="mt-1 text-xs text-ink/60">{planDict.book.statsActionsLabel}</p>
              </div>
              <div>
                <p className="font-serif text-3xl font-semibold text-accent">
                  {wildcard ? planDict.book.statsWildcardValue : 0}
                </p>
                <p className="mt-1 text-xs text-ink/60">{planDict.book.statsWildcardLabel}</p>
              </div>
            </div>
          </div>
        )}

        {screen.type === "preferences" && (
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
              {planDict.book.preferencesEyebrow}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-10 gap-y-6">
              {mustHaves.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-ink/50">
                    {planDict.mustHaves}
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink/80">
                    {mustHaves.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {preferences.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-ink/50">
                    {planDict.preferences}
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink/80">
                    {preferences.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {screen.type === "discovery" && (
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
              {planDict.book.discoveryEyebrow}
            </p>
            <h2 className="mt-2 font-serif text-2xl text-ink sm:text-3xl">
              {planDict.book.discoveryHeading}
            </h2>
            {discoveryLines.length > 0 ? (
              <ul className="mt-6 space-y-4">
                {discoveryLines.map((line, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span className="text-base leading-relaxed text-ink/80">{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 text-base leading-relaxed text-ink/70">
                {planDict.book.discoveryFallback}
              </p>
            )}
          </div>
        )}

        {screen.type === "map" && (
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
              {planDict.book.mapEyebrow}
            </p>
            <h2 className="mt-2 font-serif text-2xl text-ink sm:text-3xl">
              {planDict.book.mapHeading}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink/70">{planDict.book.mapIntro}</p>

            {/* Fase 6 — Challenge Mode: reverses the walk below (and the
                legend order right under it) from stretch back to natural,
                and reweights the One Thing pick the same way. */}
            <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-cream p-4">
              <div>
                <p className="text-sm font-medium text-ink">{planDict.book.challengeModeLabel}</p>
                <p className="mt-0.5 text-xs text-ink/60">{planDict.book.challengeModeHelper}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={challengeMode}
                onClick={() => {
                  const next = !challengeMode;
                  setChallengeMode(next);
                  trackEvent("challenge_mode_toggled", { planId, enabled: next });
                }}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
                  challengeMode ? "bg-accent" : "bg-ink/15"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
                    challengeMode ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {activeDoorOrder.map((door) => (
                <div key={door} className="rounded-xl bg-cream p-4">
                  <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
                    {planDict.book.doors[door].label}
                  </p>
                  <p className="mt-1 text-sm text-ink/70">{planDict.book.doors[door].description}</p>
                </div>
              ))}
            </div>

            <ul className="mt-8 space-y-3">
              {orderedIdeas.map(({ idea, originalIndex }, i) => {
                const isOneThing = originalIndex === oneThingIndex;
                const copy = doorCopy(idea.door, planDict.book.doors);
                return (
                  <li
                    key={i}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-2xl border p-4",
                      isOneThing ? "border-gold bg-gold/5" : "border-accent/10"
                    )}
                  >
                    <div className="min-w-0">
                      {isOneThing && (
                        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-gold">
                          ✦ {planDict.book.oneThingBadge}
                        </p>
                      )}
                      {copy && (
                        <p className="text-xs font-medium uppercase tracking-widest text-ink/40">
                          {copy.label}
                        </p>
                      )}
                      <p className="truncate font-serif text-lg text-ink">{idea.title}</p>
                      {isOneThing && (
                        <p className="mt-1 text-sm text-ink/60">{planDict.book.oneThingCaption}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => goTo(firstIdeaScreenIndex + i)}
                      className="shrink-0 rounded-full border border-accent/30 px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent/5"
                    >
                      {planDict.book.mapViewLabel}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {screen.type === "idea" && (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-widest text-ink/40">
                {planDict.book.ideaLabel} {screen.index + 1} {planDict.book.ofWord} {orderedIdeas.length}
              </p>
              {doorCopy(screen.idea.door, planDict.book.doors) && (
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent-dark">
                  {doorCopy(screen.idea.door, planDict.book.doors)!.label}
                </span>
              )}
            </div>
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-gold">
              {planDict.book.whatIfLabel}
            </p>
            {pdfHrefForPage(pdfPageByOriginalIndex.get(screen.originalIndex) ?? 4) && (
              <a
                href={pdfHrefForPage(pdfPageByOriginalIndex.get(screen.originalIndex) ?? 4)!}
                target="_blank"
                rel="noreferrer"
                className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-dark underline underline-offset-2 hover:text-accent"
              >
                {planDict.book.viewAsPdfLabel} →
              </a>
            )}
            <IdeaDetail
              idea={screen.idea}
              index={null}
              photoIndex={screen.index}
              locale={locale}
              labels={labels}
              dict={pdfChromeDict}
            />
            <div className="mt-4">
              <IdeaFeedback
                planId={planId}
                ideaKey={`idea-${screen.originalIndex}`}
                initialValue={feedback[`idea-${screen.originalIndex}`] ?? null}
                prompt={planDict.book.feedbackPrompt}
                upLabel={planDict.book.feedbackUpLabel}
                downLabel={planDict.book.feedbackDownLabel}
                thanksLabel={planDict.book.feedbackThanks}
              />
            </div>
          </div>
        )}

        {screen.type === "wildcard" && wildcard && (
          <div>
            <p className="mb-3 text-sm italic text-ink/60">{planDict.book.wildcardIntro}</p>
            {pdfHrefForPage(wildcardPdfPage) && (
              <a
                href={pdfHrefForPage(wildcardPdfPage)!}
                target="_blank"
                rel="noreferrer"
                className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-dark underline underline-offset-2 hover:text-accent"
              >
                {planDict.book.viewAsPdfLabel} →
              </a>
            )}
            <IdeaDetail
              idea={wildcard}
              index={null}
              photoIndex={orderedIdeas.length}
              locale={locale}
              labels={labels}
              dict={pdfChromeDict}
              isWildcard
            />
            <div className="mt-4">
              <IdeaFeedback
                planId={planId}
                ideaKey="wildcard"
                initialValue={feedback["wildcard"] ?? null}
                prompt={planDict.book.feedbackPrompt}
                upLabel={planDict.book.feedbackUpLabel}
                downLabel={planDict.book.feedbackDownLabel}
                thanksLabel={planDict.book.feedbackThanks}
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button onClick={goNext}>{planDict.book.wildcardYes}</Button>
              <button
                type="button"
                onClick={goNext}
                className="text-sm font-medium text-ink/50 hover:text-ink/70"
              >
                {planDict.book.wildcardNo}
              </button>
            </div>
          </div>
        )}

        {screen.type === "done" && (
          <div className="relative overflow-hidden rounded-3xl bg-accent-dark p-10 text-center">
            <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 -translate-y-24 translate-x-24 rounded-full bg-accent/40" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-32 -translate-x-16 translate-y-16 rounded-full bg-gold/15" />
            <div className="relative">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-gold">
                <svg width="26" height="26" viewBox="0 0 28 28" fill="currentColor" aria-hidden="true">
                  <path d="M14 2l3.09 6.26L24 9.27l-5 4.87 1.18 6.88L14 17.77l-6.18 3.25L9 14.14 4 9.27l6.91-1.01L14 2z" />
                </svg>
              </div>
              <h1 className="font-serif text-2xl font-semibold text-white sm:text-3xl">
                {planDict.book.doneHeading}
              </h1>
              <p className="mx-auto mt-2 max-w-xs text-sm text-white/60">{planDict.book.doneSub}</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-accent-dark shadow-sm transition-colors hover:bg-white/90"
                  >
                    {planDict.downloadPdf}
                  </a>
                )}
                <ShareButton
                  url={shareUrl}
                  label={planDict.shareButtonLabel}
                  copiedLabel={planDict.shareCopiedLabel}
                />
              </div>
              {showEmailedCopy && <p className="mt-4 text-sm text-white/50">{planDict.emailedCopy}</p>}

              {/* Fase 6 — repeat-use nudge: mirrors the CTA already used on
                  the public /shared/[id] page (see SharedPageTracking.tsx),
                  pointed at a fresh intake instead of assuming anything
                  about avoiding previously-seen ideas. */}
              <Link
                href="/intake?utm_source=idea_book_done&utm_medium=return_cta"
                onClick={() => trackEvent("idea_book_done_return_clicked", { planId })}
                className="mt-6 inline-block text-sm font-medium text-white/50 underline underline-offset-2 hover:text-white/70"
              >
                {planDict.book.doneReturnCta}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* The wildcard screen has its own forward actions, so the generic
          nav row is redundant there — and "done" has nothing left to skip
          to. */}
      {screen.type !== "wildcard" && screen.type !== "done" && (
        <div className="mt-10 flex items-center justify-between">
          {!isFirst ? (
            <button
              type="button"
              onClick={goBack}
              className="text-sm font-medium text-ink/60 hover:text-ink"
            >
              {planDict.book.back}
            </button>
          ) : (
            <span />
          )}
          {!isLast && (
            <Button onClick={goNext}>
              {screen.type === "map" ? planDict.book.viewIdeas : planDict.book.next}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
