import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { AdminLoginForm } from "./AdminLoginForm";

// Internal-only tool — never indexed, regardless of robots.ts.
export const metadata: Metadata = {
  title: "Admin — WINDOW",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin");

  return (
    <div className="flex min-h-full items-center justify-center bg-cream px-6 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-ink/10 bg-paper p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-widest text-accent-dark">
          WINDOW — admin
        </p>
        <h1 className="mt-2 font-serif text-2xl text-ink">Logboek</h1>
        <p className="mt-2 text-sm text-ink/60">
          Alleen voor intern gebruik — anonieme audit van intake- en Idea Book-gegevens.
        </p>
        <AdminLoginForm />
      </div>
    </div>
  );
}
