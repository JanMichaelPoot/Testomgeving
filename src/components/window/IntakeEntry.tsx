"use client";

import { useEffect, useState } from "react";
import { IntakeWizard } from "@/components/window/IntakeWizard";
import { AssociationWizard, type WizardPayment } from "@/components/window/AssociationWizard";
import type { AssociationLibrary } from "@/lib/discovery/associationProfile";
import type { CardLibrary } from "@/lib/discovery/cards";
import type { IntakeAnswers } from "@/app/intake/actions";
import { usesCardWizard } from "@/lib/checkoutChoices";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { associationWizardPercent } from "@/lib/vensterLanding";

type Variant = "legacy" | "cards" | "associations";

// v2: the v1 key held draws made while the card wizard was off (default 0), which would
// keep those tabs on the classic wizard now that everybody gets the card wizard.
// v3: v2 held draws made while the image intake was off (default 0), which would keep those
// tabs on the card wizard now that everybody gets the image intake.
const VARIANT_KEY = "window-wizard-variant-v3";

// Share of visitors who get the card wizard when nothing is configured.
const DEFAULT_CARD_WIZARD_PERCENT = 100;

// Which wizard this visitor gets, decided once per browser tab (sessionStorage, no
// cookie, same lifetime as the draft):
//   1. ?wizard=cards or ?wizard=legacy forces it (for testing and for sharing a link);
//   2. otherwise the choice already made in this tab;
//   3. otherwise a random draw with NEXT_PUBLIC_DISCOVERY_WIZARD_PERCENT % chance of
//      the card wizard. The default is 100 (everyone); set 0 to switch it off again.
// Rendering waits for the decision so the server and the first client render agree.
// The image intake ("Het venster") is a third variant: ?wizard=associations forces it, and
// NEXT_PUBLIC_ASSOCIATION_WIZARD_PERCENT (default 100, everybody; 0 switches it off) is the share
// of visitors who get it in a fresh draw, before the card/legacy draw below.
function associationPercent(): number {
  return associationWizardPercent(process.env.NEXT_PUBLIC_ASSOCIATION_WIZARD_PERCENT);
}

function decideVariant(): Variant {
  try {
    const forced = new URLSearchParams(window.location.search).get("wizard");
    if (forced === "cards" || forced === "legacy" || forced === "associations") {
      window.sessionStorage.setItem(VARIANT_KEY, forced);
      return forced;
    }
    const stored = window.sessionStorage.getItem(VARIANT_KEY);
    if (stored === "cards" || stored === "legacy" || stored === "associations") return stored;
  } catch {
    // Storage unavailable: fall through to a fresh draw that simply is not remembered.
  }
  if (Math.random() * 100 < associationPercent()) {
    try {
      window.sessionStorage.setItem(VARIANT_KEY, "associations");
    } catch {
      // Nothing to do.
    }
    return "associations";
  }
  const configured = process.env.NEXT_PUBLIC_DISCOVERY_WIZARD_PERCENT;
  const parsed = configured === undefined || configured.trim() === "" ? NaN : Number(configured);
  const percent = Number.isFinite(parsed) ? parsed : DEFAULT_CARD_WIZARD_PERCENT;
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
  vensterDict,
  library,
  associations,
  initial,
  purpose,
  payment,
}: {
  dict: Dictionary["intake"];
  vensterDict: Dictionary["venster"];
  library: CardLibrary;
  // Slim association data for the image intake (src/lib/discovery/associations.ts).
  associations: AssociationLibrary;
  // Changing choices before paying: the stored answers to start from (see IntakeWizard).
  initial?: { answers: IntakeAnswers; page: number };
  // From the landing page's gift button (?for=gift). Only the image intake uses it.
  purpose?: "self" | "gift";
  // What the image intake's last screen needs to take the payment (the older wizards still use /checkout).
  payment: WizardPayment;
}) {
  const [variant, setVariant] = useState<Variant | null>(null);

  useEffect(() => {
    // One-time read of sessionStorage / the URL, which only exists after mount.
    // Editing keeps the wizard the answers were given in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVariant(
      initial
        ? initial.answers.intakeVariant === "associations"
          ? "associations"
          : usesCardWizard(initial.answers)
            ? "cards"
            : "legacy"
        : decideVariant(),
    );
  }, [initial]);

  if (!variant) return <div className="min-h-[60vh] w-full max-w-5xl" aria-hidden="true" />;
  if (variant === "associations") {
    return (
      <AssociationWizard
        intakeDict={dict}
        dict={vensterDict}
        library={associations}
        domains={library.domains.map((d) => ({ id: d.id, label: d.label }))}
        initial={initial}
        initialPurpose={purpose}
        payment={payment}
      />
    );
  }
  return <IntakeWizard dict={dict} variant={variant} library={library} initial={initial} />;
}
