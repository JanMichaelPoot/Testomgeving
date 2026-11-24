"use client";

import { useEffect } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/posthog/client";

// The measurements of a shared idea (Step 242): a friend opened the card's page, and a friend pressed "make your own".
export function SharedIdeaView({ planId, ideaKey }: { planId: string; ideaKey: string }) {
  useEffect(() => {
    trackEvent("shared_idea_viewed", { planId, ideaKey });
  }, [planId, ideaKey]);
  return null;
}

export function SharedIdeaCta({ href, planId, ideaKey, className, children }: { href: string; planId: string; ideaKey: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={() => trackEvent("shared_idea_cta_clicked", { planId, ideaKey })} className={className}>
      {children}
    </Link>
  );
}
