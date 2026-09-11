"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ShareButton } from "@/components/window/ShareButton";
import { IdeaDetail } from "@/components/window/IdeaDetail";
import { WindowMark } from "@/components/window/WindowMark";
import { cn } from "@/lib/utils";
import type { IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import type { Locale } from "@/lib/language";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Screen =
  | { type: "profile" }
  | { type: "preferences" }
  | { type: "idea"; idea: IdeaBookEntry; index: number }
  | { type: "wildcard" }
  | { type: "done" };

// Renders the paid Idea Book as a single "book" experience — one screen at
// a time (profile, preferences, one per idea, a separately framed wildcard,
// then save/share) — instead of one long scrolling list, per the "Idea
// Book-layout als boek" item in the WINDOW Ervaringsontwerp roadmap.
export function IdeaBookViewer({
  title,
  profileSummary,
  mustHaves,
  preferences,
  ideas,
  wildcard,
  locale,
  labels,
  pdfChromeDict,
  planDict,
  pdfUrl,
  shareUrl,
  showEmailedCopy,
}: {
  title: string;
  profileSummary: string;
  mustHaves: string[];
  preferences: string[];
  ideas: IdeaBookEntry[];
  wildcard: IdeaBookEntry | null;
  locale: Locale;
  labels: Record<string, string>;
  pdfChromeDict: Dictionary["pdfChrome"];
  planDict: Dictionary["plan"];
  pdfUrl: string | null;
  shareUrl: string;
  showEmailedCopy: boolean;
}) {
  const hasPreferences = mustHaves.length > 0 || preferences.length > 0;
  const totalActions = ideas.reduce((sum, idea) => sum + idea.details.length, 0)
    + (wildcard?.details.length ?? 0);

  const screens = useMemo<Screen[]>(() => {
    const list: Screen[] = [{ type: "profile" }];
    if (hasPreferences) list.push({ type: "preferences" });
    ideas.forEach((idea, index) => list.push({ type: "idea", idea, index }));
    if (wildcard) list.push({ type: "wildcard" });
    list.push({ type: "done" });
    return list;
  }, [hasPreferences, ideas, wildcard]);

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
              <WindowMark className="h-7 w-7" />
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

        {screen.type === "idea" && (
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-ink/40">
              {planDict.book.ideaLabel} {screen.index + 1} {planDict.book.ofWord} {ideas.length}
            </p>
            <IdeaDetail
              idea={screen.idea}
              index={null}
              photoIndex={screen.index}
              locale={locale}
              labels={labels}
              dict={pdfChromeDict}
            />
          </div>
        )}

        {screen.type === "wildcard" && wildcard && (
          <div>
            <p className="mb-3 text-sm italic text-ink/60">{planDict.book.wildcardIntro}</p>
            <IdeaDetail
              idea={wildcard}
              index={null}
              photoIndex={ideas.length}
              locale={locale}
              labels={labels}
              dict={pdfChromeDict}
              isWildcard
            />
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
              {screen.type === "profile" && !hasPreferences
                ? planDict.book.viewIdeas
                : screen.type === "preferences"
                  ? planDict.book.viewIdeas
                  : planDict.book.next}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
