"use client";

import Image from "next/image";
import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { activityImage, domainImage } from "@/lib/discovery/paths";
import type { CardActivity, CardDomain, CardLibrary, CardSlot } from "@/lib/discovery/cards";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// The visual interest step of the card wizard: first the worlds (domains) a person
// is curious about, then 8-12 concrete activity cards at a time. Everything is
// optional, everything can be undone, and it works without the pictures.
// Presentational only: the wizard owns the state (see IntakeWizard).

export type DiscoveryStage = "domains" | "cards";

type Dict = Dictionary["intake"]["discovery"];

const IMAGE_SIZES = "(min-width: 640px) 210px, 44vw";

function CheckBadge() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-2 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-paper"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M3 8.5l3.2 3.2L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// Arrow keys move between the cards of a grid (a card is a button, so Tab works too).
function moveFocusInGrid(e: KeyboardEvent<HTMLElement>) {
  const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
  if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
  const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-card-toggle]"));
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (at < 0) return;
  const columns = getComputedStyle(e.currentTarget).gridTemplateColumns.split(" ").length || 1;
  const delta = step[e.key] ?? (e.key === "ArrowDown" ? columns : -columns);
  const target = buttons[at + delta];
  if (target) {
    e.preventDefault();
    target.focus();
  }
}

function DomainCard({
  domain,
  selected,
  onToggle,
}: {
  domain: CardDomain;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border-2 bg-paper transition-colors",
        selected ? "border-ink" : "border-border hover:border-ink/30",
      )}
    >
      <button
        type="button"
        data-card-toggle
        aria-pressed={selected}
        onClick={onToggle}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/50"
      >
        <span className="block h-1" style={{ backgroundColor: domain.color }} aria-hidden="true" />
        <span className="relative block aspect-[4/3] w-full bg-cream">
          <Image src={domainImage(domain.id)} alt="" fill sizes={IMAGE_SIZES} className="object-cover" />
        </span>
        <span className="block px-3 py-2.5 text-sm font-semibold leading-snug text-ink">{domain.label}</span>
      </button>
      {selected && <CheckBadge />}
    </div>
  );
}

function ActivityCard({
  activity,
  color,
  selected,
  ext,
  textOnly,
  dict,
  onToggle,
}: {
  activity: CardActivity;
  color: string;
  selected: boolean;
  ext: boolean;
  textOnly: boolean;
  dict: Dict["cardStep"];
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const canExplain = !!activity.entry;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border-2 bg-paper transition-colors",
        selected ? "border-ink" : ext ? "border-dashed border-border hover:border-ink/30" : "border-border hover:border-ink/30",
      )}
    >
      <button
        type="button"
        data-card-toggle
        aria-pressed={selected}
        onClick={onToggle}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/50"
      >
        <span className="block h-1" style={{ backgroundColor: color }} aria-hidden="true" />
        {!textOnly && (
          <span className="relative block aspect-[4/3] w-full bg-cream">
            <Image src={activityImage(activity.id)} alt="" fill sizes={IMAGE_SIZES} className="object-cover" />
          </span>
        )}
        <span className={cn("block px-3 py-2.5", textOnly && "pr-16")}>
          {ext && (
            <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
              {dict.maybeAlso}
            </span>
          )}
          <span className="block text-sm font-semibold leading-snug text-ink">{activity.label}</span>
        </span>
      </button>
      {selected && <CheckBadge />}
      {canExplain && (
        <>
          {/* A 44px target around a small "i": the picture stays clean, the target stays big. */}
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? dict.infoClose : dict.infoOpen.replace("{label}", activity.label)}
            onClick={() => setOpen((v) => !v)}
            className="absolute left-0 top-1 flex h-11 w-11 items-center justify-center focus-visible:outline-none"
          >
            <span
              aria-hidden="true"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-paper/90 text-[12px] font-bold text-ink shadow-[0_0_0_1px_var(--color-border)]"
            >
              {open ? "×" : "i"}
            </span>
          </button>
          {open && (
            <p className="border-t border-border bg-cream px-3 py-2.5 text-xs leading-relaxed text-ink/75">
              <span className="font-semibold text-ink">{dict.entryLabel}</span> {activity.entry}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function DiscoveryStep({
  stage,
  library,
  dict,
  chosenDomains,
  interests,
  surpriseMe,
  batches,
  batchesShown,
  textOnly,
  onToggleDomain,
  onToggleSurprise,
  onSkip,
  onToggleCard,
  onMore,
  onBackToDomains,
  onTextOnly,
}: {
  stage: DiscoveryStage;
  library: CardLibrary;
  dict: Dict;
  chosenDomains: string[];
  interests: string[];
  surpriseMe: boolean;
  batches: CardSlot[][];
  batchesShown: number;
  textOnly: boolean;
  onToggleDomain: (id: string) => void;
  onToggleSurprise: () => void;
  onSkip: () => void;
  onToggleCard: (id: string, batch: number) => void;
  onMore: () => void;
  onBackToDomains: () => void;
  onTextOnly: (value: boolean) => void;
}) {
  const activityById = new Map(library.activities.map((a) => [a.id, a]));
  const colorOf = new Map(library.domains.map((d) => [d.id, d.color]));
  const chosenCount = interests.length;
  const countText = (n: number) => dict.domainStep.chosenCount.replace("{n}", String(n));

  if (stage === "domains") {
    return (
      <div>
        <div role="group" aria-label={dict.pages.interests.heading} onKeyDown={moveFocusInGrid} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {library.domains.map((d) => (
            <DomainCard key={d.id} domain={d} selected={chosenDomains.includes(d.id)} onToggle={() => onToggleDomain(d.id)} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={surpriseMe}
            onClick={onToggleSurprise}
            className={cn(
              "min-h-13 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/50",
              surpriseMe ? "border-ink bg-surface-active text-ink" : "border-border bg-paper text-ink hover:border-ink/30",
            )}
          >
            {dict.domainStep.surpriseMe}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="min-h-13 rounded-lg border-2 border-border bg-paper px-4 py-3 text-sm font-semibold text-ink/70 transition-colors hover:border-ink/30 hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/50"
          >
            {dict.domainStep.skip}
          </button>
        </div>
        <p aria-live="polite" className="mt-3 text-sm text-ink/60">
          {countText(chosenDomains.length)}
        </p>
      </div>
    );
  }

  const shown = batches.slice(0, batchesShown);
  const canShowMore = batchesShown < batches.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={onBackToDomains}
          className="min-h-11 text-sm font-medium text-accent-dark underline underline-offset-2 hover:text-ink"
        >
          {dict.cardStep.changeDomains}
        </button>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink/70">
          <input type="checkbox" checked={textOnly} onChange={(e) => onTextOnly(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
          {dict.cardStep.textOnly}
        </label>
      </div>

      {interests.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {interests.map((id) => {
            const a = activityById.get(id);
            if (!a) return null;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onToggleCard(id, -1)}
                  aria-label={`${a.label}, ${dict.cardStep.selected}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface-active px-3 text-xs font-medium text-ink hover:border-ink/40"
                >
                  {a.label}
                  <span aria-hidden="true" className="text-ink/50">×</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div onKeyDown={moveFocusInGrid} role="group" aria-label={dict.cardStep.heading} className={cn("mt-4 grid gap-2.5", textOnly ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        {shown.flatMap((batch, bi) =>
          batch.map((slot) => {
            const a = activityById.get(slot.id);
            if (!a) return null;
            return (
              <ActivityCard
                key={slot.id}
                activity={a}
                color={colorOf.get(a.domain) ?? "#888888"}
                selected={interests.includes(slot.id)}
                ext={slot.ext}
                textOnly={textOnly}
                dict={dict.cardStep}
                onToggle={() => onToggleCard(slot.id, bi)}
              />
            );
          }),
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {canShowMore ? (
          <button
            type="button"
            onClick={onMore}
            className="min-h-11 rounded-lg border-2 border-border bg-paper px-5 text-sm font-semibold text-ink transition-colors hover:border-ink/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/50"
          >
            {dict.cardStep.more}
          </button>
        ) : (
          <span className="text-sm text-ink/50">{dict.cardStep.noMore}</span>
        )}
        <p aria-live="polite" className="text-sm text-ink/60">
          {chosenCount === 0 ? dict.cardStep.none : dict.cardStep.chosenCount.replace("{n}", String(chosenCount))}
        </p>
      </div>
    </div>
  );
}
