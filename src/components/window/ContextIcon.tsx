import type { SearchContext } from "@/lib/discovery/audience";

// Small line drawings for the "voor wie" choices on the start page: one person, a smaller person, two people, and a group. Decorative; the label next to them says the same.

const COMMON = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function ContextIcon({ context, className, size = 40 }: { context: SearchContext; className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className={className} {...COMMON}>
      {context === "self" && (
        <>
          <circle cx="20" cy="14" r="5.5" />
          <path d="M9 33c0-6.2 4.9-10 11-10s11 3.8 11 10" />
        </>
      )}
      {context === "child" && (
        <>
          <circle cx="20" cy="19" r="4.5" />
          <path d="M11.5 33c0-5.2 3.8-8.5 8.5-8.5s8.5 3.3 8.5 8.5" />
          <path d="M30 8l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4z" />
        </>
      )}
      {context === "adult" && (
        <>
          <circle cx="14" cy="14" r="4.5" />
          <path d="M5 32c0-5.4 4-8.6 9-8.6" />
          <circle cx="26" cy="14" r="4.5" />
          <path d="M17 32c0-5.4 4-8.6 9-8.6s9 3.2 9 8.6" />
        </>
      )}
      {context === "unknown" && (
        <>
          <circle cx="20" cy="20" r="13" strokeDasharray="3 4" />
          <path d="M16.5 16.5c0-2.2 1.6-3.8 3.5-3.8s3.5 1.5 3.5 3.5c0 2.8-3.5 3-3.5 6" />
          <circle cx="20" cy="27.2" r="0.9" />
        </>
      )}
      {context === "group" && (
        <>
          <circle cx="20" cy="12" r="4" />
          <circle cx="9" cy="17" r="3.4" />
          <circle cx="31" cy="17" r="3.4" />
          <path d="M12.5 33c0-4.8 3.4-8 7.5-8s7.5 3.2 7.5 8" />
          <path d="M2.5 31c0-3.8 2.7-6.2 6-6.2M37.5 31c0-3.8-2.7-6.2-6-6.2" />
        </>
      )}
    </svg>
  );
}
