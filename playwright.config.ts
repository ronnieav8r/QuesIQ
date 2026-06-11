import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "1";
const e2eEmail = process.env.E2E_TEST_EMAIL || "quesiq-e2e-admin@example.com";
const adminEmails = [process.env.ADMIN_EMAILS, e2eEmail].filter(Boolean).join(",");

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  globalSetup: "./tests/e2e/global-setup.ts",
  outputDir: "artifacts/playwright-results",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "artifacts/playwright-report" }],
  ],
  retries: process.env.CI ? 2 : 0,
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: "npm run dev:local",
        env: {
          ...process.env,
          ADMIN_EMAILS: adminEmails,
          E2E_TEST_EMAIL: e2eEmail,
        },
        reuseExistingServer: true,
        timeout: 120_000,
        url: baseURL,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
