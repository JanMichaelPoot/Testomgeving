"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DoorIcon } from "@/components/window/DoorIcon";
import { IdeaDetail } from "@/components/window/IdeaDetail";
import { IdeaDialog } from "@/components/window/IdeaDialog";
import { IdeaFeedback } from "@/components/window/IdeaFeedback";
import { ShareButton } from "@/components/window/ShareButton";
import { commitToIdea, submitIdeaFeedback, type IdeaFeedbackValue } from "@/app/plan/actions";
import { DIFFICULTY_LABELS, type IdeaBookEntry } from "@/lib/claude/ideaBookTypes";
import { ideaCategoryPhoto } from "@/lib/illustrations";
import { WILDCARD_KEY, ideaKey } from "@/lib/ideaKeys";
import { DOOR_ORDER, orderIdeasByDoor, pickOneThingIndex } from "@/lib/possibilityMap";
import type { PlanEcho } from "@/lib/planEcho";
import { trackEvent } from "@/lib/posthog/client";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/language";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Door = (typeof DOOR_ORDER)[number];
type Reaction = IdeaFeedbackValue | null;

// ---------------------------------------------------------------------------
// "Wildcard opened" is per-visit UI state that should survive a refresh but
// not outlive the browser tab, so it lives in sessionStorage. Read through
// useSyncExternalStore (server snapshot: sealed) so hydration never
// disagrees with the server render, with an in-memory copy so it still works
// when storage is blocked.
// ---------------------------------------------------------------------------
const openedWildcards = new Set<string>();
const wildcardListeners = new Set<() => void>();
const wildcardStorageKey = (planId: string) => `window-wildcard-open-${planId}`;

function subscribeWildcard(listener: () => void) {
  wildcardListeners.add(listener);
  return () => {
    wildcardListeners.delete(listener);
  };
}

function readWildcardOpen(planId: string): boolean {
  if (openedWildcards.has(planId)) return true;
  try {
    return window.sessionStorage.getItem(wildcardStorageKey(planId)) === "1";
  } catch {
    return false;
  }
}

function markWildcardOpen(planId: string) {
  openedWildcards.add(planId);
  try {
    window.sessionStorage.setItem(wildcardStorageKey(planId), "1");
  } catch {
    // Storage blocked — the in-memory copy above still covers this page view.
  }
  wildcardListeners.forEach((listener) => listener());
}

function metaParts(idea: IdeaBookEntry, locale: Locale): string[] {
  return [
    idea.practical.estimated_cost,
    idea.practical.duration,
    DIFFICULTY_LABELS[locale][idea.practical.difficulty],
  ].filter(Boolean);
}

function locationLabel(idea: IdeaBookEntry): string | null {
  return idea.location ? [idea.location.name, idea.location.city].filter(Boolean).join(", ") : null;
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

function StarIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <path d="M8 1.5l1.9 4.1 4.4.5-3.3 3 .9 4.4L8 11.3 4.1 13.5l.9-4.4-3.3-3 4.4-.5L8 1.5z" fill="currentColor" />
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
  // Only the session that generated this plan may react to / commit to ideas
  // (server-side ownership check in plan/actions.ts). Someone who arrived via
  // the emailed link without that cookie can read everything, but the
  // controls that would only fail are hidden.
  canInteract: boolean;
  initialFeedback: Record<string, string>;
  initialCommittedKey: string | null;
  echo: PlanEcho;
  dateLabel: string;
}

// The paid result, as one scrolling page: an echo of what the person told us,
// the single idea we'd start with, all six ideas grouped behind four doors,
// the sealed wildcard, and a closing band. Replaces the earlier two-screen
// stepper (IdeaBookViewer).
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
  canInteract,
  initialFeedback,
  initialCommittedKey,
  echo,
  dateLabel,
}: PlanRevealProps) {
  const t = planDict.reveal;

  const [feedback, setFeedback] = useState<Record<string, string>>(initialFeedback);
  const [committedKey, setCommittedKey] = useState<string | null>(initialCommittedKey);
  const [commitState, setCommitState] = useState<"idle" | "pending" | "error">("idle");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const wildcardOpen = useSyncExternalStore(
    subscribeWildcard,
    () => readWildcardOpen(planId),
    () => false
  );

  useEffect(() => {
    trackEvent("plan_viewed", { planId });
  }, [planId]);

  // Same door order as the PDF, so an idea's page in the PDF is 4 + its
  // position here (page 1 cover, 2 profile, 3 possibility map).
  const orderedIdeas = useMemo(() => orderIdeasByDoor(ideas), [ideas]);
  const pdfPageByKey = useMemo(() => {
    const map = new Map<string, number>();
    orderedIdeas.forEach(({ originalIndex }, i) => map.set(ideaKey(originalIndex), 4 + i));
    map.set(WILDCARD_KEY, 4 + ideas.length);
    return map;
  }, [orderedIdeas, ideas.length]);

  const ideasByDoor = useMemo(() => {
    const groups = new Map<Door, typeof orderedIdeas>(DOOR_ORDER.map((door) => [door, []]));
    for (const entry of orderedIdeas) {
      // generateIdeaBook normalises the door, but this is display code — an
      // unrecognised one goes behind the furthest door rather than vanishing.
      const door: Door = isDoor(entry.idea.door) ? entry.idea.door : "stretch";
      groups.get(door)!.push(entry);
    }
    return groups;
  }, [orderedIdeas]);

  const featuredIndex = useMemo(() => pickOneThingIndex(ideas), [ideas]);
  const featured = featuredIndex !== null ? ideas[featuredIndex] : null;
  const featuredKey = featuredIndex !== null ? ideaKey(featuredIndex) : null;

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
    return pdfUrl && page ? `${pdfUrl}#page=${page}` : null;
  }

  function openIdea(key: string) {
    trackEvent("idea_opened", { planId, ideaKey: key });
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
      trackEvent("one_thing_committed", { planId, ideaKey: key, isOneThing: key === featuredKey });
    } else {
      setCommitState("error");
    }
  }

  function revealWildcard() {
    markWildcardOpen(planId);
    trackEvent("wildcard_revealed", { planId });
  }

  const trackPdf = (source: string) => () => trackEvent("plan_pdf_downloaded", { planId, source });

  const headline = echo.situation ? (
    <>
      {t.headingSaid.replace("{situation}", echo.situation)}{" "}
      <span className="italic text-accent">{t.headingClosing}</span>
    </>
  ) : (
    <span className="italic text-accent">{t.headingFallback}</span>
  );

  const shareClassName =
    "min-h-11 rounded-md border-accent-dark bg-accent-dark px-5 py-0 text-paper shadow-none hover:bg-accent";

  const featuredCommitted = committedKey !== null && committedKey === featuredKey;

  return (
    <div>
      {/* A — actions */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {pdfUrl && (
          <Button
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            variant="secondary"
            size="sm"
            onClick={trackPdf("header")}
          >
            {planDict.downloadPdf}
          </Button>
        )}
        <ShareButton
          url={shareUrl}
          label={planDict.shareButtonLabel}
          copiedLabel={planDict.shareCopiedLabel}
          className={shareClassName}
        />
      </div>
      {showEmailedCopy && (
        <p className="mt-2 text-right text-xs text-ink/60">{planDict.emailedCopy}</p>
      )}

      {/* B — echo header */}
      <header className="mt-10 flex flex-col gap-5 sm:mt-14">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          {t.eyebrow.replace("{date}", dateLabel)}
        </p>
        <h1 className="max-w-4xl text-balance font-serif text-4xl font-normal leading-[1.08] tracking-[-0.01em] text-ink sm:text-5xl lg:text-6xl">
          {headline}
        </h1>
        {echo.chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink/65">{t.basedOn}</span>
            {echo.chips.map((chip) => (
              <span
                key={chip}
                className="inline-flex min-h-8 items-center rounded-full border border-border bg-surface-active px-3.5 text-[13px] font-medium text-accent-dark"
              >
                {chip}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* C — "if you only pick one" */}
      {featured && featuredKey && (
        <section className="mt-10 sm:mt-12" aria-labelledby="one-thing-title">
          <div className="grid overflow-hidden rounded-lg border border-border bg-paper md:grid-cols-2">
            <div className="relative h-64 md:h-auto md:min-h-[460px]">
              <Image
                src={ideaCategoryPhoto(featured.photo_category, featuredIndex!)}
                alt=""
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
              <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-paper px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-accent-dark sm:left-6 sm:top-6">
                <StarIcon className="text-gold" />
                {planDict.book.oneThingBadge}
              </span>
            </div>
            <div className="flex flex-col gap-5 p-6 sm:p-9 lg:p-12">
              <div className="flex flex-col gap-2.5">
                {isDoor(featured.door) && (
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/60">
                    {t.doorLabel
                      .replace("{n}", String(DOOR_ORDER.indexOf(featured.door) + 1))
                      .replace("{label}", planDict.book.doors[featured.door].label)}
                  </p>
                )}
                <h2
                  id="one-thing-title"
                  className="font-serif text-3xl font-medium leading-[1.1] text-ink sm:text-4xl"
                >
                  {featured.title}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {[...metaParts(featured, locale), locationLabel(featured)]
                    .filter((part): part is string => Boolean(part))
                    .map((part) => (
                      <span
                        key={part}
                        className="rounded-sm bg-cream px-3 py-1.5 text-[13px] text-accent-dark"
                      >
                        {part}
                      </span>
                    ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                  {t.whyHeading}
                </p>
                <p className="font-serif text-xl italic leading-[1.45] text-ink">
                  {featured.why_it_fits}
                </p>
              </div>

              {featured.first_action && (
                <div className="rounded-md bg-accent-dark p-5">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-gold-light">
                    {labels.first_action_heading || t.firstStepHeading}
                  </p>
                  <p className="text-[15px] leading-relaxed text-paper">{featured.first_action}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {featuredCommitted ? (
                  <p
                    role="status"
                    className="inline-flex min-h-12 items-center gap-2.5 rounded-md bg-surface-active px-4 text-[15px] font-medium text-accent-dark"
                  >
                    <CheckIcon />
                    {t.committedNote}
                  </p>
                ) : (
                  <>
                    {canInteract && (
                      <Button
                        type="button"
                        disabled={commitState === "pending"}
                        onClick={() => commit(featuredKey)}
                      >
                        {t.commitCta}
                      </Button>
                    )}
                    <Button href="#deuren" variant="secondary">
                      {t.otherDoorCta}
                    </Button>
                  </>
                )}
              </div>
              {commitState === "error" && !featuredCommitted && (
                <p role="alert" className="text-sm text-ink/70">
                  {t.commitError}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* D — four doors */}
      <section id="deuren" className="scroll-mt-24 pt-16 sm:pt-20" aria-labelledby="doors-title">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-10">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              {planDict.book.mapEyebrow}
            </p>
            <h2
              id="doors-title"
              className="mt-2.5 font-serif text-3xl font-normal leading-[1.1] text-ink sm:text-4xl lg:text-[44px]"
            >
              {planDict.book.mapHeading}
            </h2>
          </div>
          <p className="max-w-sm text-[15px] leading-relaxed text-ink/70">
            {planDict.book.mapIntro} {canInteract ? t.heartHint : ""}
          </p>
        </div>

        <div className="mt-7 flex items-center gap-4" aria-hidden="true">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-ink/60">
            {t.scaleNear}
          </span>
          <span className="h-0.5 flex-1 bg-border" />
          <span className="shrink-0 text-right text-xs font-semibold uppercase tracking-[0.1em] text-accent">
            {t.scaleFar}
          </span>
        </div>

        <div className="mt-8 grid items-start gap-x-5 gap-y-12 md:grid-cols-2 lg:grid-cols-4">
          {DOOR_ORDER.map((door, doorIndex) => {
            const entries = ideasByDoor.get(door) ?? [];
            return (
              <div key={door} className="flex flex-col gap-4">
                <div className="flex items-center gap-3.5">
                  <DoorIcon door={door} />
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/60">
                      {t.doorWord.replace("{n}", String(doorIndex + 1))}
                    </p>
                    <h3 className="font-serif text-2xl font-medium text-ink">
                      {planDict.book.doors[door].label}
                    </h3>
                  </div>
                </div>
                <p className="min-h-[42px] text-sm leading-relaxed text-ink/70">
                  {planDict.book.doors[door].description}
                </p>

                {entries.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm italic text-ink/55">
                    {t.emptyDoor}
                  </p>
                )}

                {entries.map(({ idea, originalIndex }) => {
                  const key = ideaKey(originalIndex);
                  const liked = feedback[key] === "up";
                  return (
                    <article
                      key={key}
                      className="overflow-hidden rounded-lg border border-border bg-paper"
                    >
                      <div className="relative h-[150px]">
                        <Image
                          src={ideaCategoryPhoto(idea.photo_category, originalIndex)}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
                          className="object-cover"
                        />
                        {key === featuredKey && (
                          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-accent-dark">
                            <StarIcon className="h-3 w-3 text-gold" />
                            {planDict.book.oneThingBadge}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 px-4 pb-3 pt-4">
                        <h4 className="font-serif text-xl font-medium leading-tight text-ink">
                          {idea.title}
                        </h4>
                        <p className="text-[13px] text-ink/65">{metaParts(idea, locale).join(" · ")}</p>
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => openIdea(key)}
                            className="-ml-2 inline-flex min-h-11 items-center rounded-md px-2 text-[13px] font-semibold text-accent-dark hover:text-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/35"
                          >
                            {t.readIdea}
                          </button>
                          {canInteract && (
                            <button
                              type="button"
                              aria-pressed={liked}
                              aria-label={t.likeLabel}
                              onClick={() => toggleHeart(key)}
                              className={cn(
                                "inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/35",
                                liked
                                  ? "border-accent bg-surface-active"
                                  : "border-border bg-paper hover:border-walnut-light"
                              )}
                            >
                              <HeartIcon filled={liked} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      {/* E — the wildcard, sealed until opened */}
      {wildcard && (
        <section className="pt-16 sm:pt-20" aria-labelledby="wildcard-title">
          {!wildcardOpen ? (
            <div className="flex flex-col gap-8 overflow-hidden rounded-lg bg-accent-dark p-7 sm:p-12 md:flex-row md:items-center md:justify-between md:gap-12">
              <div className="flex max-w-2xl flex-col gap-3.5">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold-light">
                  <StarIcon />
                  {t.wildcardSealedEyebrow}
                </p>
                <h2
                  id="wildcard-title"
                  className="font-serif text-3xl font-normal leading-[1.1] text-paper sm:text-4xl lg:text-[44px]"
                >
                  {t.wildcardSealedHeading}
                </h2>
                <p className="text-base leading-relaxed text-paper/80">{t.wildcardSealedSub}</p>
              </div>
              <button
                type="button"
                onClick={revealWildcard}
                className="min-h-14 shrink-0 rounded-md border border-gold-light bg-gold-light px-8 text-base font-bold text-accent-dark transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold-light/50 focus-visible:ring-offset-2 focus-visible:ring-offset-accent-dark"
              >
                {t.wildcardOpenCta}
              </button>
            </div>
          ) : (
            <div className="animate-window-fade-in grid overflow-hidden rounded-lg bg-accent-dark md:grid-cols-2">
              <div className="flex flex-col gap-4 p-7 sm:p-12">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-light">
                  {labels.wildcard_heading || t.wildcardOpenEyebrow}
                </p>
                <h2
                  id="wildcard-title"
                  className="font-serif text-3xl font-normal leading-[1.1] text-paper sm:text-4xl"
                >
                  {wildcard.title}
                </h2>
                <p className="font-serif text-xl italic leading-[1.45] text-paper/85">
                  {wildcard.why_it_fits}
                </p>
                <p className="text-sm text-paper/70">{metaParts(wildcard, locale).join(" · ")}</p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => openIdea(WILDCARD_KEY)}
                    className="inline-flex min-h-12 items-center rounded-md border border-gold-light px-6 text-[15px] font-semibold text-gold-light transition-colors hover:bg-gold-light hover:text-accent-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold-light/50"
                  >
                    {t.readIdea}
                  </button>
                </div>
              </div>
              <div className="relative h-64 md:h-auto md:min-h-[360px]">
                <Image
                  src={ideaCategoryPhoto(wildcard.photo_category, ideas.length)}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* F — closing band */}
      <section className="pt-14 sm:pt-16">
        <div className="flex flex-col gap-6 rounded-lg border border-border bg-paper p-6 sm:p-8 md:flex-row md:items-center md:justify-between md:gap-8">
          <div className="flex flex-col gap-1">
            <p className="font-serif text-2xl text-ink">{t.closingHeading}</p>
            <p className="text-sm text-ink/70">{t.closingSub}</p>
            <Link
              href="/intake?utm_source=idea_book_done&utm_medium=return_cta"
              onClick={() => trackEvent("idea_book_done_return_clicked", { planId })}
              className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-accent-dark underline underline-offset-2 hover:text-accent"
            >
              {planDict.book.doneReturnCta}
            </Link>
          </div>
          <div className="flex flex-wrap gap-3">
            {pdfUrl && (
              <Button
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                variant="secondary"
                onClick={trackPdf("closing")}
              >
                {planDict.downloadPdf}
              </Button>
            )}
            <ShareButton
              url={shareUrl}
              label={planDict.shareButtonLabel}
              copiedLabel={planDict.shareCopiedLabel}
              className={cn(shareClassName, "min-h-12 px-6")}
            />
          </div>
        </div>
      </section>

      <IdeaDialog
        open={selected !== null}
        title={selected?.idea.title ?? ""}
        closeLabel={t.dialogClose}
        onClose={() => setSelectedKey(null)}
      >
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
            />
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
                    <p
                      role="status"
                      className="inline-flex min-h-12 items-center gap-2.5 rounded-md bg-surface-active px-4 text-[15px] font-medium text-accent-dark"
                    >
                      <CheckIcon />
                      {t.committedNote}
                    </p>
                  ) : (
                    <Button
                      type="button"
                      disabled={commitState === "pending"}
                      onClick={() => commit(selectedKey)}
                    >
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
            {pdfHref(selectedKey) && (
              <a
                href={pdfHref(selectedKey)!}
                target="_blank"
                rel="noreferrer"
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
