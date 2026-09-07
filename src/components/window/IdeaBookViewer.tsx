"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ShareButton } from "@/components/window/ShareButton";
import { IdeaDetail } from "@/components/window/IdeaDetail";
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

  return (
    <div>
      <div className="flex items-center gap-1.5">
        {screens.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= screenIndex ? "bg-accent" : "bg-ink/10"
            )}
          />
        ))}
      </div>

      <div className="mt-8">
        {screen.type === "profile" && (
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
              {planDict.book.profileEyebrow}
            </p>
            <h1 className="mt-2 font-serif text-3xl text-ink sm:text-4xl">{title}</h1>
            <p className="mt-4 text-lg text-ink/70">{profileSummary}</p>
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
            <p className="text-xs font-medium uppercase tracking-widest text-ink/40">
              {planDict.book.ideaLabel} {screen.index + 1} {planDict.book.ofWord} {ideas.length}
            </p>
            <div className="mt-3">
              <IdeaDetail
                idea={screen.idea}
                index={null}
                locale={locale}
                labels={labels}
                dict={pdfChromeDict}
              />
            </div>
          </div>
        )}

        {screen.type === "wildcard" && wildcard && (
          <div className="rounded-2xl border-2 border-gold/60 bg-cream px-6 py-6">
            <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
              {labels.wildcard_heading || planDict.book.wildcardLabel}
            </p>
            <p className="mt-1.5 text-sm italic text-ink/60">{planDict.book.wildcardIntro}</p>
            <div className="mt-4">
              <IdeaDetail
                idea={wildcard}
                index={null}
                locale={locale}
                labels={labels}
                dict={pdfChromeDict}
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
          <div>
            <h1 className="font-serif text-2xl text-ink sm:text-3xl">
              {planDict.book.doneHeading}
            </h1>
            <p className="mt-2 text-ink/60">{planDict.book.doneSub}</p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-dark"
                >
                  {planDict.downloadPdf}
                </a>
              )}
              <ShareButton
                url={shareUrl}
                label={planDict.shareButtonLabel}
                copiedLabel={planDict.shareCopiedLabel}
              />
              {showEmailedCopy && <p className="text-sm text-ink/50">{planDict.emailedCopy}</p>}
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
