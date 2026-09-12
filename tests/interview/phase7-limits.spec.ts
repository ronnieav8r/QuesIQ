import { expect, test } from "@playwright/test";
import { signInAsE2EAdmin } from "../e2e/support/auth";

test("safety pause mirrors pending save and deferred review without writes", async ({ page }, info) => {
  await signInAsE2EAdmin(page, "/interview/mobile-preview");
  await page.goto("/interview/mobile-preview");
  const writes: string[] = [];
  page.on("request",r => { if(r.method() !== "GET") writes.push(r.url()); });
  await page.getByRole("button",{name:"Live Session",exact:true}).click();
  await page.getByLabel("Simulated session state").selectOption("limit");
  const phones = page.getByRole("region",{name:"Mobile device previews"});
  await expect(phones.getByText("Completed answers are ready to save",{exact:true})).toHaveCount(2);
  await expect(phones.getByText(/saving has not been confirmed/)).toHaveCount(2);
  await expect(phones.getByRole("button",{name:/Unmute|Done answering|Retry response/})).toHaveCount(0);
  await page.setViewportSize({width:1440,height:2200});
  await page.evaluate(()=>window.scrollTo(0,0));
  await phones.screenshot({path:info.outputPath("p7-limit-pending.png")});
  await phones.getByRole("button",{name:"Save completed answers (preview only)"}).nth(1).click();
  await expect(phones.getByText("Saved session · sample",{exact:true})).toHaveCount(2);
  await expect(phones.getByText(/AI review is deferred/)).toHaveCount(2);
  await page.setViewportSize({width:1440,height:1400});
  await page.getByRole("button",{name:"Actual size",exact:true}).click();
  await phones.screenshot({path:info.outputPath("p7-limit-saved.png")});
  for (const card of await phones.locator('[class*="mobilePage"]').all()) expect(await card.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  expect(writes).toEqual([]);
});
