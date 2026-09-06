import { expect, test } from "@playwright/test";
import { signInAsE2EAdmin } from "../e2e/support/auth";

test("framed Coaching test bed is the safe default on load, reset and reload", async ({ page }) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/admin/interview/coaching-inspector")) mutations.push(request.url());
  });
  await signInAsE2EAdmin(page, "/interview/mobile-preview");
  await page.goto("/interview/mobile-preview");
  const testTab = page.getByRole("tab", { name: "Test Coaching · no audio" });
  const lab = page.getByRole("region", { name: "Typed Coaching inspector" });
  await expect(testTab).toHaveAttribute("aria-selected", "true");
  await expect(lab.getByRole("combobox", { name: "Execution", exact: true })).toHaveValue("simulation");
  await expect(lab.getByRole("combobox", { name: "Prompts for new test", exact: true })).toHaveValue("current");
  await expect(lab.getByRole("region", { name: "iPhone Coaching test", exact: true })).toBeVisible();
  await expect(lab.getByRole("region", { name: "Pixel Coaching test", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Actual size", exact: true }).click();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.getByRole("tab", { name: "What will happen" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Reset preview", exact: true }).click();
  await expect(testTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Fit", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "What will happen" }).click();
  await page.reload();
  await expect(testTab).toHaveAttribute("aria-selected", "true");
  await expect(lab.getByRole("combobox", { name: "Execution", exact: true })).toHaveValue("simulation");
  expect(mutations).toEqual([]);
});

test("typed Coaching simulation saves, retries, reopens and exports without audio", async ({ page }, testInfo) => {
  await signInAsE2EAdmin(page, "/interview/mobile-preview");
  await page.goto("/interview/mobile-preview");
  await expect(page.getByRole("tab", { name: "Test Coaching · no audio" })).toHaveAttribute("aria-selected", "true");
  const lab = page.getByRole("region", { name: "Typed Coaching inspector" });
  const phone = lab.getByRole("region", { name: "iPhone Coaching test", exact: true });
  const pixel = lab.getByRole("region", { name: "Pixel Coaching test", exact: true });
  await expect(lab.getByRole("region", { name: "Mobile device previews" })).toHaveCount(1);
  await expect(lab.getByRole("heading", { name: "Test Coaching · no audio" })).toBeVisible();
  await phone.getByRole("button", { name: "New Coaching test" }).click();
  await phone.getByRole("button", { name: "Generate opening question" }).click();
  await expect(phone.getByRole("button", { name: "Inspect turn 1", exact: true })).toContainText("difficult problem");
  await phone.getByLabel("Your answer", { exact: true }).fill("I assigned tasks and finished before the deadline.");
  await expect(pixel.getByLabel("Your answer", { exact: true })).toHaveValue("I assigned tasks and finished before the deadline.");
  await pixel.getByRole("button", { name: "Submit text", exact: true }).click();
  await expect(phone.getByRole("button", { name: "Try again", exact: true })).toBeEnabled();
  await lab.getByLabel("Simulate next request failing").check();
  await phone.getByRole("button", { name: "More feedback", exact: true }).click();
  await expect(phone.getByRole("alert")).toContainText("Simulated connection failure");
  await phone.getByRole("button", { name: "Retry response", exact: true }).click();
  await expect(phone.getByRole("button", { name: "Inspect turn 3", exact: true })).toContainText("personal action");
  await phone.getByRole("button", { name: "Ask Que", exact: true }).click();
  await phone.getByLabel("Ask Que a clarification", { exact: true }).fill("Do I need an exact number?");
  await phone.getByRole("button", { name: "Submit text", exact: true }).click();
  await expect(phone.getByRole("button", { name: "Inspect turn 4", exact: true })).toBeVisible();
  const savedId = await phone.getByLabel("Saved tests", { exact: true }).inputValue();
  await page.reload();
  await expect(page.getByRole("tab", { name: "Test Coaching · no audio" })).toHaveAttribute("aria-selected", "true");
  await phone.locator("summary", { hasText: "Saved tests" }).click();
  await phone.getByLabel("Saved tests", { exact: true }).selectOption(savedId);
  await phone.locator("summary", { hasText: "Saved tests" }).click();
  await expect(phone.getByRole("button", { name: "Inspect turn 4", exact: true })).toBeVisible();
  await phone.getByRole("button", { name: "Inspect turn 1", exact: true }).click();
  await expect(pixel.getByRole("button", { name: "Inspect turn 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(lab.getByRole("heading", { name: "Inspect turn 1", exact: true })).toBeVisible();
  await pixel.getByRole("button", { name: "Inspect turn 4", exact: true }).click();
  await expect(phone.getByRole("button", { name: "Inspect turn 4", exact: true })).toHaveAttribute("aria-pressed", "true");
  await lab.locator("summary", { hasText: "Composed prompt" }).click();
  await expect(lab.getByRole("complementary", { name: "Selected turn inspection" })).toContainText("gpt-5.4-mini");
  const jsonUrl = await lab.getByRole("link", { name: "Export JSON" }).getAttribute("href");
  const json = await (await page.request.get(jsonUrl!)).json();
  expect(json.execution).toBe("simulation"); expect(json.turns).toHaveLength(4);
  expect(json.turns[1].result.inspection.original).toBeTruthy();
  expect(json.turns[1].result.inspection.delivered).toBeTruthy();
  expect(json.turns[1].result.usage.inputTokens).toBe(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(pixel.getByRole("button", { name: "Inspect turn 4", exact: true })).toBeVisible();
  const stage = lab.getByRole("region", { name: "Mobile device previews" });
  await expect(stage.getByRole("complementary")).toHaveCount(0);
  for (const preview of [phone, pixel]) {
    const dimensions = await preview.getByRole("region", { name: "Test conversation" }).evaluate((element) => ({
      height: element.clientHeight, scrollHeight: element.scrollHeight,
      width: element.clientWidth, scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.height).toBeGreaterThan(100);
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.height);
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  }
  await lab.screenshot({ path: testInfo.outputPath("coaching-inspector.png") });
  await page.getByRole("button", { name: "Actual size", exact: true }).click();
  for (const [name, preview] of [["iphone", phone], ["pixel", pixel]] as const) {
    await preview.locator("xpath=ancestor::article").screenshot({ path: testInfo.outputPath(name + "-coaching-frame.png") });
    expect((await preview.getByRole("button", { name: "End test", exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await phone.getByRole("button", { name: "End test", exact: true }).click();
  await expect(phone.getByRole("button", { name: "End test", exact: true })).toBeDisabled();
});

test("typed inspector refuses cross-origin writes and malformed input", async ({ page }) => {
  await signInAsE2EAdmin(page, "/interview/mobile-preview");
  const refused = await page.request.post("/api/admin/interview/coaching-inspector", { headers: { Origin: "https://untrusted.example" }, data: { action: "end", id: "00000000-0000-4000-8000-000000000000" } });
  expect(refused.status()).toBe(403);
  // Invalid payloads cannot create a record or trigger generation.
  const malformed = await page.request.post("/api/admin/interview/coaching-inspector", { data: { action: "turn", id: "invalid" } });
  expect(malformed.status()).toBe(400);
});

test("candidate prompts stay explicit, framed, evidence-visible and reopenable", async ({ page }, testInfo) => {
  await signInAsE2EAdmin(page, "/interview/mobile-preview");
  await page.goto("/interview/mobile-preview");
  const lab = page.getByRole("region", { name: "Typed Coaching inspector" });
  const phone = lab.getByRole("region", { name: "iPhone Coaching test", exact: true });
  const pixel = lab.getByRole("region", { name: "Pixel Coaching test", exact: true });
  await lab.getByRole("combobox", { name: "Prompts for new test", exact: true }).selectOption("candidate_v2");
  await lab.getByRole("combobox", { name: "Question focus", exact: true }).selectOption("technical");
  await phone.getByRole("button", { name: "New Coaching test" }).click();
  await pixel.getByRole("button", { name: "Generate opening question" }).click();
  await expect(phone.getByRole("button", { name: "Inspect turn 1", exact: true })).toBeVisible();
  const answer = "  I reproduced the failure, checked the logs, and isolated a retry bug.  ";
  await phone.getByLabel("Your answer", { exact: true }).fill(answer);
  await pixel.getByRole("button", { name: "Submit text", exact: true }).click();
  await expect(phone.getByRole("button", { name: "Inspect turn 2", exact: true })).toContainText("Simulation fixture only");
  const inspection = lab.getByRole("complementary", { name: "Selected turn inspection" });
  await expect(inspection).toContainText("Semantic quality: unreviewed");
  await inspection.locator("summary", { hasText: "Evidence and priority improvement" }).click();
  await expect(inspection).toContainText('"start": 0');
  const id = await phone.getByLabel("Saved tests", { exact: true }).inputValue();
  const exportUrl = await lab.getByRole("link", { name: "Export JSON" }).getAttribute("href");
  const data = await (await page.request.get(exportUrl!)).json();
  expect(data.snapshot.coachingPromptCandidate.version).toBe(2);
  expect(data.snapshot.questionTypeKey).toBe("technical");
  expect(data.turns[1].result.transcript).toBe(answer);
  expect(data.turns[1].result.candidateFeedback.evidence[0].quote).toBe(answer);
  expect(data.turns[1].result.validation.rawSchemaValid).toBe(true);
  expect(data.turns[1].result.validation.corrected).toBe(false);
  await phone.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(pixel.getByRole("button", { name: "Inspect turn 3", exact: true })).toContainText(data.turns[0].result.question);
  await page.reload();
  await expect(lab.getByRole("combobox", { name: "Prompts for new test", exact: true })).toHaveValue("current");
  await expect(lab.getByRole("combobox", { name: "Execution", exact: true })).toHaveValue("simulation");
  await phone.locator("summary", { hasText: "Saved tests" }).click();
  await phone.getByLabel("Saved tests", { exact: true }).selectOption(id);
  await phone.locator("summary", { hasText: "Saved tests" }).click();
  await pixel.getByRole("button", { name: "Inspect turn 2", exact: true }).click();
  await expect(inspection).toContainText("Semantic quality: unreviewed");
  await lab.screenshot({ path: testInfo.outputPath("candidate-framed-inspector.png") });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await phone.getByRole("button", { name: "End test", exact: true }).click();
  await expect(phone.getByRole("button", { name: "End test", exact: true })).toBeDisabled();
});
