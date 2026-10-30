import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { SUPABASE_SERVICE_ROLE_KEY } from "@/lib/supabase/env";

// The links in the follow-up e-mail carry the id of the book and a signature, so nobody can open or unsubscribe someone else's by guessing an
// id, and the link needs no login. One signature per purpose ("open" and "unsub"), so a token for one cannot be used for the other.

export type FollowUpPurpose = "open" | "unsub";

function secret(): string {
  const explicit = (process.env.IP_HASH_SECRET ?? "").trim();
  if (explicit) return explicit;
  // No separate secret set: derive one from a key only the server has.
  return createHash("sha256").update(`window-followup:${SUPABASE_SERVICE_ROLE_KEY ?? ""}`).digest("hex");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sign(purpose: FollowUpPurpose, planId: string, key: string): string {
  return createHmac("sha256", key).update(`${purpose}:${planId.toLowerCase()}`).digest("base64url").slice(0, 32);
}

/** `<plan id>.<signature>` for one purpose. */
export function makeFollowUpToken(purpose: FollowUpPurpose, planId: string, key: string = secret()): string {
  return `${planId.toLowerCase()}.${sign(purpose, planId, key)}`;
}

/** The plan id inside a token, if (and only if) the signature is right for that purpose. */
export function readFollowUpToken(purpose: FollowUpPurpose, token: string | null | undefined, key: string = secret()): string | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const planId = token.slice(0, dot);
  const given = token.slice(dot + 1);
  if (!UUID.test(planId)) return null;
  const expected = sign(purpose, planId, key);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? planId.toLowerCase() : null;
}
