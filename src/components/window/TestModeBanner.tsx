// A slim notice for the test preview (NEXT_PUBLIC_TEST_FEEDBACK=1) that tells testers which Stripe test card to use
// ("Het venster", fase 8): they go through the real Stripe test checkout. There is no way to skip the payment any more
// (removed 30 Oct 2026): the bypass produced a free book for anyone who found it. Renders nothing without a notice.
export function TestModeBanner({ notice }: { notice?: string }) {
  if (!notice) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs sm:px-10">
      <span className="font-medium text-amber-800">{notice}</span>
    </div>
  );
}
