import { expect, test } from "@playwright/test";
import { signInAsE2EAdmin } from "../e2e/support/auth";

test("resume review mirrors edits, confirms explicitly and preserves cancelled replacements", async ({ page }, testInfo) => {
  await signInAsE2EAdmin(page, "/interview/mobile-preview");
  await page.goto("/interview/mobile-preview");
  const writes: string[] = [];
  page.on("request", request => { if (request.method() !== "GET") writes.push(request.url()); });
  await page.getByRole("button", { name: "Me", exact: true }).first().click();
  const phones = page.getByRole("region", { name: "Mobile device previews" });
  await phones.getByRole("button", { name: "Review / paste resume (preview only)" }).first().click();
  await phones.getByLabel("Review resume text", { exact: true }).first().fill("I led a team and completed a real project.");
  await expect(phones.getByLabel("Review resume text", { exact: true }).nth(1)).toHaveValue("I led a team and completed a real project.");
  await phones.getByRole("button", { name: "Confirm text (preview only)" }).first().click();
  await expect(phones.getByText("Confirmed text · preview sample", { exact: true })).toHaveCount(2);
  await phones.getByRole("button", { name: "Review / paste resume (preview only)" }).first().click();
  await phones.getByLabel("Review resume text", { exact: true }).first().fill("Unconfirmed replacement");
  await phones.getByRole("button", { name: "Cancel resume edit" }).first().click();
  await phones.getByRole("button", { name: "Review / paste resume (preview only)" }).first().click();
  await expect(phones.getByLabel("Review resume text", { exact: true }).nth(1)).toHaveValue("I led a team and completed a real project.");
  await phones.getByLabel("Review resume text", { exact: true }).first().fill("x".repeat(12001));
  for (const button of await phones.getByRole("button", { name: "Confirm text (preview only)" }).all()) await expect(button).toBeDisabled();
  await phones.getByLabel("Review resume text", { exact: true }).first().fill("Reviewed source facts");
  await phones.screenshot({ path: testInfo.outputPath("p61-resume-review.png") });
  expect(writes).toEqual([]);
});
