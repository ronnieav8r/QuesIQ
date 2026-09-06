import { expect, test } from "@playwright/test";
import { signInAsE2EAdmin } from "../e2e/support/auth";

test("static mobile preview stays labelled, mirrored, and read-only", async ({ page }, testInfo) => {
  await signInAsE2EAdmin(page, "/interview/mobile-preview");
  const writes: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET") writes.push(request.method() + " " + request.url()); });
  await page.goto("/interview/mobile-preview");
  await expect(page.getByRole("tab", { name: "Test Coaching · no audio" })).toHaveAttribute("aria-selected", "true");
  const lab = page.getByRole("region", { name: "Typed Coaching inspector" });
  await expect(lab.getByRole("combobox", { name: "Execution", exact: true })).toHaveValue("simulation");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.getByRole("tab", { name: "What will happen" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("SESSION SETUP · SAMPLE").first()).toBeVisible();
  const phones = page.getByRole("region", { name: "Mobile device previews" });
  await expect(phones).toContainText("Start simulated answer");
  await phones.getByRole("button", { name: /First Impression Sharpen/ }).first().click();
  await expect(phones.getByText("3. Question focus")).toHaveCount(0);
  await phones.screenshot({ path: testInfo.outputPath("mobile-layout-fit.png") });
  const rapidFire = phones.getByRole("button", { name: "Rapid Fire" });
  await rapidFire.first().click();
  await expect(rapidFire).toHaveCount(2);
  for (const button of await rapidFire.all()) await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(phones.getByText("3. Question focus")).toHaveCount(2);
  for (const label of ["Technical", "Direct"]) {
    const choices = phones.getByRole("button", { name: label, exact: true });
    await choices.first().click();
    await expect(choices).toHaveCount(2);
    for (const button of await choices.all()) await expect(button).toHaveAttribute("aria-pressed", "true");
  }
  await expect(phones.getByRole("button", { name: "Start simulated answer" }).nth(1)).toBeVisible();
  await phones.getByRole("button", { name: "Start simulated answer" }).first().click();
  await expect(phones.getByText("SIMULATED CAPTIONS")).toHaveCount(0);
  const showCaptions = phones.getByRole("button", { name: "Show captions (simulated)" });
  await showCaptions.first().click();
  await expect(phones.getByText("SIMULATED CAPTIONS")).toHaveCount(2);
  await page.getByRole("button", { name: "Me", exact: true }).first().click();
  await expect(page.getByText("Sample / simulation · changes stay in this preview").first()).toBeVisible();
  await phones.getByLabel("Preferred name", { exact: true }).first().fill("Sample Alex");
  for (const input of await phones.getByLabel("Preferred name", { exact: true }).all()) await expect(input).toHaveValue("Sample Alex");
  await phones.getByRole("button", { name: "Save profile (preview only)" }).first().click();
  await expect(phones.getByRole("status")).toHaveCount(2);
  await expect(phones.getByRole("status").first()).toHaveText("Preview only — nothing was saved to your account.");
  await page.getByRole("button", { name: "Actual size", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1400 });
  await phones.screenshot({ path: testInfo.outputPath("mobile-layout-large.png") });
  expect(writes).toEqual([]);
});

test("review puts evidence and next step before sample score", async ({ page }) => {
  await signInAsE2EAdmin(page, "/interview/mobile-preview");
  await page.goto("/interview/mobile-preview");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  const phones = page.getByRole("region", { name: "Mobile device previews" });
  const text = await phones.locator('[class*="mobilePage"]').first().innerText();
  expect(text.indexOf("Next practice step")).toBeGreaterThanOrEqual(0);
  expect(text.indexOf("Next practice step")).toBeLessThan(text.indexOf("Overall interview score"));
  expect(text.indexOf("Open sample transcript evidence")).toBeLessThan(text.indexOf("Overall interview score"));
  await phones.getByRole("button", { name: /Open sample transcript evidence/ }).first().click();
  for (const toggle of await phones.getByRole("button", { name: "Transcript · 2 turns" }).all()) await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(phones.getByText("During a high-tempo operational assignment, We delivered two days early.", { exact: false })).toHaveCount(2);
  await expect(phones.getByText("Overall interview score · sample").first()).toBeVisible();
});

test("sample screens fit both phone widths with reachable controls", async ({ page }, testInfo) => {
  await signInAsE2EAdmin(page, "/interview/mobile-preview");
  await page.goto("/interview/mobile-preview");
  // Phone dimensions remain 393/412 wide. A tall host viewport avoids the
  // inspector's sticky toolbar covering screenshots. This is not native QA.
  await page.setViewportSize({ width: 1440, height: 1800 });
  await page.getByRole("button", { name: "Actual size", exact: true }).click();
  const phones = page.getByRole("region", { name: "Mobile device previews" });
  for (const name of ["Home", "Practice", "Live Session", "Review", "Me"]) {
    await page.locator('[aria-label="Preview screen"]').getByRole("button", { name, exact: true }).click();
    const pages = phones.locator('[class*="mobilePage"]');
    await expect(pages).toHaveCount(2);
    for (const phone of await pages.all()) {
      expect(await phone.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect(await phone.locator("button").evaluateAll((buttons) => buttons.every((button) => button instanceof HTMLElement && button.offsetHeight >= 48))).toBe(true);
    }
    await phones.screenshot({ path: testInfo.outputPath(name.toLowerCase().replaceAll(" ", "-") + "-frames.png") });
    if (name === "Practice") {
      await phones.getByRole("button", { name: "Start simulated answer" }).nth(1).scrollIntoViewIfNeeded();
      await phones.screenshot({ path: testInfo.outputPath("practice-scrolled-frames.png") });
    }
  }
});
