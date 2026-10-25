import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAdmin } from "./actions";

// Shared pieces of the admin pages: the header with the menu, number tiles and plain bar lists.
// Plain markup on purpose (no chart library): the numbers are small and have to read at a glance.

const NAV = [
  { href: "/admin", label: "Overzicht" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/inhoud", label: "Inhoud" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/logboek", label: "Logboek" },
  { href: "/admin/opruimen", label: "Opruimen" },
] as const;

export function AdminShell({ active, title, intro, children }: { active: (typeof NAV)[number]["href"]; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-full bg-cream px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/10 pb-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">WINDOW — admin</p>
            <h1 className="mt-1 font-serif text-2xl text-ink">{title}</h1>
            {intro && <div className="mt-1 max-w-2xl text-sm text-ink/60">{intro}</div>}
          </div>
          <form action={logoutAdmin}>
            <button type="submit" className="text-sm font-medium text-ink/50 hover:text-ink">
              Uitloggen
            </button>
          </form>
        </div>
        <nav aria-label="Admin" className="mt-4 flex flex-wrap gap-1 border-b border-ink/10 pb-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={n.href === active ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${n.href === active ? "bg-accent-dark text-white" : "text-ink/70 hover:bg-ink/5"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 space-y-10">{children}</div>
      </div>
    </div>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-medium uppercase tracking-widest text-accent-dark">{title}</h2>
      {hint && <p className="mt-1 max-w-3xl text-sm text-ink/60">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Tile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-paper p-4">
      <p className="text-xs text-ink/50">{label}</p>
      <p className={`mt-1 font-serif text-3xl ${tone === "bad" ? "text-red-700" : tone === "good" ? "text-emerald-800" : "text-ink"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink/50">{sub}</p>}
    </div>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

/** Horizontal bars; the longest bar is the largest value in the list. */
export function BarList({ items, empty = "Nog geen gegevens.", total }: { items: { label: string; value: number; sub?: string }[]; empty?: string; total?: number }) {
  if (items.length === 0) return <p className="text-sm text-ink/50">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,16rem)_1fr_auto]">
          <span className="truncate text-ink" title={i.label}>
            {i.label}
            {i.sub && <span className="ml-1 text-xs text-ink/40">{i.sub}</span>}
          </span>
          <span className="h-2 rounded-full bg-ink/5">
            <span className="block h-2 rounded-full bg-accent" style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} />
          </span>
          <span className="w-16 text-right tabular-nums text-ink/70">
            {i.value}
            {total ? <span className="text-xs text-ink/40"> · {Math.round((i.value / total) * 100)}%</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-ink/10 bg-paper p-5 ${className}`}>{children}</div>;
}

export function formatSeconds(s: number | null): string {
  if (s === null) return "—";
  return s >= 90 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`;
}

export function formatEuro(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace(".", ",")}`;
}
