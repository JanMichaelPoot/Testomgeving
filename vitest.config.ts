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
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
