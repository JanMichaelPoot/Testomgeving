import { defineConfig } from "@playwright/test";

// Browser tests for layout problems that unit tests cannot see (a bar covering the last
// options on a phone, ...). Run with `npm run test:e2e`; it reuses a dev server that is
// already running on port 3000 and starts one otherwise. Chromium only, so this does not
// replace a check on a real iPhone or Android phone.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    // The consent banner would cover the bottom of the page and is not what we test.
    storageState: {
      cookies: [],
      origins: [{ origin: process.env.E2E_BASE_URL ?? "http://localhost:3000", localStorage: [{ name: "window_analytics_consent", value: "denied" }] }],
    },
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});
