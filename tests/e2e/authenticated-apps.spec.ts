import { expect, test } from "@playwright/test";

import { signInAsE2EAdmin } from "./support/auth";

test("seeded user can sign in and see signed-in app destinations", async ({ page }) => {
  await signInAsE2EAdmin(page, "/apps");

  await expect(page.getByRole("heading", { name: "Choose where you want to practice." })).toBeVisible();
  await expect(page.getByRole("link", { name: /QuesIQ Interview/i })).toHaveAttribute(
    "href",
    "/interview",
  );
  await expect(page.getByRole("link", { name: /QuesIQ Study/i })).toHaveAttribute(
    "href",
    "/study",
  );
  await expect(page.getByRole("link", { name: /QuesIQ DPE/i })).toHaveAttribute(
    "href",
    "/dpe",
  );
});

test("authenticated product home pages render without redirecting to login", async ({ page }) => {
  await signInAsE2EAdmin(page, "/apps");

  await page.goto("/interview");
  await expect(page).toHaveURL(/\/interview/);
  await expect(page.locator("body")).not.toContainText("Sign in to QuesIQ");

  await page.goto("/study");
  await expect(page).toHaveURL(/\/study/);
  await expect(page.locator("body")).not.toContainText("Sign in to QuesIQ");

  await page.goto("/dpe");
  await expect(page).toHaveURL(/\/dpe/);
  await expect(page.locator("body")).not.toContainText("Sign in to QuesIQ");
});
