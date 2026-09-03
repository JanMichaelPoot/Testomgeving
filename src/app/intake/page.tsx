import { SiteHeader } from "@/components/window/SiteHeader";
import { IntakeWizard } from "@/components/window/IntakeWizard";

export const metadata = {
  title: "Open a Window — WINDOW",
};

export default function IntakePage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-start justify-center px-6 py-12 sm:px-10 sm:py-16">
        <IntakeWizard />
      </main>
    </div>
  );
}
