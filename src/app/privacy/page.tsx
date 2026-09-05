import { SiteHeader } from "@/components/window/SiteHeader";
import { SiteFooter } from "@/components/window/SiteFooter";

export const metadata = {
  title: "Privacy Policy — WINDOW",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="font-serif text-3xl text-ink">Privacy Policy</h1>
        <p className="mt-6 rounded-lg border border-dashed border-ink/30 bg-paper px-4 py-3 text-sm text-ink/70">
          Placeholder — this page does not yet contain a reviewed privacy
          policy. Final copy to follow before public launch.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
