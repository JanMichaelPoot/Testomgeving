import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { secret } from "@/lib/followup/token";

// "No more check-in mails" (Step 243). What is stored is a salted hash of the address, never the address: enough to recognise the same person on a next
// book, not enough to read it back. Server only (node:crypto).

/** The same address in any capitalisation or with stray spaces gives the same hash. */
export function emailHash(email: string, key: string = secret()): string {
  return createHmac("sha256", key).update(`mail-optout:${email.trim().toLowerCase()}`).digest("hex");
}

/** Whether this address has opted out. A failed read counts as "not opted out" being unknown: the caller decides (the cron does not send when it cannot tell). */
export async function isOptedOut(supabase: SupabaseClient, email: string): Promise<boolean | null> {
  const { data, error } = await supabase.from("mail_optouts").select("email_hash").eq("email_hash", emailHash(email)).maybeSingle();
  if (error) return null;
  return !!data;
}

export async function recordOptOut(supabase: SupabaseClient, email: string): Promise<boolean> {
  const { error } = await supabase.from("mail_optouts").upsert({ email_hash: emailHash(email) }, { onConflict: "email_hash" });
  return !error;
}
