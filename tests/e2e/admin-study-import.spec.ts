import { expect, test } from "@playwright/test";

import { signInAsE2EAdmin } from "./support/auth";

test("admin Study CSV import screen exposes official deck and stack controls", async ({ page }) => {
  await signInAsE2EAdmin(page, "/admin?product=study");

  await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deck Operations" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import official Study decks" })).toBeVisible();

  await expect(page.getByText("Exact CSV headers")).toBeVisible();
  await expect(page.getByLabel("Rich flashcard CSV")).toBeVisible();
  await expect(page.getByText("Confirm header mapping")).toBeVisible();
  await expect(page.getByText("Deck target")).toBeVisible();
  await expect(page.getByLabel("Stack assignment mode")).toBeVisible();
  await expect(page.getByText("Mark deck Official")).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview CSV" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import deck" })).toBeVisible();
});
