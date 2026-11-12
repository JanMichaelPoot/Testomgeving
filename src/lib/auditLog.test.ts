import { describe, expect, it, vi } from "vitest";
import { recordAuditLogEntry } from "@/lib/auditLog";
import { ordererGeoFrom } from "@/lib/geo";
import type { StoredIntake } from "@/app/intake/actions";
import type { GeneratedIdeaBook } from "@/lib/claude/generateIdeaBook";

describe("the orderer's country and place", () => {
  it("reads any ISO country and the (percent-encoded) city, and never anything else", () => {
    expect(ordererGeoFrom("NL", "Den%20Haag")).toEqual({ country: "NL", city: "Den Haag" });
    expect(ordererGeoFrom("de", "K%C3%B6ln")).toEqual({ country: "DE", city: "Köln" });
    // A country the start page does not offer is still logged.
    expect(ordererGeoFrom("NZ", "Auckland")).toEqual({ country: "NZ", city: "Auckland" });
    expect(ordererGeoFrom("FR", undefined)).toEqual({ country: "FR", city: "" });
  });

  it("gives nothing without a real country code, and drops markup and long text from a city", () => {
    for (const bad of [null, undefined, "", "X", "NLD", "1A", "XX", "T1"]) expect(ordererGeoFrom(bad, "Utrecht"), String(bad)).toBeNull();
    expect(ordererGeoFrom("NL", "<b>Utrecht</b>\n")?.city).toBe("bUtrecht/b");
    expect(ordererGeoFrom("NL", "a".repeat(200))?.city).toHaveLength(80);
  });
});

const PROFILE = { locale: "nl", situation: "", purpose: "self", budget: "25" } as unknown as StoredIntake;
const BOOK = { profile_summary: "s", must_haves: [], preferences: [], ideas: [], wildcard: { title: "w" } } as unknown as GeneratedIdeaBook;

function client(results: ({ code?: string; message: string } | null)[]) {
  const inserted: Record<string, unknown>[] = [];
  const insert = vi.fn(async (row: Record<string, unknown>) => {
    inserted.push(row);
    return { error: results.shift() ?? null };
  });
  return { supabase: { from: () => ({ insert }) } as never, inserted };
}

describe("the audit log entry", () => {
  it("carries the country and place of the order, and still no session, user or e-mail", async () => {
    const { supabase, inserted } = client([null]);
    await recordAuditLogEntry(supabase, { profile: PROFILE, generated: BOOK, emailDelivered: true, orderer: { country: "NL", city: "Utrecht" } });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ orderer_country: "NL", orderer_city: "Utrecht", email_delivered: true });
    for (const k of ["session_id", "user_id", "email", "ip", "ip_address"]) expect(k in inserted[0], k).toBe(false);
  });

  it("writes an empty city as null, and no geo columns at all without a hint", async () => {
    const a = client([null]);
    await recordAuditLogEntry(a.supabase, { profile: PROFILE, generated: BOOK, emailDelivered: false, orderer: { country: "FR", city: "" } });
    expect(a.inserted[0]).toMatchObject({ orderer_country: "FR", orderer_city: null });
    const b = client([null]);
    await recordAuditLogEntry(b.supabase, { profile: PROFILE, generated: BOOK, emailDelivered: false, orderer: null });
    expect("orderer_country" in b.inserted[0]).toBe(false);
  });

  it("is still written, without the geo columns, when migration 0023 has not been run", async () => {
    const { supabase, inserted } = client([{ code: "PGRST204", message: "Could not find the 'orderer_country' column of 'audit_log' in the schema cache" }, null]);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await recordAuditLogEntry(supabase, { profile: PROFILE, generated: BOOK, emailDelivered: true, orderer: { country: "NL", city: "Utrecht" } });
    log.mockRestore();
    expect(inserted).toHaveLength(2);
    expect("orderer_country" in inserted[1]).toBe(false);
    expect(inserted[1]).toMatchObject({ email_delivered: true });
  });
});
