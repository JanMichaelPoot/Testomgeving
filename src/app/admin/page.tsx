import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AdminLogTable, type AdminLogRow } from "./AdminLogTable";
import { logoutAdmin } from "./actions";

export const metadata: Metadata = {
  title: "Logboek — WINDOW admin",
  robots: { index: false, follow: false },
};

// A live in-page table beyond a few hundred rows gets sluggish for no real
// benefit — the .xlsx export (src/app/api/admin/audit-log/export) always
// pulls the full table regardless of this cap, so nothing is ever only
// visible here and not in the export.
const MAX_ROWS = 500;

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  const rows: AdminLogRow[] = (data ?? []).map((row) => {
    const input = (row.input_json ?? {}) as Record<string, unknown>;
    const wildcard = row.output_wildcard_json as Record<string, unknown> | null;

    return {
      id: row.id,
      createdAt: row.created_at,
      locale: row.locale,
      situation: typeof input.situation === "string" ? input.situation : "",
      purpose: typeof input.purpose === "string" ? input.purpose : "",
      budget: typeof input.budget === "string" ? input.budget : "",
      ideaCount: Array.isArray(row.output_ideas_json) ? row.output_ideas_json.length : 0,
      wildcardTitle:
        wildcard && typeof wildcard.title === "string" ? wildcard.title : "",
      emailDelivered: row.email_delivered,
    };
  });

  return (
    <div className="min-h-full bg-cream px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/10 pb-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
              WINDOW — admin
            </p>
            <h1 className="mt-1 font-serif text-2xl text-ink">Logboek</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink/60">
              Anonieme registratie van elke gegenereerde Idea Book — input- en
              outputgegevens, zonder e-mailadres of koppeling naar een sessie of
              persoon.
              {rows.length === MAX_ROWS &&
                ` Toont de meest recente ${MAX_ROWS} rijen — de .xlsx-download bevat het volledige logboek.`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/admin/audit-log/export"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-dark"
            >
              Download .xlsx
            </a>
            <form action={logoutAdmin}>
              <button type="submit" className="text-sm font-medium text-ink/50 hover:text-ink">
                Uitloggen
              </button>
            </form>
          </div>
        </div>

        {error && (
          <p className="mt-6 text-sm text-red-600">
            Kon het logboek niet laden: {error.message}
          </p>
        )}

        <AdminLogTable rows={rows} />
      </div>
    </div>
  );
}
