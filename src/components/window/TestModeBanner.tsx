// A quiet line for the test preview (Stripe in test mode) that says WindowInto is a test version, free to use for now, and which Stripe test card to pay with
// ("Het venster", fase 8). It was a yellow bar until 15 Nov 2026; now it is plain, muted text. There is no way to skip the payment (removed 30 Oct 2026):
// the bypass produced a free book for anyone who found it. Renders nothing without a notice.
export function TestModeBanner({ notice, className = "" }: { notice?: string; className?: string }) {
  if (!notice) return null;
  return (
    <p data-testid="test-notice" className={`text-xs leading-relaxed text-ink/60 ${className}`}>
      {notice}
    </p>
  );
}
