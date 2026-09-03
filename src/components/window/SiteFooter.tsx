import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-6 py-8 text-xs text-ink/50 sm:flex-row sm:justify-between sm:px-10">
      <span>&copy; {new Date().getFullYear()} WINDOW</span>
      <div className="flex gap-4">
        <Link href="/privacy" className="hover:text-ink">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-ink">
          Terms
        </Link>
      </div>
    </footer>
  );
}
