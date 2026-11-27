"use client";

import { isDiscoveryLevel } from "@/lib/discoveryLevels";
import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { IdeaDetail } from "@/components/window/IdeaDetail";
import { IdeaDialog } from "@/components/window/IdeaDialog";
import { IdeaFeedback } from "@/components/window/IdeaFeedback";
import { IdeaThread } from "@/components/plan/IdeaThread";
import { pdfPageNumbers } from "@/lib/claude/ideaLayers";
import { ShareButton } from "@/components/window/ShareButton";
import { BookRating, type BookRatingProps } from "@/components/window/BookRating";
import { IdeaShare } from "@/components/window/IdeaShare";
import { shortExplanation } from "@/lib/ideaShare";
import type { IdeaShareCopy } from "@/lib/i18n/ideaShare";
import { commitToIdea, submitIdeaFeedback, type IdeaFeedbackValue } from "@/app/plan/actions";
import { DIFFICULTY_LABELS, type IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { ideaPhoto } from "@/lib/illustrations";
import type { BecauseLine, VensterEcho } from "@/lib/vensterReveal";
import type { IdeaThreadData } from "@/lib/ideaThread";
import { WILDCARD_KEY, ideaKey } from "@/lib/ideaKeys";
import { DOOR_ORDER, orderIdeasByDoor } from "@/lib/possibilityMap";
import type { PlanEcho } from "@/lib/planEcho";
import { trackEvent } from "@/lib/posthog/client";
import { ideaImageOrigin, imageCaption, imageTag } from "@/lib/copy/disclaimers";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/language";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Door = (typeof DOOR_ORDER)[number];
type Reaction = IdeaFeedbackValue | null;

function metaParts(idea: IdeaBookEntry, locale: Locale): string[] {
  return [idea.practical.estimated_cost, idea.practical.duration, DIFFICULTY_LABELS[locale][idea.practical.difficulty]].filter(Boolean);
}

function isDoor(value: string): value is Door {
  return (DOOR_ORDER as readonly string[]).includes(value);
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5l3.2 3.2L13 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 17s-6.5-3.9-6.5-8.6A3.6 3.6 0 0 1 10 6a3.6 3.6 0 0 1 6.5 2.4C16.5 13.1 10 17 10 17z"
        strokeWidth="1.6"
        strokeLinejoin="round"
        className={cn("stroke-accent", filled ? "fill-accent" : "fill-none")}
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
    </svg>
  );
}

export interface PlanRevealProps {
  planId: string;
  ideas: IdeaBookEntry[];
  wildcard: IdeaBookEntry | null;
  labels: Record<string, string>;
  locale: Locale;
  pdfChromeDict: Dictionary["pdfChrome"];
  planDict: Dictionary["plan"];
  pdfUrl: string | null;
  shareUrl: string;
  showEmailedCopy: boolean;
  /** The delivery address with its name hidden (maskEmail), so the buyer can see where the copy went. */
  emailedTo?: string | null;
  /** The delivery e-mail failed (recorded); the PDF here is then the only copy the buyer gets. */
  emailNotSent?: boolean;
  // Only the session that generated this plan may react to / commit to ideas
  // (server-side ownership check in plan/actions.ts). Someone who arrived via
  // the emailed link without that cookie can read everything, but the
  // controls that would only fail are hidden.
  canInteract: boolean;
  initialFeedback: Record<string, string>;
  initialCommittedKey: string | null;
  /** An idea to open at once: the key from a link in the e-mail (?idee=idea-2), already checked for its format. */
  initialOpenKey?: string | null;
  echo: PlanEcho;
  dateLabel: string;
  // Books from the image intake ("Het venster"): the chosen images as the echo. Absent for older books and the other wizards.
  vensterEcho?: VensterEcho | null;
  because?: Record<string, BecauseLine>;
  // Per idea key: how that door came about (image, tags, door, place). Only books that stored it.
  threads?: Record<string, IdeaThreadData>;
  vensterDict?: Dictionary["venster"];
  /** The rating block under the PDF button (Step 241); only for the owner of the book, so absent for anyone else. */
  bookRating?: BookRatingProps;
  /** Sharing one idea as a card (Step 242), in the idea dialog; absent in places that cannot share (nothing is shown then). */
  ideaShare?: { siteUrl: string; copy: IdeaShareCopy };
}

// The paid result as one compact overview ("Jouw mogelijkheden in kaart"): all the ideas and the wildcard in one list, door by door, each with its
// photo, its title, a short explanation and its practical facts next to it; one press opens the full idea in a dialog. At the bottom one primary
// action: download the PDF (it opens in the browser). No long text blocks, no sealed wildcard, no second screen: the result is understood at a glance.
export function PlanReveal({
  planId,
  ideas,
  wildcard,
  labels,
  locale,
  pdfChromeDict,
  planDict,
  pdfUrl,
  shareUrl,
  showEmailedCopy,
  emailedTo = null,
  emailNotSent = false,
  canInteract,
  initialFeedback,
  initialCommittedKey,
  initialOpenKey = null,
  echo,
  dateLabel,
  vensterEcho = null,
  threads = {},
  vensterDict,
  bookRating,
  ideaShare,
}: PlanRevealProps) {
  const t = planDict.reveal;

  const [feedback, setFeedback] = useState<Record<string, string>>(initialFeedback);
  const [committedKey, setCommittedKey] = useState<string | null>(initialCommittedKey);
  const [commitState, setCommitState] = useState<"idle" | "pending" | "error">("idle");
  // An address from the mail opens that idea straight away, but only one that exists in this book (a key for an idea that is not there is ignored).
  const [selectedKey, setSelectedKey] = useState<string | null>(() => {
    if (!initialOpenKey) return null;
    const exists = initialOpenKey === WILDCARD_KEY ? !!wildcard : !!ideas[Number(initialOpenKey.replace("idea-", ""))];
    return exists ? initialOpenKey : null;
  });
  const [, startTransition] = useTransition();

  useEffect(() => {
    trackEvent("plan_viewed", { planId });
  }, [planId]);

  // Measure how often the links in the mail are used (once, for the idea that opened from the address).
  useEffect(() => {
    if (!initialOpenKey) return;
    const opened = initialOpenKey === WILDCARD_KEY ? wildcard : ideas[Number(initialOpenKey.replace("idea-", ""))];
    if (opened) trackEvent("idea_opened", { planId, ideaKey: initialOpenKey, level: isDiscoveryLevel(opened.level) ? opened.level : 0, source: "email" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the first render counts
  }, []);

  // Same door order as the PDF, so an idea's page in the PDF is 4 + its position (page 1 cover, 2 profile and map).
  const orderedIdeas = useMemo(() => orderIdeasByDoor(ideas), [ideas]);
  const pdfPageByKey = useMemo(() => {
    // An idea with extra layers has a second PDF page (R2.3), which pushes the later pages on.
    const pages = pdfPageNumbers(orderedIdeas.map((e) => e.idea));
    const map = new Map<string, number>();
    orderedIdeas.forEach(({ originalIndex }, i) => map.set(ideaKey(originalIndex), pages.ideas[i]));
    map.set(WILDCARD_KEY, pages.wildcard);
    return map;
  }, [orderedIdeas]);

  const selected = useMemo(() => {
    if (!selectedKey) return null;
    if (selectedKey === WILDCARD_KEY) {
      return wildcard ? { idea: wildcard, photoIndex: ideas.length, isWildcard: true } : null;
    }
    const index = Number(selectedKey.replace("idea-", ""));
    return ideas[index] ? { idea: ideas[index], photoIndex: index, isWildcard: false } : null;
  }, [selectedKey, ideas, wildcard]);

  function pdfHref(key: string): string | null {
    const page = pdfPageByKey.get(key);
    return pdfUrl && page ? `${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}page=${page}` : null;
  }

  function openIdea(key: string) {
    // The discovery level (1-7) of the door, 0 when the book is from before the levels.
    const opened = key === WILDCARD_KEY ? wildcard : ideas[Number(key.replace("idea-", ""))];
    trackEvent("idea_opened", { planId, ideaKey: key, level: isDiscoveryLevel(opened?.level) ? opened.level : 0, source: "overview" });
    setSelectedKey(key);
  }

  function setReaction(key: string, next: Reaction) {
    setFeedback((prev) => {
      const copy = { ...prev };
      if (next) copy[key] = next;
      else delete copy[key];
      return copy;
    });
  }

  function toggleHeart(key: string) {
    const previous = (feedback[key] as Reaction | undefined) ?? null;
    // Same rule as IdeaFeedback: pressing the active reaction clears it.
    const next: Reaction = previous === "up" ? null : "up";
    setReaction(key, next);
    trackEvent("idea_liked", { planId, ideaKey: key, value: next });
    startTransition(async () => {
      try {
        await submitIdeaFeedback(planId, key, next);
      } catch {
        // A reaction that doesn't save isn't worth an error message — roll back.
        setReaction(key, previous);
      }
    });
  }

  async function commit(key: string) {
    setCommitState("pending");
    let ok = false;
    try {
      ok = (await commitToIdea(planId, key)).ok;
    } catch {
      ok = false;
    }
    if (ok) {
      setCommittedKey(key);
      setCommitState("idle");
      trackEvent("one_thing_committed", { planId, ideaKey: key, isOneThing: false });
    } else {
      setCommitState("error");
    }
  }

  const trackPdf = (source: string) => () => {
    trackEvent("pdf_opened", { source });
    trackEvent("plan_pdf_downloaded", { planId, source });
  };

  // One row per idea: the regular ideas in door order, then the wildcard.
  const rows = [
    ...orderedIdeas.map(({ idea, originalIndex }, i) => ({ key: ideaKey(originalIndex), idea, photoIndex: originalIndex, number: i + 1, wildcard: false })),
    ...(wildcard ? [{ key: WILDCARD_KEY, idea: wildcard, photoIndex: ideas.length, number: ideas.length + 1, wildcard: true }] : []),
  ];

  const subline = vensterEcho
    ? [vensterEcho.sentence, vensterEcho.wrote].filter(Boolean).join(" ")
    : echo.situation
      ? `${t.headingSaid.replace("{situation}", echo.situation)} ${t.headingClosing}`
      : t.headingFallback;

  return (
    <div>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{t.eyebrow.replace("{date}", dateLabel)}</p>
          <ShareButton
            url={shareUrl}
            label={planDict.shareButtonLabel}
            copiedLabel={planDict.shareCopiedLabel}
            whatsappLabel={planDict.shareWhatsappLabel}
            className="min-h-11 border-0 bg-transparent px-2 py-0 text-sm font-semibold text-accent-dark shadow-none underline underline-offset-2 hover:bg-transparent hover:text-accent"
          />
        </div>
        <h1 className="font-serif text-3xl font-normal leading-[1.1] tracking-[-0.01em] text-ink sm:text-4xl lg:text-5xl">{planDict.book.mapHeading}</h1>
        <p className="max-w-3xl text-base leading-relaxed text-ink/75" data-testid="plan-subline">
          {subline}
        </p>
        {emailNotSent && <p className="text-xs text-ink/70">{planDict.emailNotSent}</p>}
        {showEmailedCopy && <p className="text-xs text-ink/70">{emailedTo ? planDict.emailedCopyTo.replace("{address}", emailedTo) : planDict.emailedCopy}</p>}
      </header>

      <ol className="mt-6 grid gap-3" data-testid="plan-overview" aria-label={planDict.book.mapHeading}>
        {rows.map((row) => {
          const liked = feedback[row.key] === "up";
          const door = row.wildcard ? null : isDoor(row.idea.door) ? row.idea.door : null;
          const eyebrow = row.wildcard ? `${row.number} · ${labels.wildcard_heading || t.wildcardOpenEyebrow}` : door ? `${row.number} · ${planDict.book.doors[door].label}` : String(row.number);
          return (
            <li
              key={row.key}
              data-testid="plan-row"
              data-door={row.wildcard ? "wildcard" : (door ?? "")}
              className={cn(
                "grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-xl border bg-paper p-3 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:gap-x-5 sm:p-4",
                row.wildcard ? "border-gold/70 bg-gold/10" : "border-border",
              )}
            >
              <button
                type="button"
                onClick={() => openIdea(row.key)}
                aria-label={row.idea.title}
                tabIndex={-1}
                className="relative row-span-2 aspect-square w-full self-start overflow-hidden rounded-lg sm:row-span-1 sm:self-center"
              >
                <Image src={ideaPhoto(row.idea, row.photoIndex)} alt="" fill sizes="96px" className="object-cover" />
                {/* Too small for the whole caption: the one word here, the full caption with the large picture. */}
                <span title={imageCaption(ideaImageOrigin(), locale)} className="absolute inset-x-0 bottom-0 bg-ink/60 py-0.5 text-center text-[10px] font-medium leading-tight text-white">
                  {imageTag(ideaImageOrigin(), locale)}
                </span>
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gold-text">{eyebrow}</p>
                <h2 className="mt-0.5 font-serif text-lg font-medium leading-snug text-ink sm:text-xl">{row.idea.title}</h2>
                <p className="mt-1 text-sm leading-snug text-ink/80 line-clamp-2 sm:line-clamp-none" data-testid="plan-row-text">
                  {shortExplanation(row.idea)}
                </p>
                <p className="mt-1.5 text-xs text-ink/70">{metaParts(row.idea, locale).join(" · ")}</p>
              </div>
              <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end sm:justify-center">
                <button
                  type="button"
                  onClick={() => openIdea(row.key)}
                  className="inline-flex min-h-11 items-center rounded-lg border border-border bg-cream px-4 text-sm font-semibold text-accent-dark transition-colors hover:border-accent-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/35"
                >
                  {t.readIdea}
                </button>
                {canInteract && (
                  <button
                    type="button"
                    aria-pressed={liked}
                    aria-label={t.likeLabel}
                    onClick={() => toggleHeart(row.key)}
                    className={cn(
                      "inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/35",
                      liked ? "border-accent bg-surface-active" : "border-border bg-paper hover:border-walnut-light",
                    )}
                  >
                    <HeartIcon filled={liked} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* The one primary action: the PDF. It opens in our own reading page (/plan/boek), which has the way back and the download button. */}
      <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl bg-accent-dark px-6 py-8 text-center sm:py-10">
        <p className="font-serif text-2xl leading-snug text-paper sm:text-3xl">{planDict.downloadHeading}</p>
        {pdfUrl ? (
          <Button
            href={pdfUrl}
            size="lg"
            onClick={trackPdf("bottom")}
            data-testid="download-pdf"
            className="min-w-64 justify-center gap-2 border-gold-light bg-gold-light text-accent-dark hover:bg-paper"
          >
            <DownloadIcon />
            {planDict.downloadNow}
          </Button>
        ) : (
          <p className="max-w-md text-sm text-paper/80" role="status">
            {planDict.pdfUnavailable}
          </p>
        )}
      </div>

      {canInteract && bookRating && <BookRating {...bookRating} />}

      <IdeaDialog open={selected !== null} title={selected?.idea.title ?? ""} closeLabel={t.dialogClose} onClose={() => setSelectedKey(null)}>
        {selected && selectedKey && (
          <div className="flex flex-col gap-4">
            <IdeaDetail
              idea={selected.idea}
              index={null}
              photoIndex={selected.photoIndex}
              locale={locale}
              labels={labels}
              dict={pdfChromeDict}
              isWildcard={selected.isWildcard}
              moreCopy={vensterDict?.more}
            />
            {threads[selectedKey] && vensterDict && <IdeaThread thread={threads[selectedKey]} copy={vensterDict.thread} />}
            {canInteract && (
              <div className="flex flex-col gap-4 rounded-lg border border-border bg-paper p-4 sm:p-5">
                <IdeaFeedback
                  key={selectedKey}
                  planId={planId}
                  ideaKey={selectedKey}
                  initialValue={(feedback[selectedKey] as Reaction | undefined) ?? null}
                  prompt={t.feedbackPrompt}
                  upLabel={t.feedbackUp}
                  downLabel={t.feedbackDown}
                  thanksLabel={t.feedbackThanks}
                  onChange={(value) => {
                    setReaction(selectedKey, value);
                    trackEvent("idea_liked", { planId, ideaKey: selectedKey, value });
                  }}
                />
                <div className="flex flex-wrap items-center gap-3">
                  {committedKey === selectedKey ? (
                    <p role="status" className="inline-flex min-h-12 items-center gap-2.5 rounded-md bg-surface-active px-4 text-[15px] font-medium text-accent-dark">
                      <CheckIcon />
                      {t.committedNote}
                    </p>
                  ) : (
                    <Button type="button" disabled={commitState === "pending"} onClick={() => commit(selectedKey)}>
                      {t.commitCta}
                    </Button>
                  )}
                  {commitState === "error" && committedKey !== selectedKey && (
                    <p role="alert" className="text-sm text-ink/70">
                      {t.commitError}
                    </p>
                  )}
                </div>
              </div>
            )}
            {ideaShare && <IdeaShare planId={planId} ideaKey={selectedKey} title={selected.idea.title} siteUrl={ideaShare.siteUrl} copy={ideaShare.copy} />}
            {pdfHref(selectedKey) && (
              <a
                href={pdfHref(selectedKey)!}
                onClick={trackPdf("idea")}
                className="inline-flex min-h-11 items-center self-start text-sm font-medium text-accent-dark underline underline-offset-2 hover:text-accent"
              >
                {planDict.book.viewAsPdfLabel}
              </a>
            )}
          </div>
        )}
      </IdeaDialog>
    </div>
  );
}
