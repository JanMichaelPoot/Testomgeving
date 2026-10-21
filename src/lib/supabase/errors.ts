// Whether a Supabase/PostgREST error means "a column I wrote does not exist (yet)", i.e. a migration
// has not been run. Two shapes exist: Postgres itself says 42703 (undefined_column), but PostgREST
// answers a write that names an unknown column with PGRST204 ("Could not find the 'x' column of 'y'
// in the schema cache") before it ever reaches Postgres. Code that falls back to an older shape of a
// row when a migration is missing has to recognise both, or the fallback never runs.
export function isMissingColumnError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /could not find the '[^']+' column/i.test(error.message ?? "");
}
