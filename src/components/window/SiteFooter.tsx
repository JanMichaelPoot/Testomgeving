import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function SiteFooter({ dict }: { dict: Dictionary["footer"] }) {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-6 py-8 text-xs text-ink/50 sm:flex-row sm:justify-between sm:px-10">
      <span>&copy; {new Date().getFullYear()} WINDOW</span>
      <div className="flex gap-4">
        <Link href="/privacy" className="hover:text-ink">
          {dict.privacy}
        </Link>
        <Link href="/terms" className="hover:text-ink">
          {dict.terms}
        </Link>
      </div>
    </footer>
  );
}
