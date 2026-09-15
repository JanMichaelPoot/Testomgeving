"use client";

import { useActionState } from "react";
import { loginAdmin } from "@/app/admin/actions";

export function AdminLoginForm() {
  const [error, formAction, isPending] = useActionState(loginAdmin, null);

  return (
    <form action={formAction} className="mt-6">
      <label className="block text-xs font-medium uppercase tracking-widest text-ink/50">
        Wachtwoord
      </label>
      <input
        type="password"
        name="password"
        required
        autoFocus
        className="mt-1.5 w-full rounded-xl border border-ink/15 bg-paper px-3.5 py-2.5 text-sm text-ink shadow-sm outline-none placeholder:text-ink/35 focus:border-accent"
      />

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-5 w-full rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-dark disabled:opacity-50"
      >
        {isPending ? "Bezig…" : "Inloggen"}
      </button>
    </form>
  );
}
