import { SiteHeader } from "@/components/window/SiteHeader";

export const metadata = {
  title: "Your Window Plan — WINDOW",
};

export default async function PlanPage(props: PageProps<"/plan">) {
  await props.searchParams;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="font-serif text-3xl text-ink">
          Payment received
        </h1>
        <p className="mt-4 max-w-md text-ink/70">
          Generating your personalized Window Plan — concrete steps, a first
          action, and a PDF/email copy — is the next build block.
        </p>
      </main>
    </div>
  );
}
