import { Button } from "@/components/ui/Button";
import { PossibilityWindow } from "@/components/window/PossibilityWindow";
import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-12 sm:px-10">
        <div className="grid w-full items-center gap-16 lg:grid-cols-2">
          <div className="max-w-xl">
            <h1 className="font-serif text-5xl leading-[1.1] text-ink sm:text-6xl">
              A Window Into
              <br />
              What Could Be
            </h1>
            <p className="mt-6 text-lg text-ink/70">
              You don&rsquo;t need another answer. Sometimes you need to see
              another possibility.
            </p>
            <div className="mt-8">
              <Button href="/intake">Open a Window</Button>
            </div>
          </div>

          <div className="mx-auto w-full max-w-lg lg:max-w-none">
            <PossibilityWindow />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
