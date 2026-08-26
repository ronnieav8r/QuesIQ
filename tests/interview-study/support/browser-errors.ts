import { expect, type Page, type TestInfo } from "@playwright/test";

const browserErrors = new WeakMap<Page, string[]>();

export function installBrowserErrorChecks(page: Page) {
  const messages: string[] = [];
  browserErrors.set(page, messages);

  page.on("console", (message) => {
    if (message.type() === "error") {
      if (message.text().startsWith("Failed to load resource:")) {
        return;
      }
      messages.push(`console error: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    messages.push(`page error: ${error.message}`);
  });

  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400) {
      messages.push(`failed response: ${status} ${response.url()}`);
    }
  });
}

export async function expectNoBrowserErrors(page: Page, testInfo: TestInfo) {
  const messages = browserErrors.get(page) ?? [];

  if (messages.length > 0) {
    await testInfo.attach("browser-errors", {
      body: messages.join("\n\n"),
      contentType: "text/plain",
    });
  }

  expect(messages).toEqual([]);
}
