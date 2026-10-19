/**
 * Brief 44, the learning layer: a self-check waits for a committed answer,
 * then reveals the model's value and says whether the guess was right; a
 * choice and a slider work from the keyboard; with no JavaScript the answer
 * is still one click away (a native <details>); axe finds nothing serious
 * with every answer of a chapter revealed, at 390 px in dark mode.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { numericAnswer } from "@/lib/learn/answer";

async function check(page: Page, id: string) {
  const box = page.locator(`[data-self-check="${id}"]`);
  await expect(box).toBeVisible();
  return box;
}

test("ch 4: the reveal waits for an answer, then shows the recorded value", async ({
  page,
}) => {
  await page.goto("/learn/04-disaggregation");
  await expect(page.locator("[data-check-yourself-link]")).toHaveAttribute(
    "href",
    "#check-yourself",
  );
  const box = await check(page, "t04-q1");
  const summary = box.locator("summary");
  const details = box.locator("details");
  await summary.click();
  await expect(details).not.toHaveAttribute("open", "");
  await expect(box).toContainText("Commit to an answer first");
  const want = numericAnswer("mech|pools|1p1d|itl_p99", "ms");
  await box.getByRole("spinbutton").fill("500");
  await summary.click();
  await expect(details).toHaveAttribute("open", "");
  await expect(box.locator("[data-answer]")).toHaveText(
    `${want.display}${want.unit}`,
  );
  await expect(box.locator("[data-verdict]")).toHaveAttribute(
    "data-verdict",
    "wrong",
  );
  await box.getByRole("spinbutton").fill(String(want.value));
  await expect(box.locator("[data-verdict]")).toHaveAttribute(
    "data-verdict",
    "right",
  );
  const q2 = await check(page, "t04-q2");
  await q2.getByLabel("It rises").check();
  await q2.locator("summary").press("Enter");
  await expect(q2.locator("[data-verdict]")).toHaveAttribute(
    "data-verdict",
    "right",
  );
});

test("ch 3: the hit-rate slider, by keyboard", async ({ page }) => {
  await page.goto("/learn/03-prefix-caching");
  const box = await check(page, "t03-q1");
  const want = numericAnswer("mech|prefix|on|hit_rate", "pct");
  const slider = box.getByRole("slider");
  await slider.focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < want.value; i++) await page.keyboard.press("ArrowRight");
  await expect(box.locator("output")).toHaveText(`${want.value}%`);
  await box.locator("summary").press("Enter");
  await expect(box.locator("[data-answer]")).toHaveText(`${want.display}%`);
  await expect(box.locator("[data-verdict]")).toHaveAttribute(
    "data-verdict",
    "right",
  );
});

test("axe: nothing serious with every answer revealed (390 px, dark)", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 390, height: 900 },
  });
  const page = await ctx.newPage();
  await page.goto("/learn/13-combining-levers");
  for (const id of ["t13-q1", "t13-q2", "t13-q3"]) {
    const box = await check(page, id);
    const slider = box.getByRole("slider");
    if (await slider.count()) {
      await slider.focus();
      await page.keyboard.press("ArrowRight");
    } else if (await box.getByRole("spinbutton").count()) {
      await box.getByRole("spinbutton").fill("4");
    } else {
      await box.getByRole("radio").first().check();
    }
    await box.locator("summary").click();
    await expect(box.locator("details")).toHaveAttribute("open", "");
  }
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const results = await new AxeBuilder({ page })
    .include("#check-yourself")
    .include("[data-remember]")
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  await ctx.close();
});

test("with no JavaScript the question and the answer are in the page", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("/learn/01-batching-and-chunked-prefill");
  const box = page.locator('[data-self-check="t01-q1"]');
  await expect(box).toContainText("makes newcomers wait");
  await box.locator("summary").click();
  await expect(box.locator("[data-answer]")).toContainText("Decode-priority");
  await expect(page.locator("[data-remember]")).toContainText(
    "What to remember",
  );
  await ctx.close();
});

test("the landing page links the Inference track start page", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("[data-track-start] a")).toHaveAttribute(
    "href",
    "https://llm-inference-explained.vercel.app/inference",
  );
});
