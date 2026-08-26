import { expect, test } from "@playwright/test";

import { signInAsE2EAdmin } from "../e2e/support/auth";
import { grantFakeMicrophone, installMediaRecorderStub } from "../e2e/support/media";
import { expectNoBrowserErrors, installBrowserErrorChecks } from "./support/browser-errors";
import { getSeedState } from "./support/seed-state";

test.beforeEach(async ({ context, page, baseURL }) => {
  installBrowserErrorChecks(page);
  await grantFakeMicrophone(context, baseURL ?? "http://127.0.0.1:3210");
  await installMediaRecorderStub(page);
  await page.route("**/api/study/tts", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { audioBase64: Buffer.from("e2e audio").toString("base64"), mimeType: "audio/mpeg" },
      status: 200,
    });
  });
  await page.route("**/api/study/evaluate", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        explanation: "E2E mocked evaluation feedback.",
        feedback: "E2E mocked evaluation feedback.",
        verdict: "good",
      },
      status: 200,
    });
  });
  await signInAsE2EAdmin(page, "/apps");
});

test.afterEach(async ({ page }, testInfo) => {
  await expectNoBrowserErrors(page, testInfo);
});

test("Study shell, library, stack, and history render seeded local data", async ({ page }) => {
  const seed = getSeedState();

  await page.goto("/study");
  await expect(page.locator("body")).not.toContainText("Sign in to QuesIQ");
  await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible();

  await page.goto("/study/decks");
  await expect(page.getByText("[TEST_DELETE] Interview Study Regression Deck A")).toBeVisible();
  await expect(page.getByText("Deck B")).toBeVisible();

  await page.goto("/study/library?q=Regression");
  await expect(page.getByText("[TEST_DELETE] Interview Study Regression Deck A")).toBeVisible();

  await page.goto(`/study/stacks/${seed.study.stackId}`);
  await expect(page.getByText("[TEST_DELETE] Interview Study Regression Stack")).toBeVisible();
  await expect(page.getByRole("button", { name: "Study Stack Ordered" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Study Stack Random" })).toBeVisible();

  await page.goto("/study/history");
  await expect(page.locator("body")).not.toContainText("Sign in to QuesIQ");
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
});

test("visual flashcards flip both ways, rate cards, and save factual feedback", async ({ page }) => {
  const seed = getSeedState();
  const deckId = seed.study.deckIds[0];

  await page.goto(`/study/decks/${deckId}/study?order=ordered`);
  await expect(page.getByLabel("Visual flashcard study")).toBeVisible();
  await expect(page.getByText("What does the Interview + Study regression gate verify?")).toBeVisible();

  await page.getByRole("button", { name: /Tap to reveal answer/i }).click();
  await expect(page.getByText("Verify the route, seeded user")).toBeVisible();

  await page.getByLabel("Answer. Press to show question").click();
  await expect(page.getByText("What does the Interview + Study regression gate verify?")).toBeVisible();

  await page.getByRole("button", { name: /Tap to reveal answer/i }).click();
  await page.getByRole("button", { name: "Accurate" }).click();
  await expect(page.getByText("Marked accurate.")).toBeVisible();

  await page.getByRole("button", { name: "Flag issue" }).click();
  await expect(page.getByRole("dialog", { name: "Flag Card Issue" })).toBeVisible();
  await page.getByRole("button", { name: "Unclear" }).click();
  await page.getByPlaceholder("What should be corrected or checked?").fill("E2E issue context.");
  await page.getByRole("button", { name: "Send issue" }).click();
  await expect(page.getByText("Issue sent for review.")).toBeVisible();

  await page.getByRole("button", { name: "Correct" }).click();
  await expect(page.getByText("How does the regression suite handle AI calls by default?")).toBeVisible();
  await page.getByRole("button", { name: /Tap to reveal answer/i }).click();
  await page.getByRole("button", { name: "Almost" }).click();
  await expect(page.getByRole("heading", { name: "Session Complete" })).toBeVisible();
});

test("Study modes render across deck and stack workflows", async ({ page }) => {
  const seed = getSeedState();
  const deckId = seed.study.deckIds[0];
  const stackId = seed.study.stackId;

  const modeChecks: Array<[string, RegExp]> = [
    [`/study/decks/${deckId}/study/quiz`, /Quiz/],
    [`/study/decks/${deckId}/study/quiz?mode=truefalse`, /True \/ False/],
    [`/study/decks/${deckId}/study/written`, /Written/],
    [`/study/decks/${deckId}/study/match`, /Term|Definition/],
    [`/study/decks/${deckId}/study/test`, /Test/],
    [`/study/decks/${deckId}/study/verbal`, /Hands-Free setup|Verbal/],
    [`/study/decks/${deckId}/study/memorize`, /Memorize/],
    [`/study/stacks/${stackId}/study?order=ordered`, /Tap to reveal answer/],
    [`/study/stacks/${stackId}/study/memorize`, /Memorize/],
  ];

  for (const [url, expected] of modeChecks) {
    await page.goto(url);
    await expect(page.locator("body")).toContainText(expected);
    await expect(page.locator("body")).not.toContainText("Sign in to QuesIQ");
  }
});

test("Study admin import screen is admin-visible on the isolated server", async ({ page }) => {
  await page.goto("/admin?product=study");
  await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Import official Study decks" })).toBeVisible();
  await expect(page.getByLabel("Rich flashcard CSV")).toBeVisible();
  await expect(page.getByLabel("Stack assignment mode")).toBeVisible();
  await expect(page.getByText("Mark deck Official")).toBeVisible();
});
