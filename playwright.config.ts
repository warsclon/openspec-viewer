import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // The budget covers fixture setup, the test body, and teardown together.
  // Shared CI runners need more headroom than a developer machine.
  timeout: process.env.CI ? 90_000 : 30_000,
  expect: {
    timeout: 5_000,
  },
  outputDir: "test-results",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    browserName: "chromium",
    headless: true,
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "dark",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
    },
  ],
});
