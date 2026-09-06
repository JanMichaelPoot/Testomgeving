"use client";

import { useEffect } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/posthog/client";

// The other half of the Fase A referral measurement: a view here plus a
// share click on /plan is the whole funnel this phase cares about — no
// discount, no incentive, just finding out whether sharing happens at all.
export function SharedPageView({ planId }: { planId: string }) {
  useEffect(() => {
    trackEvent("shared_idea_book_viewed", { planId });
  }, [planId]);

  return null;
}

export function SharedCtaLink({
  href,
  planId,
  className,
  children,
}: {
  href: string;
  planId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() => trackEvent("shared_idea_book_cta_clicked", { planId })}
      className={className}
    >
      {children}
    </Link>
  );
}
