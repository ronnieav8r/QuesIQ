import { expect, type Page } from "@playwright/test";

import { e2eTestEmail, e2eTestPassword } from "./test-user";

export async function signInAsE2EAdmin(page: Page, nextPath = "/apps") {
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByRole("heading", { name: "Sign in to QuesIQ" }).waitFor();

  const passwordPanel = page.locator("form").filter({
    has: page.getByRole("heading", { name: "Email and password" }),
  });
  await passwordPanel.getByLabel("Email address").fill(e2eTestEmail);
  await passwordPanel.getByLabel("Password").fill(e2eTestPassword);
  await passwordPanel.getByRole("button", { name: /^Sign In$/ }).click();

  await page.waitForURL(`**${nextPath}`);
  await expect(page.locator("body")).toContainText(/QuesIQ|Interview|Study|DPE/i);
}
