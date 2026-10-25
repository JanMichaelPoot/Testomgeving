"use server";

import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { CONFIRM_WORD, parseScope, runCleanup } from "@/lib/adminCleanup";

// Deletes test data. Everything is checked here again: the login, the word VERWIJDER and the scope; the
// selection of rows is made from the scope on the server, never taken from the form.
export async function cleanupAction(formData: FormData): Promise<void> {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const scope = parseScope({ get: (name) => (formData.get(name) === null ? null : String(formData.get(name))) });
  if (!scope) redirect("/admin/opruimen?error=scope");
  if (String(formData.get("confirm") ?? "").trim() !== CONFIRM_WORD) {
    const back = new URLSearchParams({ before: scope.before, preview: "1", error: "confirm" });
    for (const k of ["books", "unfinished", "feedback", "log"] as const) if (scope[k]) back.set(k, "1");
    redirect(`/admin/opruimen?${back.toString()}`);
  }

  let done: URLSearchParams;
  try {
    const counts = await runCleanup(createServiceRoleClient(), scope);
    done = new URLSearchParams({ done: "1", before: scope.before, ...Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, String(v)])) });
  } catch (err) {
    console.error("WINDOW admin cleanup failed:", err);
    redirect(`/admin/opruimen?error=failed&message=${encodeURIComponent(err instanceof Error ? err.message.slice(0, 200) : "onbekend")}`);
  }
  redirect(`/admin/opruimen?${done.toString()}`);
}
