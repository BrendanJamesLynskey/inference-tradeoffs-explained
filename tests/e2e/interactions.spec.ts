/**
 * The three tools do what the site says: the explorer's front is the
 * sweep's, hovering shows a configuration and clicking opens it in the live
 * simulator, which reproduces the sweep's numbers; the matrix's workload
 * toggle flips cells and every cell links to its chapter; the what-if
 * re-runs when a lever is toggled.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

type Pt = {
  workload: string;
  hardware: string;
  lever: string;
  pareto: Record<string, boolean>;
};
const sweep = JSON.parse(
  readFileSync(
    join(process.cwd(), "src/lib/tradeoffs/vendor/tradeoffs.json"),
    "utf-8",
  ),
) as { points: Pt[] };
const WORKLOADS = [
  "chat",
  "coding-agent",
  "offline-batch",
  "long-rag",
  "voice",
];

function errors(page: Page): string[] {
  const out: string[] = [];
  page.on("pageerror", (e) => out.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") out.push(`console: ${m.text()}`);
  });
  return out;
}

async function paused(page: Page, id: string) {
  await expect(page.locator("[data-pending-widget]")).toHaveCount(0);
  const fig = page.getByTestId(id);
  await expect(fig).toBeVisible({ timeout: 30_000 });
  if ((await fig.getAttribute("data-playing")) === "true")
    await fig.getByTestId("play").click();
  await expect(fig).toHaveAttribute("data-playing", "false");
  return fig;
}

test("explorer frames: at every workload the drawn front is the sweep's flagged set", async ({
  page,
}) => {
  const errs = errors(page);
  await page.goto("/explore");
  const fig = await paused(page, "explorer");
  for (let i = 0; i < WORKLOADS.length; i++) {
    await fig.getByTestId("scrub").fill(String(i));
    const want = sweep.points
      .filter(
        (p) =>
          p.workload === WORKLOADS[i] &&
          p.pareto["goodput_req_s_per_gpu|ttft_p99"],
      )
      .map((p) => `${p.hardware}:${p.lever}`)
      .sort();
    await expect
      .poll(async () =>
        (
          await fig
            .locator("g[data-front='1']")
            .evaluateAll((els) => els.map((e) => e.getAttribute("data-id")))
        ).sort(),
      )
      .toEqual(want);
    await expect(fig.getByTestId("caption")).toContainText(`${want.length} of`);
  }
  expect(errs).toEqual([]);
});

test("explorer: hover shows the configuration, click re-runs it live and it matches the sweep", async ({
  page,
}) => {
  const errs = errors(page);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/explore");
  const fig = await paused(page, "explorer");
  // a front point not covered by a neighbour (the pointer reaches it)
  const id = await fig.evaluate((el) => {
    for (const g of el.querySelectorAll("g[data-front='1']")) {
      const r = g.getBoundingClientRect();
      const hit = document.elementFromPoint(
        r.x + r.width / 2,
        r.y + r.height / 2,
      );
      if (hit && g.contains(hit)) return g.getAttribute("data-id");
    }
    return null;
  });
  expect(id).not.toBeNull();
  const pt = fig.locator(`g[data-id='${id}']`);
  await pt.hover();
  await expect(fig.getByTestId("explorer-tooltip")).toBeVisible();
  await expect(fig.getByTestId("explorer-tooltip")).toContainText(
    "live simulator",
  );
  await pt.click();
  await expect(page).toHaveURL(
    new RegExp(
      `/what-if\\?w=chat&hw=${id!.split(":")[0]}&lever=${id!.split(":")[1]}`,
    ),
  );
  await expect(page.getByTestId("wi-match-after")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("wi-match-before")).toBeVisible();
  expect(errs).toEqual([]);
});

test("explorer: the SLO filter and the axes re-lay the points", async ({
  page,
}) => {
  await page.goto("/explore");
  const fig = await paused(page, "explorer");
  const before = await fig.getByTestId("caption").textContent();
  await fig.getByRole("radio", { name: "½ × SLO" }).click();
  await expect(fig.getByTestId("caption")).toContainText(
    "within the SLO filter",
  );
  await fig.getByTestId("y-metric").selectOption("usd_per_mtok");
  await expect(fig.getByTestId("caption")).not.toHaveText(before ?? "");
  await expect(fig.getByTestId("caption")).toContainText("$ / M tokens");
});

test("matrix: the workload toggle flips cells, and cells link to their chapter", async ({
  page,
}) => {
  const errs = errors(page);
  await page.goto("/matrix");
  const fig = await paused(page, "matrix");
  const cell = fig.locator("[data-cell='chunked-512|goodput_req_s_per_gpu']");
  await expect(cell).toHaveAttribute("data-verdict", "better");
  await expect(cell).toHaveAttribute(
    "href",
    "/learn/01-batching-and-chunked-prefill#chunked-512",
  );
  await fig.getByRole("radio", { name: "Coding agent" }).click();
  await expect(cell).toHaveAttribute("data-verdict", "worse");
  await expect(cell).toHaveAttribute("data-flip", "1");
  await expect(fig.getByTestId("caption")).toContainText(
    "flip compared with Chat",
  );
  await cell.click();
  await expect(page).toHaveURL(
    /\/learn\/01-batching-and-chunked-prefill#chunked-512$/,
  );
  await expect(page.locator("#chunked-512")).toBeVisible();
  expect(errs).toEqual([]);
});

test("what-if: toggling a lever re-runs both configurations in the worker", async ({
  page,
}) => {
  const errs = errors(page);
  await page.goto("/what-if?w=voice&hw=h200&lever=baseline");
  await expect(page.getByTestId("wi-status")).toContainText("Done", {
    timeout: 30_000,
  });
  await expect(page.getByTestId("wi-change-ttft_p99")).toContainText("+0%");
  await page
    .getByTestId("wi-toggles")
    .getByRole("radio", { name: "MTP γ3" })
    .click();
  await expect(page.getByTestId("wi-status")).toContainText("Done", {
    timeout: 30_000,
  });
  await expect(page.getByTestId("wi-change-tpot_p99")).toContainText("better");
  await expect(page.getByTestId("wi-match-after")).toBeVisible();
  // a combination the simulator does not model is explained, not run
  await page
    .getByTestId("wi-toggles")
    .getByRole("radio", { name: "Paged, swap" })
    .click();
  await page
    .getByTestId("wi-toggles")
    .getByRole("radio", { name: "On" })
    .click();
  await expect(page.getByTestId("wi-issues")).toContainText("swap");
  expect(errs).toEqual([]);
});
