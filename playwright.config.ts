import { defineConfig } from "@playwright/test";

// End-to-end tests against a local Supabase (npm run db:start) and a running app.
// Reset data first: npx supabase db reset
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: "npm run build && npm run start",
    url: "http://localhost:3000/login",
    timeout: 240_000,
    reuseExistingServer: true,
  },
});
