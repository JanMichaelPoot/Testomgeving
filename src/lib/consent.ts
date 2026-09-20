import { createHash } from "crypto";
import type { createServiceRoleClient } from "@/lib/supabase/server";

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

// A sha-256 of the exact, locale-specific checkbox label shown at the
// moment of consent — stored alongside the version number so the actual
// wording behind a given version stays independently verifiable even if
// that version's dictionary copy is later edited by mistake (see
// src/lib/legal/versions.ts).
export function hashConsentText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// Both writes below only ever record `true` — if either checkbox isn't
// checked, src/app/checkout/actions.ts rejects the request server-side
// before any row is written, so a terms_acceptance/digital_delivery_consent
// row's mere existence already means "accepted". This keeps the two tables
// simple append-only evidence logs rather than something that needs to
// represent a declined state.

export async function recordTermsAcceptance(
  supabase: ServiceRoleClient,
  params: { orderId: string; termsVersion: string; consentText: string }
): Promise<void> {
  const { error } = await supabase.from("terms_acceptance").insert({
    order_id: params.orderId,
    accepted: true,
    terms_version: params.termsVersion,
    consent_text_hash: hashConsentText(params.consentText),
  });

  if (error) {
    throw new Error(`Could not record terms acceptance: ${error.message}`);
  }
}

export async function recordDigitalDeliveryConsent(
  supabase: ServiceRoleClient,
  params: {
    orderId: string;
    consentVersion: string;
    withdrawalAcknowledgedVersion: string;
    consentText: string;
    ipAddress: string | null;
    userAgent: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from("digital_delivery_consent").insert({
    order_id: params.orderId,
    consent: true,
    consent_version: params.consentVersion,
    withdrawal_acknowledged: true,
    withdrawal_acknowledged_version: params.withdrawalAcknowledgedVersion,
    consent_text_hash: hashConsentText(params.consentText),
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
  });

  if (error) {
    throw new Error(
      `Could not record digital delivery consent: ${error.message}`
    );
  }
}
