/**
 * Every page renders at desktop and phone widths, in light and dark mode,
 * with no page errors, no console errors and no horizontal overflow.
 */
import { expect, test, type Page } from "@playwright/test";

import { PAGES } from "./pages.list";

async function collectErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

for (const scheme of ["light", "dark"] as const) {
  for (const width of [1280, 390]) {
    test.describe(`${scheme} @ ${width}px`, () => {
      test.use({ colorScheme: scheme, viewport: { width, height: 900 } });
      for (const path of PAGES) {
        test(`${path} renders cleanly`, async ({ page }) => {
          const errors = await collectErrors(page);
          const res = await page.goto(path);
          expect(res?.status()).toBe(200);
          await expect(page.locator("h1").first()).toBeVisible();
          await page.waitForLoadState("networkidle");
          // chapter interactives load after the page: wait for every one
          await expect(page.locator("[data-pending-widget]")).toHaveCount(0);
          const overflow = await page.evaluate(() => {
            const el = document.scrollingElement!;
            return el.scrollWidth - el.clientWidth;
          });
          expect(overflow, "horizontal overflow (px)").toBeLessThanOrEqual(0);
          const bg = await page.evaluate(
            () => getComputedStyle(document.body).backgroundColor,
          );
          expect(bg).toBe(
            scheme === "dark" ? "rgb(10, 10, 10)" : "rgb(255, 255, 255)",
          );
          expect(errors).toEqual([]);
        });
      }
    });
  }
}

test("the seven-way site switch: a row on desktop, a dropdown on phones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const row = page.locator("nav[aria-label='Companion sites']").first();
  await expect(row).toBeVisible();
  for (const l of [
    "Decoder",
    "Inference",
    "Architectures",
    "Kernels",
    "Numerics",
    "Silicon",
    "Trade-offs",
  ])
    await expect(row.getByRole("link", { name: l })).toBeVisible();
  await expect(row.getByRole("link", { name: "Trade-offs" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(row.getByText("(soon)")).toHaveCount(0);
  // the full row still fits at the sm breakpoint
  await page.setViewportSize({ width: 640, height: 800 });
  await expect(row).toBeVisible();
  let overflow = await page.evaluate(
    () =>
      document.scrollingElement!.scrollWidth -
      document.scrollingElement!.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(row).toBeHidden();
  const compact = page.locator("[data-site-switch='compact']");
  await expect(compact).toBeVisible();
  await compact.locator("summary").click();
  const menu = compact.locator("nav");
  await expect(menu.getByRole("link", { name: "Silicon" })).toHaveAttribute(
    "href",
    "https://systolic-arrays-explained.vercel.app",
  );
  await expect(menu.getByRole("link", { name: "Trade-offs" })).toHaveAttribute(
    "href",
    "https://inference-tradeoffs-explained.vercel.app",
  );
  const box = await menu.getByRole("link", { name: "Decoder" }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  overflow = await page.evaluate(
    () =>
      document.scrollingElement!.scrollWidth -
      document.scrollingElement!.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
