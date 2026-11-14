import { generateIdeaBookFromSeeds, shouldUseEngine } from "@/lib/claude/generateFromSeeds";
import { computeCharacterProfile } from "@/lib/characterProfile";
import { loadShownBefore } from "@/lib/discovery/historyStore";
import type { StoredIntake } from "@/app/intake/actions";
import type { createServiceRoleClient } from "@/lib/supabase/server";

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

// Warms the research cache while the buyer is still on Stripe's page. The slowest part that does not depend on the payment is the search for
// real places (selection, local and online search, replacement rounds: 15-40 seconds); the buyer needs 20-60 seconds to pay. Started from
// createCheckoutSession (after the order and consents are stored, never before), it runs the very same selection and the very same searches as the
// real generation will: same session as seed, same history, same answers, so every answer lands in the shared cache and the real generation reads
// it back in a moment. Nothing is written to the book, no text is generated, and a failure changes nothing: the real generation searches itself.
//
// Cost: one research pass (about $0.10) also for a buyer who then does not pay. That is the price of the faster book; switch it off with
// PREWARM_RESEARCH=0. A second start for the same session finds everything in the cache, so a repeated click costs next to nothing.
export function prewarmEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = (env.PREWARM_RESEARCH ?? "").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "off" && v !== "no";
}

export async function prewarmBookResearch(supabase: ServiceRoleClient, sessionId: string): Promise<{ started: boolean; ms?: number }> {
  if (!prewarmEnabled()) return { started: false };
  const startedAt = Date.now();
  try {
    const { data } = await supabase
      .from("intake_answers")
      .select("raw_json")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const profile = data?.raw_json as StoredIntake | undefined;
    // Only the book that uses the selection engine does grouped research; the classic pipeline researches inside its own call.
    if (!profile || !shouldUseEngine(profile)) return { started: false };
    // The same inputs as finishPlanGeneration (plan/data.ts): the history of this device and the ideas a follow-up e-mail asked to leave out.
    const history = [...new Set([...(await loadShownBefore(supabase, sessionId)), ...(profile.avoidActivityIds ?? [])])];
    const { report } = await generateIdeaBookFromSeeds(profile, profile.locale, computeCharacterProfile(profile), {
      sessionId,
      history,
      season: profile.season ?? null,
      researchOnly: true,
    });
    const ms = Date.now() - startedAt;
    // The cost of the warm-up is paid also for a buyer who does not pay (docs/kostenonderzoek-boekgeneratie.md §4.4). It has no book to be kept with yet,
    // so it is in the log in one stable line: "research warmed ... usd=0.123", to be summed against the number of paid books.
    const usd = report?.cost?.usd;
    console.log(`WindowInto: research warmed for the payment in ${ms}ms${typeof usd === "number" ? `, usd=${usd.toFixed(3)} ${JSON.stringify(report.cost?.breakdown ?? {})}` : ""}`);
    return { started: true, ms };
  } catch (err) {
    // Never a reason to block or fail a payment.
    console.warn("WindowInto: could not warm the research (the real generation will search itself):", err instanceof Error ? err.message : err);
    return { started: false };
  }
}
