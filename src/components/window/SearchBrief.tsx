"use client";

import type { ReactNode } from "react";
import type { BriefRow, BriefRowId, SearchBrief as Brief } from "@/lib/searchBrief";
import type { VensterDictionary } from "@/lib/i18n/venster";

// "Jouw zoekprofiel": on the last screen, right above the order. What the book will be searched for, in the person's own answers, each row with a way
// back to change it. It adds nothing new to ask and decides nothing: it only says, once more and clearly, what was understood, before anything is paid.

const ICONS: Record<BriefRowId, ReactNode> = {
  who: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c.7-3.6 3.6-5.6 7.5-5.6s6.8 2 7.5 5.6" />
    </>
  ),
  where: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  time: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  budget: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.8 9.3c-.5-.9-1.5-1.4-2.7-1.4-1.6 0-2.8.9-2.8 2.1 0 3 5.6 1.4 5.6 4.1 0 1.2-1.2 2.1-2.9 2.1-1.3 0-2.4-.6-2.9-1.6M8.6 11.3h5.2M8.6 13.2h5.2" />
    </>
  ),
  limits: (
    <>
      <path d="M12 3.5l7 2.6v5.2c0 4.3-2.9 7.6-7 9.2-4.1-1.6-7-4.9-7-9.2V6.1z" />
      <path d="M8.8 12.2l2.2 2.2 4.2-4.4" />
    </>
  ),
  picks: (
    <>
      <path d="M12 4l1.7 4.4 4.4 1.7-4.4 1.7L12 16.2l-1.7-4.4L5.9 10.1l4.4-1.7z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
};

function Icon({ id }: { id: BriefRowId }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[id]}
    </svg>
  );
}

export function SearchBrief({
  brief,
  copy,
  onEdit,
}: {
  brief: Brief;
  copy: Pick<VensterDictionary["brief"], "kicker" | "heading" | "sub" | "edit" | "editFor">;
  onEdit: (row: BriefRow) => void;
}) {
  return (
    <section aria-labelledby="brief-title" data-testid="search-brief" className="overflow-hidden rounded-lg border border-border bg-paper">
      <div className="border-b border-border bg-surface-active px-5 py-4 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold-text">{copy.kicker}</p>
        <h2 id="brief-title" className="mt-1 font-serif text-xl leading-tight text-ink sm:text-2xl">
          {copy.heading}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{copy.sub}</p>
      </div>

      <dl className="divide-y divide-border">
        {brief.rows.map((row) => (
          <div key={row.id} data-brief-row={row.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-x-3 px-5 py-3.5 sm:px-6">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-gold-light text-accent-dark">
              <Icon id={row.id} />
            </span>
            <div className="min-w-0">
              <dt className="text-xs font-bold uppercase tracking-[0.08em] text-ink/65">{row.label}</dt>
              <dd className="mt-0.5">
                {row.items && row.items.length > 0 ? (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {row.items.map((item) => (
                      <li key={item} className="rounded-full border border-border bg-cream px-2.5 py-1 text-sm leading-tight text-ink">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className={row.empty ? "text-sm italic text-ink/60" : "font-semibold text-ink"}>{row.value}</span>
                )}
                {row.detail && <span className="mt-0.5 block text-sm text-ink/70">{row.detail}</span>}
              </dd>
            </div>
            <button
              type="button"
              onClick={() => onEdit(row)}
              aria-label={copy.editFor.replace("{row}", row.label)}
              className="-my-1 inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-accent-dark underline decoration-gold/70 underline-offset-4 transition hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/60"
            >
              {copy.edit}
            </button>
          </div>
        ))}
      </dl>

      {brief.foot && (
        <p className="flex items-start gap-2.5 border-t border-border bg-gold-light/40 px-5 py-3.5 text-sm leading-relaxed text-ink/80 sm:px-6" data-testid="brief-foot">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-accent-dark" viewBox="0 0 12 10" fill="none" aria-hidden="true">
            <path d="M1 5l3.5 4L11 1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {brief.foot}
        </p>
      )}
    </section>
  );
}
