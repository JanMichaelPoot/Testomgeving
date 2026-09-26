"use client";

import { useEffect, useState } from "react";
import { IntakeWizard } from "@/components/window/IntakeWizard";
import type { CardLibrary } from "@/lib/discovery/cards";
import type { IntakeAnswers } from "@/app/intake/actions";
import { usesCardWizard } from "@/lib/checkoutChoices";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Variant = "legacy" | "cards";

const VARIANT_KEY = "window-wizard-variant-v1";

// Which wizard this visitor gets, decided once per browser tab (sessionStorage, no
// cookie, same lifetime as the draft):
//   1. ?wizard=cards or ?wizard=legacy forces it (for testing and for sharing a link);
//   2. otherwise the choice already made in this tab;
//   3. otherwise a random draw with NEXT_PUBLIC_DISCOVERY_WIZARD_PERCENT % chance of
//      the card wizard. The default is 0, so nobody sees it until it is switched on.
// Rendering waits for the decision so the server and the first client render agree.
function decideVariant(): Variant {
  try {
    const forced = new URLSearchParams(window.location.search).get("wizard");
    if (forced === "cards" || forced === "legacy") {
      window.sessionStorage.setItem(VARIANT_KEY, forced);
      return forced;
    }
    const stored = window.sessionStorage.getItem(VARIANT_KEY);
    if (stored === "cards" || stored === "legacy") return stored;
  } catch {
    // Storage unavailable: fall through to a fresh draw that simply is not remembered.
  }
  const percent = Number(process.env.NEXT_PUBLIC_DISCOVERY_WIZARD_PERCENT ?? 0);
  const drawn: Variant = Math.random() * 100 < percent ? "cards" : "legacy";
  try {
    window.sessionStorage.setItem(VARIANT_KEY, drawn);
  } catch {
    // Nothing to do.
  }
  return drawn;
}

export function IntakeEntry({
  dict,
  library,
  initial,
}: {
  dict: Dictionary["intake"];
  library: CardLibrary;
  // Changing choices before paying: the stored answers to start from (see IntakeWizard).
  initial?: { answers: IntakeAnswers; page: number };
}) {
  const [variant, setVariant] = useState<Variant | null>(null);

  useEffect(() => {
    // One-time read of sessionStorage / the URL, which only exists after mount.
    // Editing keeps the wizard the answers were given in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVariant(initial ? (usesCardWizard(initial.answers) ? "cards" : "legacy") : decideVariant());
  }, [initial]);

  if (!variant) return <div className="min-h-[60vh] w-full max-w-5xl" aria-hidden="true" />;
  return <IntakeWizard dict={dict} variant={variant} library={library} initial={initial} />;
}
