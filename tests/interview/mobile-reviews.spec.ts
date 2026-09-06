import { expect, test } from "@playwright/test";
import { signInAsE2EAdmin } from "../e2e/support/auth";

const id = "11111111-1111-4111-8111-111111111111";
const older = "22222222-2222-4222-8222-222222222222";
const transcriptId = "33333333-3333-4333-8333-333333333333";
const baseItem = (sessionId: string, status = "completed") => ({ id: sessionId, createdAt: "2026-01-01T12:00:00.000Z", endedAt: "2026-01-01T12:01:00.000Z", evaluationStatus: status, hasEvaluation: status === "completed", modeKey: "coaching", status: "evaluated", styleKey: "friendly", targetCompany: "Synthetic Co", targetRole: "Pilot" });
const detail = (status = "completed", access = "ready") => ({ ...baseItem(id, status), transcript: [{ id: transcriptId, createdAt: "2026-01-01T12:00:30.000Z", role: "user", speaker: "You", text: "I chose the safe option and delivered the result." }], evaluation: status === "completed" ? { summary: "Grounded saved feedback.", coachingInsight: "Name the result.", nextAction: "Make the outcome measurable.", scores: [{ key: "clarity", label: "Clarity", score: 4, summary: "Clear." }], reviewDetail: { evidence: ["safe option"], focusAreas: [], followUpQuestions: [], practicePlan: [], strengths: [] } } : undefined, reviewAccess: { kind: access, message: access === "ready" ? "Your saved review is ready." : "Review did not complete.", canRequest: access === "eligible" }, attempts: [{ id: "a1", questionId: `${id}:q1`, question: "Tell me about a decision.", attemptIndex: 1, answer: "first answer", feedback: "Add the result.", assisted: false, evidence: [], promptProfile: "current", promptVersions: [], semanticQuality: "unreviewed" }, { id: "a2", questionId: `${id}:q1`, question: "Tell me about a decision.", attemptIndex: 2, answer: "second answer", feedback: "Clearer result.", assisted: true, evidence: [], promptProfile: "current", promptVersions: [], semanticQuality: "unreviewed" }] });

test("Saved reviews loads older pages and owned detail in both frames", async ({ page }, testInfo) => {
  const requests: string[] = [];
  await page.route("**/api/mobile/v1/interview/sessions**", async (route) => {
    const url = new URL(route.request().url()); requests.push(route.request().method() + " " + url.pathname + url.search);
    if (url.pathname.endsWith("/detail")) {
      await route.fulfill({ json: { session: { ...detail(), id: older, targetRole: "Older pilot" } } }); return;
    }
    await route.fulfill({ json: { sessions: url.searchParams.has("cursor") ? [{ ...baseItem(older), targetRole: "Older pilot" }] : [baseItem(id)], nextCursor: url.searchParams.has("cursor") ? null : "older-page" } });
  });
  await signInAsE2EAdmin(page, "/interview/mobile-preview"); await page.goto("/interview/mobile-preview");
  expect(requests).toEqual([]);
  await page.getByRole("tab", { name: "Saved reviews", exact: true }).click();
  const lab = page.getByRole("region", { name: "Saved review test bed" });
  const iphone = lab.getByRole("region", { name: "iPhone saved reviews", exact: true });
  const pixel = lab.getByRole("region", { name: "Pixel saved reviews", exact: true });
  await expect(iphone).toBeVisible(); await expect(pixel).toBeVisible();
  await iphone.getByRole("button", { name: "Load older reviews" }).click();
  await expect(pixel.getByRole("button", { name: /Older pilot/ })).toBeVisible();
  await pixel.getByRole("button", { name: /Older pilot/ }).click();
  await expect(iphone.getByText("Your saved review is ready.")).toBeVisible();
  expect(requests).toContain("GET /api/mobile/v1/interview/sessions/" + older + "/detail");
  await pixel.getByRole("button", { name: "View supporting transcript" }).click();
  await expect(iphone.getByText(/Linked evidence/)).toBeAttached();
  await pixel.getByRole("button", { name: "Compare attempts", exact: true }).click();
  await expect(pixel.getByText("Attempt 2 · Assisted retry")).toBeVisible();
  for (const frame of [iphone, pixel]) {
    const dimensions = await frame.getByRole("region", { name: "Saved review content" }).evaluate((el) => ({ width: el.clientWidth, scrollWidth: el.scrollWidth, height: el.clientHeight, scrollHeight: el.scrollHeight }));
    expect(dimensions.width).toBeGreaterThan(200); expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.height);
  }
  await page.getByRole("button", { name: "Actual size", exact: true }).click();
  await page.setViewportSize({ width: testInfo.project.name === "chromium" ? 1440 : 430, height: 1400 });
  await pixel.locator("xpath=ancestor::article").screenshot({ path: testInfo.outputPath("saved-review-pixel.png") });
  await iphone.locator("xpath=ancestor::article").screenshot({ path: testInfo.outputPath("saved-review-iphone.png") });
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await lab.screenshot({ path: testInfo.outputPath("saved-reviews-fit.png") });
  expect(requests.every((request) => request.startsWith("GET "))).toBe(true);
  await page.reload(); await page.getByRole("tab", { name: "Saved reviews", exact: true }).click();
  await iphone.getByRole("button", { name: "Load older reviews" }).click();
  await iphone.getByRole("button", { name: /Older pilot/ }).click();
  await expect(pixel.getByText("Your saved review is ready.")).toBeVisible();
});

test("evaluation needs confirmation, failed status refresh blocks repeat, polling is read-only", async ({ page }) => {
  let postCount = 0; let readCount = 0; let failRead = false;
  await page.route("**/api/mobile/v1/interview/sessions**", async (route) => {
    if (route.request().method() === "POST") {
      postCount++; expect(route.request().postDataJSON()).toEqual({ confirmRetry: true }); failRead = true;
      await route.fulfill({ status: 503, json: { error: { message: "Synthetic provider blocked" } } }); return;
    }
    if (new URL(route.request().url()).pathname.endsWith("/detail")) {
      readCount++;
      if (failRead) { await route.fulfill({ status: 503, json: { error: { message: "Synthetic status unavailable" } } }); return; }
      await route.fulfill({ json: { session: postCount ? detail("processing", "processing") : detail("failed", "eligible") } }); return;
    }
    await route.fulfill({ json: { sessions: [baseItem(id, "failed")], nextCursor: null } });
  });
  await signInAsE2EAdmin(page, "/interview/mobile-preview"); await page.goto("/interview/mobile-preview");
  await page.getByRole("tab", { name: "Saved reviews", exact: true }).click();
  const phone = page.getByRole("region", { name: "iPhone saved reviews", exact: true });
  await phone.getByRole("button", { name: /Pilot/ }).click();
  await phone.getByRole("button", { name: "Compare attempts", exact: true }).click();
  await expect(phone.getByText("Attempt 2 · Assisted retry")).toBeVisible();
  await phone.getByRole("button", { name: "Request evaluation", exact: true }).click();
  expect(postCount).toBe(0);
  await phone.getByRole("button", { name: "Confirm evaluation request" }).click();
  await expect(phone.getByRole("alert")).toContainText("Synthetic status unavailable");
  await expect(phone.getByRole("button", { name: /evaluation request|Request evaluation/ })).toHaveCount(0);
  expect(postCount).toBe(1);
  failRead = false; await phone.getByRole("button", { name: "Refresh", exact: true }).click();
  const afterRefresh = readCount;
  await expect.poll(() => readCount).toBeGreaterThan(afterRefresh);
  expect(postCount).toBe(1);
});

test("simulation answer retry comparison persists and reopens without learner History mutations", async ({ page }) => {
  const learnerMutations: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST" && request.url().includes("/api/mobile/v1/interview/sessions")) learnerMutations.push(request.url()); });
  await signInAsE2EAdmin(page, "/interview/mobile-preview"); await page.goto("/interview/mobile-preview");
  const lab = page.getByRole("region", { name: "Typed Coaching inspector" });
  const phone = lab.getByRole("region", { name: "iPhone Coaching test", exact: true });
  const pixel = lab.getByRole("region", { name: "Pixel Coaching test", exact: true });
  await phone.getByRole("button", { name: "New Coaching test" }).click();
  await phone.getByRole("button", { name: "Generate opening question" }).click();
  await phone.getByLabel("Your answer", { exact: true }).fill("I assigned tasks and finished before the deadline.");
  await pixel.getByRole("button", { name: "Submit text", exact: true }).click();
  await phone.getByRole("button", { name: "Try again", exact: true }).click();
  await phone.getByLabel("Your answer", { exact: true }).fill("I assigned specific tasks, checked progress, and we delivered two days early.");
  await pixel.getByRole("button", { name: "Submit text", exact: true }).click();
  await phone.getByRole("button", { name: "Compare attempts", exact: true }).click();
  const comparison = phone.getByRole("region", { name: "Attempt comparison", exact: true });
  await expect(comparison).toContainText("First attempt"); await expect(comparison).toContainText("Assisted retry");
  const savedId = await phone.getByLabel("Saved tests", { exact: true }).inputValue();
  const exportUrl = await lab.getByRole("link", { name: "Export JSON" }).getAttribute("href");
  const saved = await (await page.request.get(exportUrl!)).json();
  expect(saved.attempts).toHaveLength(2); expect(saved.attempts[1].assisted).toBe(true);
  expect(saved.attempts[0].questionId).toBe(saved.attempts[1].questionId);
  await page.reload();
  await phone.locator("summary", { hasText: "Saved tests" }).click();
  await phone.getByLabel("Saved tests", { exact: true }).selectOption(savedId);
  await phone.locator("summary", { hasText: "Saved tests" }).click();
  await pixel.getByRole("button", { name: "Compare attempts", exact: true }).click();
  await expect(comparison).toContainText("delivered two days early");
  expect(learnerMutations).toEqual([]);
});
