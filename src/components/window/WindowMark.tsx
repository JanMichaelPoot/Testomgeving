export function WindowMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="28" height="28" rx="4" stroke="currentColor" strokeWidth="2.25" />
      <path d="M16 2v28M2 16h28" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="4" width="10" height="10" rx="1" fill="currentColor" opacity="0.12" />
      <rect x="18" y="4" width="10" height="10" rx="1" fill="currentColor" opacity="0.06" />
      <rect x="4" y="18" width="10" height="10" rx="1" fill="currentColor" opacity="0.06" />
      <rect x="18" y="18" width="10" height="10" rx="1" fill="currentColor" opacity="0.12" />
    </svg>
  );
}
