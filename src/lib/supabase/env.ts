// Server-only env var resolution for Supabase credentials. Never import
// this from src/lib/supabase/client.ts (the browser client): Next.js only
// inlines literal NEXT_PUBLIC_-prefixed `process.env.X` references into
// the client bundle at build time, so a fallback to a non-prefixed name
// (e.g. SUPABASE_URL) would silently resolve to undefined in the browser
// no matter how this logic is written. middleware.ts and server.ts run
// server/edge-side only, where every env var is readable regardless of
// prefix, so the extra fallbacks here are safe.
//
// `||` (not `??`) is deliberate: a Vercel env var that exists but was
// saved with an empty value reads back as `""`, which `??` would not
// treat as "unset".

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find((value) => value && value.length > 0);
}

// Supabase's Vercel integration (as of 2025) creates a bare SUPABASE_URL
// rather than the NEXT_PUBLIC_-prefixed name our code needs; falling back
// to it here covers that gap for server-only code.
export const SUPABASE_URL = firstNonEmpty(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_URL
);

// Supabase renamed "anon key" to "publishable key" in 2025; some
// integration flows only set the new name.
export const SUPABASE_ANON_KEY = firstNonEmpty(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  process.env.SUPABASE_PUBLISHABLE_KEY
);

// Supabase renamed "service_role key" to "secret key" in 2025; some
// integration flows only set the new name.
export const SUPABASE_SERVICE_ROLE_KEY = firstNonEmpty(
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.SUPABASE_SECRET_KEY
);
