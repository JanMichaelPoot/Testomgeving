import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests only (no jsdom/browser env, no Next.js runtime) — these cover
// pure logic and server-action/route-handler behavior with mocked
// Supabase/Stripe clients, per the Fase 3 compliance brief's test scope:
// checkout-validation, idempotency, and consent-recording. Full
// Playwright + Stripe-CLI end-to-end coverage is a deliberate non-goal for
// this pass (see the Fase 5 report's "Recommended next steps").
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The quality gate's grammar pass is one more model call per book; the older pipeline tests count their calls, so it is off here
    // and switched on explicitly by the tests of the gate itself.
    // Likewise the two behaviours that are on by default in production (the anchor model, and "every idea needs a concrete option" with
    // its extra online pass) are off here: the older tests describe the pipeline without them, and the tests of those two switch them on.
    // And the supply index (it reads the research cache of earlier books): the tests of the index itself pass their rows in.
    env: { WINDOW_QA_GRAMMAR: "0", REQUIRE_CONCRETE_OPTIONS: "0", KNOWLEDGE_ANCHOR_PICKS: "0", PREWARM_RESEARCH: "0", WINDOW_SUPPLY_INDEX: "0" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
