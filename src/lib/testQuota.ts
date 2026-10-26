import { createHmac, createHash } from "node:crypto";
import { SUPABASE_SERVICE_ROLE_KEY } from "@/lib/supabase/env";
import { headers } from "next/headers";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Test phase: a limited number of books per IP address, so a link passed around on WhatsApp cannot run up the bill.
//   - TEST_MAX_BOOKS_PER_IP (e.g. "2") switches it on; unset or 0 = no limit (the real launch).
//   - The owner (logged in to /admin in this browser) is never limited.
//   - Only a keyed hash of the address is stored, in test_quota (migration 0021).
//   - What counts is a started book (pending or ready). A book that failed does not count against the person.
//   - Without a readable address (local development) nothing is limited; if the table is missing, nothing is limited
//     either (a missing migration must not take the site down), and the problem is logged.

type Supabase = ReturnType<typeof createServiceRoleClient>;

export function parseLimit(raw: string | undefined): number | null {
  const n = Number((raw ?? "").trim().replace(/^"|"$/g, ""));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** The first address of an x-forwarded-for chain (the visitor; later ones are our own proxies). */
export function firstIp(forwardedFor: string | null | undefined, realIp?: string | null): string | null {
  const first = (forwardedFor ?? "").split(",")[0]?.trim();
  const ip = first || (realIp ?? "").trim();
  return ip ? ip : null;
}

export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip.trim().toLowerCase()).digest("hex").slice(0, 40);
}

export interface QuotaDecision {
  allowed: boolean;
  used: number;
  limit: number | null;
  ipHash: string | null;
  owner: boolean;
}

/** Pure part of the decision. */
export function decide(input: { limit: number | null; used: number; owner: boolean; ipHash: string | null; sessionAlreadyCounted: boolean }): QuotaDecision {
  const { limit, used, owner, ipHash, sessionAlreadyCounted } = input;
  const unlimited = limit === null || owner || ipHash === null;
  return { allowed: unlimited || sessionAlreadyCounted || used < limit, used, limit, ipHash, owner };
}

function secret(): string {
  const explicit = (process.env.IP_HASH_SECRET ?? "").trim();
  if (explicit) return explicit;
  // No separate secret set: derive one from a key only the server has, so the hash still cannot be reversed by a guess.
  return createHash("sha256").update(`window-ip:${SUPABASE_SERVICE_ROLE_KEY ?? ""}`).digest("hex");
}

async function requestIpHash(): Promise<string | null> {
  const h = await headers();
  const ip = firstIp(h.get("x-forwarded-for"), h.get("x-real-ip"));
  return ip ? hashIp(ip, secret()) : null;
}

/** How many books this address has started that still count (pending or ready), and whether this session is one of them. */
async function usage(supabase: Supabase, ipHash: string, sessionId: string | null): Promise<{ used: number; counted: boolean }> {
  const { data, error } = await supabase.from("test_quota").select("session_id").eq("ip_hash", ipHash).limit(1000);
  if (error) throw error;
  const sessions = (data ?? []).map((r) => r.session_id);
  if (sessions.length === 0) return { used: 0, counted: false };
  let used = 0;
  for (let i = 0; i < sessions.length; i += 100) {
    const { count, error: planError } = await supabase
      .from("window_plans")
      .select("id", { count: "exact", head: true })
      .in("session_id", sessions.slice(i, i + 100))
      .in("status", ["pending", "ready"]);
    if (planError) throw planError;
    used += count ?? 0;
  }
  return { used, counted: sessionId !== null && sessions.includes(sessionId) };
}

/** May this visitor (this address, this session) start another book? Reads only. Fails open on a missing table. */
export async function checkTestQuota(supabase: Supabase, sessionId: string | null): Promise<QuotaDecision> {
  const limit = parseLimit(process.env.TEST_MAX_BOOKS_PER_IP);
  if (limit === null) return decide({ limit, used: 0, owner: false, ipHash: null, sessionAlreadyCounted: false });
  const owner = await isAdminAuthenticated();
  if (owner) return decide({ limit, used: 0, owner, ipHash: null, sessionAlreadyCounted: false });
  const ipHash = await requestIpHash();
  if (!ipHash) return decide({ limit, used: 0, owner, ipHash, sessionAlreadyCounted: false });
  try {
    const { used, counted } = await usage(supabase, ipHash, sessionId);
    return decide({ limit, used, owner, ipHash, sessionAlreadyCounted: counted });
  } catch (err) {
    console.error("WINDOW: could not check the test limit (run migration 0021?); not limiting:", err);
    return decide({ limit, used: 0, owner, ipHash: null, sessionAlreadyCounted: false });
  }
}

/** Remember that this session's book was started from this address. Best effort. */
export async function recordTestBook(supabase: Supabase, ipHash: string | null, sessionId: string): Promise<void> {
  if (!ipHash) return;
  const { error } = await supabase.from("test_quota").upsert({ session_id: sessionId, ip_hash: ipHash }, { onConflict: "session_id", ignoreDuplicates: true });
  if (error) console.error("WINDOW: could not record the test book (run migration 0021?):", error.message);
}

/** For the admin: how many distinct addresses took part, and how many are at the limit. */
export async function quotaOverview(supabase: Supabase): Promise<{ limit: number | null; addresses: number; atLimit: number; books: number } | null> {
  const limit = parseLimit(process.env.TEST_MAX_BOOKS_PER_IP);
  const { data, error } = await supabase.from("test_quota").select("ip_hash").limit(5000);
  if (error) return null;
  const perIp = new Map<string, number>();
  for (const r of data ?? []) perIp.set(r.ip_hash, (perIp.get(r.ip_hash) ?? 0) + 1);
  return { limit, addresses: perIp.size, atLimit: limit ? [...perIp.values()].filter((n) => n >= limit).length : 0, books: (data ?? []).length };
}
