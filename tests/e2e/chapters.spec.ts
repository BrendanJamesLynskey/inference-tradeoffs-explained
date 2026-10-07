/**
 * The chapters and case studies: each chapter's mechanism animation shows
 * the simulator's recorded state (its caption at a step is the caption the
 * unit tests derive from the Python record), a parameter change re-runs
 * it, every chapter cites its papers and links the family's sites, the
 * case studies recommend the sweep's best configuration, and every option
 * button is a 44 px touch target on a phone.
 */
import { expect, test, type Locator } from "@playwright/test";

async function pauseAt(fig: Locator, step: number): Promise<void> {
  if ((await fig.getAttribute("data-playing")) === "true")
    await fig.getByTestId("play").click();
  await fig.getByTestId("scrub").fill(String(step));
  await expect(fig).toHaveAttribute("data-step", String(step));
}

test("chapter 1: a frame's caption is the simulator's step, and the policy re-runs the animation", async ({
  page,
}) => {
  await page.goto("/learn/01-batching-and-chunked-prefill");
  const fig = page.getByTestId("mech-batching");
  await expect(fig).toBeVisible({ timeout: 30_000 });
  const key = await fig.getAttribute("data-key");
  await fig.getByRole("radio", { name: "Chunked, 512-token budget" }).click();
  await expect(fig).not.toHaveAttribute("data-key", key ?? "");
  await pauseAt(fig, 1);
  // the same caption the unit test pins from the Python record (mech.test.ts)
  await expect(fig.getByTestId("caption")).toHaveText(
    "Step 2 at 25.5 ms takes 43.2 ms: 1 decode row and 511 prompt tokens; 1 request waiting. The decode rows waited up to 43.2 ms for this token.",
  );
});

test("chapter 2: preemptions appear only with paged KV", async ({ page }) => {
  await page.goto("/learn/02-paged-kv-and-preemption");
  const fig = page.getByTestId("mech-kv");
  await expect(fig).toBeVisible({ timeout: 30_000 });
  const scrub = fig.getByTestId("scrub");
  const max = Number(await scrub.getAttribute("max"));
  await pauseAt(fig, max);
  await expect(fig.getByTestId("caption")).not.toContainText("preemption");
  await fig
    .getByRole("radio", { name: "Paged blocks, preempt by recompute" })
    .click();
  await pauseAt(fig, max);
  await expect(fig.getByTestId("caption")).toContainText("preemptions so far");
});

test("chapter 8: the ring re-runs for the TP degree chosen", async ({
  page,
}) => {
  await page.goto("/learn/08-tp-pp-ep");
  const fig = page.getByTestId("mech-ring");
  await expect(fig).toBeVisible({ timeout: 30_000 });
  await fig.getByRole("radio", { name: "TP8" }).click();
  const max = Number(await fig.getByTestId("scrub").getAttribute("max"));
  expect(max).toBe(14);
  await pauseAt(fig, max);
  await expect(fig.getByTestId("caption")).toContainText(
    "64 of 64 chunk copies are complete",
  );
});

test("every chapter cites its sources and links the family", async ({
  page,
}) => {
  await page.goto("/learn");
  const links = page.locator("main ol a[href^='/learn/']");
  await expect(links).toHaveCount(13);
  for (const href of await links.evaluateAll((as) =>
    as.map((a) => a.getAttribute("href")!),
  )) {
    await page.goto(href);
    await expect(page.locator("#references li").first()).toBeVisible();
    const family = await page
      .locator("main a[href*='-explained.vercel.app']")
      .count();
    expect(family, `${href} links a family site`).toBeGreaterThan(0);
  }
});

test("a case study recommends the sweep's best configuration", async ({
  page,
}) => {
  await page.goto("/workloads/chat");
  const rec = page.getByTestId("recommended");
  await expect(rec.locator("tr").first()).toContainText("Most goodput per GPU");
  await expect(rec.locator("tr").first()).toContainText("on B200");
  await expect(
    page.getByTestId("case-flips").locator("tr").first(),
  ).toBeVisible();
});

test.describe("touch targets on a phone", () => {
  test.use({ viewport: { width: 390, height: 900 } });
  for (const path of ["/what-if", "/explore", "/learn/09-quantisation"]) {
    test(`${path}: every option is at least 44 px tall`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("[data-pending-widget]")).toHaveCount(0, {
        timeout: 30_000,
      });
      const heights = await page
        .locator("[role='radiogroup'] [role='radio']")
        .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      expect(heights.length).toBeGreaterThan(0);
      expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
    });
  }
});
