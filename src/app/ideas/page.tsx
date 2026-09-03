import { SiteHeader } from "@/components/window/SiteHeader";

export const metadata = {
  title: "Your possibilities — WINDOW",
};

export default function IdeasPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="font-serif text-3xl text-ink">Your possibilities</h1>
        <p className="mt-4 max-w-md text-ink/70">
          The ideas screen (8–12 cards to like, skip, or reshape) is the next
          build block.
        </p>
      </main>
    </div>
  );
}
