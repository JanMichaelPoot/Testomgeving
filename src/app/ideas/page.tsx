import { redirect } from "next/navigation";
import { getSessionId } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generatePossibilities } from "@/lib/claude/ideas";
import { SiteHeader } from "@/components/window/SiteHeader";
import { IdeasBoard } from "@/components/window/IdeasBoard";

export const metadata = {
  title: "Your possibilities — WINDOW",
};

export default async function IdeasPage() {
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

  const { data: existingIdeas } = await supabase
    .from("ideas")
    .select("*")
    .eq("session_id", sessionId)
    .neq("status", "skipped")
    .order("created_at", { ascending: true });

  let ideas = existingIdeas ?? [];
  let generationError: string | null = null;

  if (ideas.length === 0) {
    try {
      const generated = await generatePossibilities({
        topic: intake.topic ?? "",
        time_available: intake.time_available ?? "",
        budget: intake.budget ?? "",
        desired_surprise: intake.desired_surprise ?? "",
        company: intake.company ?? "",
      });

      const { data: inserted, error } = await supabase
        .from("ideas")
        .insert(
          generated.map((idea) => ({
            session_id: sessionId,
            lens: idea.lens,
            title: idea.title,
            description: idea.description,
          }))
        )
        .select("*");

      if (error) throw error;
      ideas = inserted ?? [];
    } catch (err) {
      // Don't leak internal error details (API keys, stack traces) to the
      // user — log server-side and show a safe generic message instead.
      console.error("Failed to generate ideas:", err);
      generationError = "Something went wrong while opening your window.";
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-10">
        <h1 className="font-serif text-3xl text-ink sm:text-4xl">
          A few different windows
        </h1>
        <p className="mt-2 max-w-xl text-ink/60">
          Like what catches your eye, skip what doesn&rsquo;t, and reshape
          anything that&rsquo;s close but not quite right.
        </p>

        <div className="mt-10">
          {generationError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
              <p className="text-ink/70">{generationError}</p>
              <a
                href="/ideas"
                className="mt-4 inline-block text-sm font-medium text-accent-dark underline"
              >
                Try again
              </a>
            </div>
          ) : (
            <IdeasBoard initialIdeas={ideas} />
          )}
        </div>
      </main>
    </div>
  );
}
