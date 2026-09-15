"use client";

import { useMemo, useState } from "react";

export type AdminLogRow = {
  id: string;
  createdAt: string;
  locale: string;
  situation: string;
  purpose: string;
  budget: string;
  ideaCount: number;
  wildcardTitle: string;
  emailDelivered: boolean;
};

// Client-side search only — see src/app/admin/page.tsx for why the row
// count is capped (a plain in-memory filter over a few hundred rows is
// instant and needs no server round-trip; the .xlsx export is the tool for
// anything beyond what fits comfortably on screen).
export function AdminLogTable({ rows }: { rows: AdminLogRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.situation, row.purpose, row.budget, row.wildcardTitle, row.locale]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  return (
    <div className="mt-6">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Zoeken (situatie, doel, budget, wildcard-titel)…"
        className="mb-4 w-full max-w-sm rounded-xl border border-ink/15 bg-paper px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none placeholder:text-ink/35 focus:border-accent"
      />

      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-paper">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/50">
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">Taal</th>
              <th className="px-4 py-3">Situatie</th>
              <th className="px-4 py-3">Doel</th>
              <th className="px-4 py-3">Budget</th>
              <th className="px-4 py-3">Ideeën</th>
              <th className="px-4 py-3">Wildcard</th>
              <th className="px-4 py-3">Gemaild</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-b border-ink/5 last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-ink/70">
                  {new Date(row.createdAt).toLocaleString("nl-NL", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-4 py-3 text-ink/70">{row.locale}</td>
                <td className="px-4 py-3 text-ink">{row.situation || "—"}</td>
                <td className="px-4 py-3 text-ink">{row.purpose || "—"}</td>
                <td className="px-4 py-3 text-ink/70">{row.budget || "—"}</td>
                <td className="px-4 py-3 text-ink/70">{row.ideaCount}</td>
                <td className="px-4 py-3 text-ink/70">{row.wildcardTitle || "—"}</td>
                <td className="px-4 py-3">
                  {row.emailDelivered ? (
                    <span className="text-accent">✓</span>
                  ) : (
                    <span className="text-ink/30">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink/50">
                  Geen rijen gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
