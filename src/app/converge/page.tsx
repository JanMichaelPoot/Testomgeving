import { SiteHeader } from "@/components/window/SiteHeader";

export const metadata = {
  title: "Make this real — WINDOW",
};

export default function ConvergePage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="font-serif text-3xl text-ink">Make this real</h1>
        <p className="mt-4 max-w-md text-ink/70">
          The convergence and payment screen (1–3 candidates, why they fit,
          and Stripe Checkout) is the next build block.
        </p>
      </main>
    </div>
  );
}
