import { test, expect } from "@playwright/test";
import { signInAsE2EAdmin } from "../e2e/support/auth";

test("Rapid Fire finishes at its selected count without Coaching choices", async ({ page }, info) => {
  await signInAsE2EAdmin(page, "/interview/mobile-preview");
  await page.goto("/interview/mobile-preview");
  await page.getByRole("combobox", { name: "Mode for new test", exact: true }).selectOption("rapid_fire");
  await page.getByRole("combobox", { name: "Question count", exact: true }).selectOption("2");
  const phone = page.getByRole("region", { name: "iPhone Rapid Fire test", exact: true });
  await phone.getByRole("button", { name: "New Rapid Fire test" }).click();
  await phone.getByRole("button", { name: "Generate opening question" }).click();
  for (let i = 1; i <= 2; i++) {
    await phone.getByLabel("Your answer", { exact: true }).fill(`I would first clarify the priorities for this situation ${i}.`);
    await phone.getByRole("button", { name: "Submit text" }).click();
    await expect(phone.getByRole("button", { name: `Inspect turn ${i + 1}`, exact: true })).toBeVisible();
    await expect(phone.getByRole("button", { name: "Try again", exact: true })).toHaveCount(0);
    await expect(phone.getByRole("button", { name: "More feedback", exact: true })).toHaveCount(0);
  }
  await expect(phone).toContainText("Test complete");
  await expect(phone.getByLabel("Your answer", { exact: true })).toHaveCount(0);
  expect(await phone.getByRole("region", { name: "Test conversation", exact: true }).evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath("rapid-fire.png"), fullPage: true });
});

test("First Impression mirrors one optional retry and reopens both attempts", async ({ page }, info) => {
  await signInAsE2EAdmin(page, "/interview/mobile-preview");
  await page.goto("/interview/mobile-preview");
  await page.getByRole("combobox", { name: "Mode for new test", exact: true }).selectOption("first_impression");
  const phone = page.getByRole("region", { name: "iPhone First Impression test", exact: true });
  const pixel = page.getByRole("region", { name: "Pixel First Impression test", exact: true });
  await phone.getByRole("button", { name: "New First Impression test" }).click();
  await phone.getByRole("button", { name: "Generate opening question" }).click();
  await phone.getByLabel("Your answer", { exact: true }).fill("I help teams organize their projects and meet deadlines.");
  await pixel.getByRole("button", { name: "Submit text" }).click();
  await expect(phone.getByRole("button", { name: "Finish", exact: true })).toBeEnabled();
  await expect(phone.getByRole("button", { name: "More feedback", exact: true })).toHaveCount(0);
  await phone.getByRole("button", { name: "Try again", exact: true }).click();
  await phone.getByLabel("Your answer", { exact: true }).fill("I led a reporting project that helped my team meet a tight deadline.");
  await phone.getByRole("button", { name: "Submit text" }).click();
  await expect(pixel.getByRole("button", { name: "Finish", exact: true })).toBeEnabled();
  await expect(phone.getByRole("button", { name: "Try again", exact: true })).toHaveCount(0);
  await phone.getByRole("button", { name: "Finish", exact: true }).click();
  const saved = await phone.getByLabel("Saved tests", { exact: true }).inputValue();
  await phone.getByRole("button", { name: "Compare attempts" }).click();
  await expect(phone.getByRole("region", { name: "Attempt comparison" })).toContainText("deadline");
  await page.screenshot({ path: info.outputPath("first-impression.png"), fullPage: true });
  await page.reload();
  const initial = page.getByRole("region", { name: "iPhone Coaching test", exact: true });
  await initial.locator("summary", { hasText: "Saved tests" }).click();
  await initial.getByLabel("Saved tests", { exact: true }).selectOption(saved);
  await expect(phone).toBeVisible();
  await phone.getByRole("button", { name: "Compare attempts" }).click();
  await expect(phone.getByRole("region", { name: "Attempt comparison" })).toContainText("deadline");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
