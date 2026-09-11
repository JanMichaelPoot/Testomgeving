"use client";

import { useEffect, useSyncExternalStore } from "react";
import { initPostHog } from "@/lib/posthog/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const CONSENT_KEY = "window_analytics_consent";
const CONSENT_EVENT = "window-consent-changed";

type Consent = "granted" | "denied" | null;

function subscribeToConsent(callback: () => void) {
  window.addEventListener(CONSENT_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CONSENT_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function readConsent(): Consent {
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    return stored === "granted" || stored === "denied" ? stored : null;
  } catch {
    // Storage can throw in locked-down browser contexts (private mode,
    // blocked site data) — treat that the same as no stored decision.
    return null;
  }
}

// The server (and the client's first hydration pass) can never know the
// real stored value, so both always report "no decision yet" — once
// hydrated, useSyncExternalStore re-reads readConsent() and reconciles any
// difference on its own, which is exactly what it's for.
function readServerConsent(): Consent {
  return null;
}

function setConsent(decision: "granted" | "denied") {
  try {
    window.localStorage.setItem(CONSENT_KEY, decision);
  } catch {
    // Best-effort — worst case the banner just asks again next visit.
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

// Nothing tracking-related runs before this component explicitly says so —
// initPostHog() is only ever called from here, either because a "granted"
// decision was already stored, or because the visitor just clicked accept.
export function ConsentBanner({ dict }: { dict: Dictionary["consent"] }) {
  const consent = useSyncExternalStore(subscribeToConsent, readConsent, readServerConsent);

  useEffect(() => {
    if (consent === "granted") initPostHog();
  }, [consent]);

  if (consent !== null) return null;

  return (
    <div className="animate-window-fade-in fixed inset-x-6 bottom-6 z-50 rounded-2xl border border-gold/30 bg-paper p-5 shadow-xl sm:inset-x-auto sm:right-6 sm:max-w-sm">
      <p className="text-sm leading-relaxed text-ink">{dict.message}</p>
      <div className="mt-4 flex shrink-0 gap-3">
        <button
          type="button"
          onClick={() => setConsent("granted")}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-dark"
        >
          {dict.accept}
        </button>
        <button
          type="button"
          onClick={() => setConsent("denied")}
          className="rounded-full px-4 py-2 text-sm font-medium text-ink/60 transition-colors hover:text-ink"
        >
          {dict.decline}
        </button>
      </div>
    </div>
  );
}
