import { defineConfig, devices } from "@playwright/test";

const port = process.env.INTERVIEW_E2E_PORT || "3210";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const e2eEmail = process.env.E2E_TEST_EMAIL || "quesiq-e2e-admin@example.com";
const e2ePassword = process.env.E2E_TEST_PASSWORD || "QuesIQe2e12345";
const adminEmails = [process.env.ADMIN_EMAILS, e2eEmail].filter(Boolean).join(",");

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  globalSetup: "./tests/interview/global-setup.ts",
  outputDir: "artifacts/interview-regression/playwright-results",
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: "artifacts/interview-regression/playwright-report",
      },
    ],
  ],
  retries: process.env.CI ? 2 : 0,
  testDir: "./tests/interview",
  timeout: 90_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `node scripts/test/interview-e2e-server.mjs ${port}`,
    env: {
      ...process.env,
      ADMIN_EMAILS: adminEmails,
      DEV_AUTH_BYPASS_ENABLED: "1",
      E2E_AI_MODE: process.env.E2E_AI_MODE || "mock",
      E2E_TEST_EMAIL: e2eEmail,
      E2E_TEST_MODE: "1",
      E2E_TEST_PASSWORD: e2ePassword,
      NEXT_DIST_DIR: ".next-interview-e2e",
      NEXTAUTH_URL: baseURL,
    },
    reuseExistingServer: false,
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
