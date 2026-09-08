import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, PORT, appEnv } from "./tests/setup/env";

// Three projects, in dependency order:
//   unit — pure functions, no browser and no server
//   api  — HTTP calls straight at the route handlers
//   e2e  — real browser journeys
//
// Everything runs against one throwaway database that global-setup rebuilds
// from the real migration files. Tests share that database and a single
// stock/order counter, so they run one at a time: this suite is a
// pre-deployment gate where a deterministic result matters more than speed.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }], ["github"]]
    : [["list"], ["html", { open: "never" }]],
  outputDir: "./test-results/artifacts",

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    // The homepage category circles crossfade on a timer; freezing motion
    // keeps screenshots and visibility checks from racing them.
    contextOptions: { reducedMotion: "reduce" },
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: "unit",
      testMatch: /tests\/unit\/.*\.spec\.ts/,
      use: {},
    },
    {
      name: "api",
      testMatch: /tests\/api\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["unit"],
    },
    {
      name: "e2e",
      testMatch: /tests\/e2e\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
      dependencies: ["api"],
    },
  ],

  // Unit-only runs (npm run test:unit) skip booting the app entirely.
  webServer: process.env.PW_SKIP_SERVER
    ? undefined
    : {
        // The database is rebuilt as the first half of this command rather
        // than in a globalSetup hook: Playwright starts the web server
        // before globalSetup runs, so anything done there would happen
        // underneath a server that had already connected.
        command: `npx tsx tests/setup/prepare-db.ts && npx next start -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
        env: appEnv(),
      },
});
