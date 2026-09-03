export function WindowMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
