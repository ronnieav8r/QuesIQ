import { expect, test } from "@playwright/test";

test("public home loads and Quira opens as a chat window", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /AI practice platform/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start Practicing/i }).first()).toBeVisible();

  await page.getByRole("button", { name: "Open Quira support chat" }).click();

  const dialog = page.getByRole("dialog", { name: "Support Chat" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Hello, I'm Quira. How can I help?");
  await expect(dialog.getByRole("textbox", { name: "Message Quira" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Bug" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Feedback" })).toBeVisible();

  await dialog.getByRole("button", { name: "Bug" }).click();
  await expect(dialog.getByText("Bug report mode")).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Message Quira" })).toHaveAttribute(
    "placeholder",
    /Describe the bug/,
  );

  await dialog.getByRole("button", { name: "Feedback" }).click();
  await expect(dialog.getByText("Feedback mode")).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Message Quira" })).toHaveAttribute(
    "placeholder",
    /Share feedback/,
  );
});
