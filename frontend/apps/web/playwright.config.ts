import { defineConfig, devices } from "@playwright/test";

/**
 * Browser E2E suite, run against a live API and `next start`.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter web test:e2e
 *
 * The admin must exist WITHOUT an authenticator: the "setup" project enrolls
 * one on first sign-in and saves the session for the authenticated specs.
 * The manual walk-throughs (e2e/*.check.mjs, e2e/*.shots.mjs) are separate.
 */
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e/specs",
  // A TOTP code is accepted only once, so tests share one serial timeline.
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 60_000,
  reporter: CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.WEB_URL ?? "http://localhost:3000",
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts$/ },
    {
      name: "anonymous",
      testMatch: /anonymous\/.*\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "admin",
      testMatch: /admin\/.*\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
    },
  ],
});
