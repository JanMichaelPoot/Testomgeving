import { cookies } from "next/headers";

// A session identifies one pass through the OPEN -> PLAN loop before any
// login exists. Kept separate from users.email so intake answers and ideas
// stay decoupled from directly identifiable data (see supabase/migrations
// /0001_init.sql).
export const SESSION_COOKIE_NAME = "window_session_id";

export async function getSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}
