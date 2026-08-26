import { expect, type Page } from "@playwright/test";

import { e2eTestEmail, e2eTestPassword } from "./test-user";

export async function signInAsE2EAdmin(page: Page, nextPath = "/apps") {
  const devResponse = await page.request.post("/api/dev-auth/session", {
    data: { role: "e2e-admin" },
  });

  if (devResponse.ok()) {
    await page.goto(nextPath);
    await expect(page).toHaveURL(new RegExp(`${nextPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    await expect(page.locator("body")).toContainText(/QuesIQ|Interview|Study|DPE/i);
    return;
  }

  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByRole("heading", { name: "Sign in to QuesIQ" }).waitFor();

  const passwordPanel = page.locator("form").filter({
    has: page.getByRole("heading", { name: "Email and password" }),
  });
  await passwordPanel.getByLabel("Email address").fill(e2eTestEmail);
  await passwordPanel.getByLabel("Password").fill(e2eTestPassword);
  await passwordPanel.getByRole("button", { name: /^Sign In$/ }).click();

  const escapedNextPath = nextPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await expect(page).toHaveURL(new RegExp(`${escapedNextPath}$`));
  await expect(page.locator("body")).toContainText(/QuesIQ|Interview|Study|DPE/i);
}
