import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // Supabase renamed "anon key" to "publishable key" in 2025; some
    // Vercel/Supabase integration flows only set the new name. `||` (not
    // `??`) because a var that exists but was saved empty reads back as
    // "", which `??` would not treat as "unset".
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!
  );
}
