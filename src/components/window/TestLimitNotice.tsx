import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// Shown instead of the intake, the checkout or the book when the test limit for this connection is reached.
export function TestLimitNotice({ copy }: { copy: Dictionary["venster"]["testLimit"] }) {
  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-6 py-20 text-center" role="status">
      <h1 className="font-serif text-3xl text-ink">{copy.title}</h1>
      <p className="mt-4 text-ink/70">{copy.body}</p>
      <Link href="/" className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-accent-dark px-6 font-semibold text-paper hover:shadow-md">
        {copy.back}
      </Link>
    </div>
  );
}
