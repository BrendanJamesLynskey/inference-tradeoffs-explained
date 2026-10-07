/**
 * Captures the README screenshots. Manual run, output committed.
 *
 *   pnpm build && pnpm start   # in another shell
 *   pnpm screenshots           # headless Chromium writes docs/screenshots/*.png
 *
 * Light theme, fixed viewport, reduced motion (nothing plays by itself), and
 * each animation set to a chosen mid-animation frame by its scrub bar, so
 * the pictures are reproducible.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const OUT = path.join(process.cwd(), "docs", "screenshots");
const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";

type Shot = { name: string; path: string; widget?: string; step?: number };

const SHOTS: Shot[] = [
  { name: "01-landing", path: "/" },
  { name: "02-explorer", path: "/explore", widget: "explorer", step: 4 },
  { name: "03-matrix", path: "/matrix", widget: "matrix", step: 1 },
  {
    name: "04-lever-page",
    path: "/learn/01-batching-and-chunked-prefill",
    widget: "lever-matrix",
    step: 1,
  },
  {
    name: "05-what-if",
    path: "/what-if?w=chat&hw=h100&lever=modern-colocated",
  },
  {
    name: "06-timeline",
    path: "/what-if?w=chat&hw=h100&lever=modern-colocated",
    widget: "timeline",
    step: 30,
  },
  { name: "07-method", path: "/method" },
  {
    name: "08-chapter-batching",
    path: "/learn/01-batching-and-chunked-prefill",
    widget: "mech-batching",
    step: 4,
  },
  {
    name: "09-chapter-kv",
    path: "/learn/02-paged-kv-and-preemption",
    widget: "mech-kv",
    step: 30,
  },
  {
    name: "10-chapter-pools",
    path: "/learn/04-disaggregation",
    widget: "mech-pools",
    step: 20,
  },
  {
    name: "11-chapter-speculative",
    path: "/learn/10-speculative-decoding",
    widget: "mech-spec",
    step: 5,
  },
  { name: "12-case-study", path: "/workloads/coding-agent" },
];

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  for (const s of SHOTS) {
    await page.goto(BASE + s.path, { waitUntil: "networkidle" });
    const file = path.join(OUT, `${s.name}.png`);
    if (s.widget) {
      const fig = page.getByTestId(s.widget);
      await fig.waitFor({ timeout: 60_000 });
      if (s.step !== undefined)
        await fig.getByTestId("scrub").fill(String(s.step));
      await fig.screenshot({ path: file });
    } else {
      await page.screenshot({ path: file });
    }
    console.log(`wrote ${path.relative(process.cwd(), file)}`);
  }
  await browser.close();
}

void main();
