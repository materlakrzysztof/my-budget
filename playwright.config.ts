import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // Cap parallelism locally: all workers share one remote Supabase project and
  // local CPU, so a full-parallel burst of signup/signin + Astro island
  // hydration flakes. 2 lanes keeps meaningful parallelism without the contention.
  workers: process.env.CI ? 1 : 2,
  forbidOnly: !!process.env.CI,
  // One local retry absorbs residual races; trace-on-first-retry keeps it visible.
  retries: process.env.CI ? 2 : 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev:e2e",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
  },
});
