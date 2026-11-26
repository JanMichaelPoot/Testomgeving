import type { ReactNode } from "react";
import { normalizeUrl } from "@/lib/links/normalizeUrl";
import { cn } from "@/lib/utils";

// A link to another website from a book's web page: always a new tab (the reader keeps their book), never with access back to this page or
// the address of it, and marked with the usual "opens elsewhere" icon. An address that is not a public https address shows as plain text.
export function ExternalLink({ href, children, className, onClick }: { href: string; children: ReactNode; className?: string; onClick?: () => void }) {
  const url = normalizeUrl(href);
  if (!url) return <span className={className}>{children}</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={onClick} className={cn("gap-1", className)}>
      {children}
      <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 2.5H2.5v7h7V7" />
        <path d="M7 2h3v3M10 2 5.5 6.5" />
      </svg>
    </a>
  );
}
