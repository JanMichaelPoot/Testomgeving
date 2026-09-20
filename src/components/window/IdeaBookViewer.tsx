"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ShareButton } from "@/components/window/ShareButton";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/posthog/client";
import { DOOR_ORDER, orderIdeasByDoor, pickOneThingIndex } from "@/lib/possibilityMap";
import type { IdeaBookEntry, IdeaDoor } from "@/lib/claude/ideaBookTypes";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Screen = { type: "map" } | { type: "done" };

// A regular idea's door is always one of the 4 non-wildcard doors (Fase 3's
// normalizeEntry only ever assigns "wildcard" to the dedicated wildcard
// slot) — but the type itself still allows "wildcard", so this stays a
// small defensive lookup rather than a direct index.
function doorCopy(
  door: IdeaDoor,
  doors: Dictionary["plan"]["book"]["doors"]
): { label: string; description: string } | null {
  return door === "wildcard" ? null : doors[door];
}

// Renders the paid Idea Book result. On explicit request, this is
// deliberately just two screens now: the Possibility Map (overview of all
// 6 ideas + the wildcard, each opening the real generated PDF at its own
// page) and a closing download/share screen — no separate profile,
// preferences, discovery, or per-idea web screens in between. Those
// existed here before (see git history / CLAUDE.md's Stap-log for the
// "Idea Book as a book" and "New Result Experience" phases that built
// them) but produced exactly the "card → own page → own page → ... →
// eventually a PDF" flow the product brief explicitly asked to collapse:
// the PDF *is* the product, so getting to it should take one click from
// the overview, not a walk through N screens first.
export function IdeaBookViewer({
  ideas,
  wildcard,
  labels,
  pdfChromeDict,
  planDict,
  pdfUrl,
  shareUrl,
  showEmailedCopy,
  planId,
}: {
  ideas: IdeaBookEntry[];
  wildcard: IdeaBookEntry | null;
  labels: Record<string, string>;
  pdfChromeDict: Dictionary["pdfChrome"];
  planDict: Dictionary["plan"];
  pdfUrl: string | null;
  shareUrl: string;
  showEmailedCopy: boolean;
  planId: string;
}) {
  // The web Possibility Map and the printed/emailed PDF always walk ideas
  // in the same fixed DOOR_ORDER (natural → discovery → unexpected →
  // stretch), so an idea's position here matches its PDF page exactly.
  // Page 1 is the cover, 2 is the profile, 3 is the Possibility Map, so
  // the first idea always lands on page 4 — see CLAUDE.md's Stap 33/34
  // log for why that layout is fixed.
  const orderedIdeas = useMemo(() => orderIdeasByDoor(ideas), [ideas]);
  const oneThingIndex = useMemo(() => pickOneThingIndex(ideas), [ideas]);
  const pdfPageByOriginalIndex = useMemo(() => {
    const map = new Map<number, number>();
    orderedIdeas.forEach(({ originalIndex }, i) => map.set(originalIndex, 4 + i));
    return map;
  }, [orderedIdeas]);
  const wildcardPdfPage = 4 + ideas.length;

  function pdfHrefForPage(page: number): string | null {
    return pdfUrl ? `${pdfUrl}#page=${page}` : null;
  }

  const screens = useMemo<Screen[]>(() => {
    const list: Screen[] = [];
    if (orderedIdeas.length > 0 || wildcard) list.push({ type: "map" });
    list.push({ type: "done" });
    return list;
  }, [orderedIdeas, wildcard]);

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
          reached. Only ever 1 or 2 segments now, but kept as the same
          component so it stays visually consistent if a screen is ever
          added back. */}
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
        {screen.type === "map" && (
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
              {planDict.book.mapEyebrow}
            </p>
            <h2 className="mt-2 font-serif text-2xl text-ink sm:text-3xl">
              {planDict.book.mapHeading}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink/70">{planDict.book.mapIntro}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {DOOR_ORDER.map((door) => (
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
                const href = pdfHrefForPage(pdfPageByOriginalIndex.get(originalIndex) ?? 4 + i);
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
                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-full border border-accent/30 px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-accent/5"
                      >
                        {planDict.book.mapViewLabel}
                      </a>
                    )}
                  </li>
                );
              })}
              {wildcard && (
                <li className="flex items-center justify-between gap-4 rounded-2xl border border-gold/40 bg-gold/5 p-4">
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-medium uppercase tracking-widest text-gold">
                      ✦ {labels.wildcard_heading || pdfChromeDict.wildcardFallbackHeading}
                    </p>
                    <p className="truncate font-serif text-lg text-ink">{wildcard.title}</p>
                  </div>
                  {pdfHrefForPage(wildcardPdfPage) && (
                    <a
                      href={pdfHrefForPage(wildcardPdfPage)!}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-full border border-gold/50 px-4 py-2 text-sm font-medium text-accent-dark transition-colors hover:bg-gold/10"
                    >
                      {planDict.book.mapViewLabel}
                    </a>
                  )}
                </li>
              )}
            </ul>
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

              {/* Repeat-use nudge: mirrors the CTA already used on the
                  public /shared/[id] page, pointed at a fresh intake
                  instead of assuming anything about avoiding
                  previously-seen ideas. */}
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

      {/* "done" has nothing left to skip to, so the generic nav row is
          redundant there. */}
      {screen.type !== "done" && (
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
          {!isLast && <Button onClick={goNext}>{planDict.book.next}</Button>}
        </div>
      )}
    </div>
  );
}
