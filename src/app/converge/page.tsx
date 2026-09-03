import { redirect } from "next/navigation";
import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { selectCandidates } from "@/lib/claude/converge";
import { SiteHeader } from "@/components/window/SiteHeader";
import { ConvergeBoard, type Candidate } from "@/components/window/ConvergeBoard";

export const metadata = {
  title: "Make this real — WINDOW",
};

export default async function ConvergePage() {
  const sessionId = await getSessionId();
  if (!sessionId) redirect("/intake");

  const supabase = createServiceRoleClient();

  const { data: intake } = await supabase
    .from("intake_answers")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!intake) redirect("/intake");

  const { data: likedIdeas } = await supabase
    .from("ideas")
    .select("*")
    .eq("session_id", sessionId)
    .eq("status", "liked")
    .order("created_at", { ascending: true });

  if (!likedIdeas || likedIdeas.length === 0) redirect("/ideas");

  let candidates: Candidate[] = [];
  let selectionError: string | null = null;

  try {
    const selected = await selectCandidates(
      likedIdeas.map((idea) => ({
        id: idea.id,
        lens: idea.lens,
        title: idea.title,
        description: idea.description,
      })),
      {
        topic: intake.topic ?? "",
        time_available: intake.time_available ?? "",
        budget: intake.budget ?? "",
        desired_surprise: intake.desired_surprise ?? "",
        company: intake.company ?? "",
      }
    );

    candidates = selected.flatMap((s) => {
      const idea = likedIdeas.find((i) => i.id === s.idea_id);
      return idea
        ? [
            {
              idea_id: idea.id,
              lens: idea.lens,
              title: idea.title,
              description: idea.description,
              why_it_fits: s.why_it_fits,
            },
          ]
        : [];
    });
  } catch (err) {
    selectionError =
      err instanceof Error
        ? err.message
        : "Something went wrong while narrowing things down.";
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-10">
        <h1 className="font-serif text-3xl text-ink sm:text-4xl">
          Here&rsquo;s what fits
        </h1>
        <p className="mt-2 max-w-xl text-ink/60">
          Pick the one you want to turn into a real, doable plan.
        </p>

        <div className="mt-10">
          {selectionError || candidates.length === 0 ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
              <p className="text-ink/70">
                {selectionError ?? "Couldn't narrow things down."}
              </p>
              <a
                href="/converge"
                className="mt-4 inline-block text-sm font-medium text-accent-dark underline"
              >
                Try again
              </a>
            </div>
          ) : (
            <ConvergeBoard candidates={candidates} />
          )}
        </div>
      </main>
    </div>
  );
}
