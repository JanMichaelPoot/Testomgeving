import { cookies } from "next/headers";
import type { createServiceRoleClient } from "@/lib/supabase/server";
import {
  DEVICE_COOKIE_NAME,
  HISTORY_MONTHS,
  hashDeviceId,
  historyCutoff,
  isValidDeviceId,
  newDeviceId,
  recentlyShown,
} from "@/lib/discovery/history";

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

// Database and cookie side of the optional repetition memory (see history.ts).
// Every function is best effort: the memory is a nicety, so a missing table (migration
// 0015 not run yet) or a failing query must never get in the way of a paid book.

let warned = false;
function warn(what: string, message: string) {
  if (warned) return;
  warned = true;
  console.warn(`WINDOW: discovery history ${what} failed (${message}); continuing without it. Has migration 0015 been run?`);
}

/** The device id from the cookie, or null when the visitor has not opted in. */
export async function getDeviceId(): Promise<string | null> {
  const value = (await cookies()).get(DEVICE_COOKIE_NAME)?.value;
  return isValidDeviceId(value) ? value : null;
}

/**
 * The visitor opted in: make sure there is a device id (cookie, 12 months) and tie
 * this session to it. The row is created now, at checkout, because the book is
 * generated later without access to the visitor's cookies.
 */
export async function enableDeviceMemory(supabase: ServiceRoleClient, sessionId: string): Promise<void> {
  try {
    let id = await getDeviceId();
    if (!id) {
      id = newDeviceId();
      (await cookies()).set(DEVICE_COOKIE_NAME, id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30 * HISTORY_MONTHS,
        path: "/",
      });
    }
    const { error } = await supabase
      .from("discovery_history")
      .upsert({ session_id: sessionId, device_hash: hashDeviceId(id) }, { onConflict: "session_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  } catch (err) {
    warn("opt-in", err instanceof Error ? err.message : String(err));
  }
}

/** Opt out / "forget this device": delete everything stored for it and the cookie itself. */
export async function disableDeviceMemory(supabase: ServiceRoleClient): Promise<void> {
  const id = await getDeviceId();
  if (!id) return;
  try {
    const { error } = await supabase.from("discovery_history").delete().eq("device_hash", hashDeviceId(id));
    if (error) throw new Error(error.message);
  } catch (err) {
    warn("delete", err instanceof Error ? err.message : String(err));
  }
  (await cookies()).delete(DEVICE_COOKIE_NAME);
}

/** What the previous books of this session's device showed; empty when it has no memory. */
export async function loadShownBefore(supabase: ServiceRoleClient, sessionId: string): Promise<string[]> {
  try {
    const { data: own, error: ownError } = await supabase
      .from("discovery_history")
      .select("device_hash")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (ownError) throw new Error(ownError.message);
    if (!own) return [];

    const { data, error } = await supabase
      .from("discovery_history")
      .select("activity_ids, created_at")
      .eq("device_hash", own.device_hash)
      .neq("session_id", sessionId)
      .gt("created_at", historyCutoff())
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return recentlyShown(data ?? []);
  } catch (err) {
    warn("read", err instanceof Error ? err.message : String(err));
    return [];
  }
}

/** After a book was generated: remember which activities it showed (only if the device opted in). */
export async function recordShown(supabase: ServiceRoleClient, sessionId: string, activityIds: readonly string[]): Promise<void> {
  if (activityIds.length === 0) return;
  try {
    const { error } = await supabase
      .from("discovery_history")
      .update({ activity_ids: [...new Set(activityIds)] })
      .eq("session_id", sessionId);
    if (error) throw new Error(error.message);
    // Retention: expired rows go whenever a row is written, so no separate job is needed.
    await supabase.from("discovery_history").delete().lt("created_at", historyCutoff());
  } catch (err) {
    warn("write", err instanceof Error ? err.message : String(err));
  }
}
