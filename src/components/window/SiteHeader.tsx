import Link from "next/link";
import { WindowMark } from "./WindowMark";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center px-6 py-6 sm:px-10">
      <Link
        href="/"
        className="flex items-center gap-2 text-accent-dark"
      >
        <WindowMark className="h-6 w-6" />
        <span className="font-sans text-sm font-semibold tracking-[0.2em] text-ink">
          WINDOW
        </span>
      </Link>
    </header>
  );
}
