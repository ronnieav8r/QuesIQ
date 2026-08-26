import { expect, test } from "@playwright/test";

import { signInAsE2EAdmin } from "../e2e/support/auth";
import { grantFakeMicrophone, installMediaRecorderStub } from "../e2e/support/media";
import { expectNoBrowserErrors, installBrowserErrorChecks } from "./support/browser-errors";
import { getSeedState } from "./support/seed-state";

test.beforeEach(async ({ context, page, baseURL }) => {
  installBrowserErrorChecks(page);
  await grantFakeMicrophone(context, baseURL ?? "http://127.0.0.1:3210");
  await installMediaRecorderStub(page);
  await page.route("**/api/introductions/draft", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        draft: {
          audience: "virtual",
          background: "E2E background.",
          length: "medium",
          proofPoint: "E2E proof point.",
          rawNotes: "E2E raw notes.",
          roleInterest: "E2E role interest.",
          script: "E2E introduction script.",
          strength: "E2E strength.",
          title: "[TEST_DELETE] Interview Regression Draft",
          transition: "E2E transition.",
        },
      },
      status: 200,
    });
  });
  await signInAsE2EAdmin(page, "/apps");
});

test.afterEach(async ({ page }, testInfo) => {
  await expectNoBrowserErrors(page, testInfo);
});

test("Interview shell, practice setup, Story Lab, history, and Me render", async ({ page }) => {
  await page.goto("/interview");
  await expect(page.getByRole("heading", { name: "Practice interviews out loud." })).toBeVisible();

  await page.getByRole("button", { name: /^Practice$/ }).first().click();
  await expect(page.getByRole("button", { name: /Coaching Work through answers/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Rapid Fire/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Mock Interview/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Hands-Free/i })).toBeVisible();

  await page.getByRole("button", { name: /^Story Lab$/ }).first().click();
  await expect(page.getByText("[TEST_DELETE] Interview Regression Intro")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Library" })).toBeVisible();

  await page.getByRole("button", { name: /^History$/ }).first().click();
  await expect(page.locator("body")).not.toContainText("Sign in to QuesIQ");
  await expect(page.getByRole("heading", { name: "Practice history" })).toBeVisible();

  await page.getByRole("button", { name: /^Open menu$|^Menu$/ }).first().click();
  await page.getByRole("menuitem", { name: /^Me$/ }).click();
  await expect(page.locator("body")).toContainText(/Profile|Job Targets|Target/i);
});

test("Interview authenticated APIs cover profile targets, question queue, stories, and introductions", async ({
  page,
}) => {
  const seed = getSeedState();

  const targetResponse = await page.request.get("/api/job-targets");
  expect(targetResponse.ok()).toBeTruthy();
  await expect
    .poll(async () => {
      const body = (await targetResponse.json()) as { targets?: Array<{ id: string }> };
      return body.targets?.some((target) => target.id === seed.interview.jobTargetId) ?? false;
    })
    .toBeTruthy();

  const questionsResponse = await page.request.get("/api/interview/questions?skill=Process%20improvement");
  expect(questionsResponse.ok()).toBeTruthy();
  const questionsBody = (await questionsResponse.json()) as {
    questions?: Array<{ id: string; questionText: string }>;
  };
  expect(
    questionsBody.questions?.some((question) => question.id === seed.interview.customQuestionId),
  ).toBeTruthy();

  const createQuestionResponse = await page.request.post("/api/interview/questions", {
    data: {
      compatibleModes: ["rapid_fire"],
      difficulty: "standard",
      questionText: "[TEST_DELETE] Interview Regression API question",
      questionTypeKey: "behavioral",
      roleFamily: "Operations",
      scoringHints: "E2E scoring hints.",
      suggestedUse: "E2E API coverage.",
      tags: ["__test_delete__"],
      targetSkill: "Process improvement",
    },
  });
  expect(createQuestionResponse.status()).toBe(201);
  const createQuestionBody = (await createQuestionResponse.json()) as {
    question: { id: string };
  };

  const patchQuestionResponse = await page.request.patch(
    `/api/interview/questions/${createQuestionBody.question.id}`,
    {
      data: {
        questionText: "[TEST_DELETE] Interview Regression API question updated",
      },
    },
  );
  expect(patchQuestionResponse.ok()).toBeTruthy();

  const deleteQuestionResponse = await page.request.delete(
    `/api/interview/questions/${createQuestionBody.question.id}`,
  );
  expect(deleteQuestionResponse.ok()).toBeTruthy();

  const storiesResponse = await page.request.get("/api/stories");
  expect(storiesResponse.ok()).toBeTruthy();
  const storiesBody = (await storiesResponse.json()) as { stories?: Array<{ id: string }> };
  expect(storiesBody.stories?.some((story) => story.id === seed.interview.storyId)).toBeTruthy();

  const introductionsResponse = await page.request.get("/api/introductions");
  expect(introductionsResponse.ok()).toBeTruthy();
  const introductionsBody = (await introductionsResponse.json()) as {
    introductions?: Array<{ id: string }>;
  };
  expect(
    introductionsBody.introductions?.some(
      (introduction) => introduction.id === seed.interview.introductionId,
    ),
  ).toBeTruthy();
});

test("Interview admin test tunnel status is reachable without exposing live voice as automated", async ({
  page,
}) => {
  await page.goto("/admin?product=interview");
  await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Interview" })).toBeVisible();

  await expect
    .poll(
      async () => {
        try {
          const statusResponse = await page.request.get("/api/admin/interview/test-tunnel/status");
          if (!statusResponse.ok()) {
            return false;
          }
          const body = (await statusResponse.json()) as Record<string, unknown>;
          const bodyText = JSON.stringify(body);
          return bodyText.includes("database") && bodyText.includes("prompt");
        } catch {
          return false;
        }
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
});
