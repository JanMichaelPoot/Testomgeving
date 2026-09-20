import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import {
  hashConsentText,
  recordTermsAcceptance,
  recordDigitalDeliveryConsent,
} from "./consent";

// Minimal stand-in for the Supabase service-role client's
// `.from(table).insert(row)` shape — enough to assert what gets written,
// without a real database. `insertMock` lets each test inspect the exact
// row that was about to be persisted.
function fakeSupabase(insertMock: (table: string, row: unknown) => { error: null | { message: string } }) {
  return {
    from: (table: string) => ({
      insert: (row: unknown) => Promise.resolve(insertMock(table, row)),
    }),
  } as never;
}

describe("hashConsentText", () => {
  it("is a deterministic sha-256 hex digest of the exact text", () => {
    const text = "Ik ga akkoord met de Algemene Voorwaarden.";
    expect(hashConsentText(text)).toBe(
      createHash("sha256").update(text, "utf8").digest("hex")
    );
  });

  it("changes if a single character of the consent text changes", () => {
    // The whole point of storing this hash is to catch exactly this: a
    // dictionary edit that silently changes what a past customer actually
    // agreed to. Even a one-character difference must produce a
    // different, independently-verifiable hash.
    const a = hashConsentText("Ik ga akkoord.");
    const b = hashConsentText("Ik ga akkoord!");
    expect(a).not.toBe(b);
  });
});

describe("recordTermsAcceptance", () => {
  it("writes an insert-only row with accepted always true", async () => {
    let captured: { table: string; row: unknown } | null = null;
    const supabase = fakeSupabase((table, row) => {
      captured = { table, row };
      return { error: null };
    });

    await recordTermsAcceptance(supabase, {
      orderId: "order-1",
      termsVersion: "v1.0",
      consentText: "Ik ga akkoord met de Algemene Voorwaarden.",
    });

    expect(captured).not.toBeNull();
    expect(captured!.table).toBe("terms_acceptance");
    expect(captured!.row).toMatchObject({
      order_id: "order-1",
      accepted: true,
      terms_version: "v1.0",
      consent_text_hash: hashConsentText("Ik ga akkoord met de Algemene Voorwaarden."),
    });
  });

  it("throws when the database reports an error, instead of swallowing it", async () => {
    const supabase = fakeSupabase(() => ({ error: { message: "constraint violated" } }));

    await expect(
      recordTermsAcceptance(supabase, {
        orderId: "order-1",
        termsVersion: "v1.0",
        consentText: "text",
      })
    ).rejects.toThrow(/constraint violated/);
  });
});

describe("recordDigitalDeliveryConsent", () => {
  it("writes consent and the withdrawal acknowledgement as one combined, always-true row", async () => {
    let captured: unknown = null;
    const supabase = fakeSupabase((_table, row) => {
      captured = row;
      return { error: null };
    });

    await recordDigitalDeliveryConsent(supabase, {
      orderId: "order-1",
      consentVersion: "v1.0",
      withdrawalAcknowledgedVersion: "v1.0",
      consentText: "Ik verzoek WindowInto om mijn digitale product direct te leveren.",
      ipAddress: "203.0.113.5",
      userAgent: "Mozilla/5.0 (test)",
    });

    expect(captured).toMatchObject({
      order_id: "order-1",
      consent: true,
      consent_version: "v1.0",
      withdrawal_acknowledged: true,
      withdrawal_acknowledged_version: "v1.0",
      ip_address: "203.0.113.5",
      user_agent: "Mozilla/5.0 (test)",
    });
  });

  it("still records a row when IP/user-agent could not be determined", async () => {
    let captured: unknown = null;
    const supabase = fakeSupabase((_table, row) => {
      captured = row;
      return { error: null };
    });

    await recordDigitalDeliveryConsent(supabase, {
      orderId: "order-2",
      consentVersion: "v1.0",
      withdrawalAcknowledgedVersion: "v1.0",
      consentText: "text",
      ipAddress: null,
      userAgent: null,
    });

    expect(captured).toMatchObject({ ip_address: null, user_agent: null });
  });
});
