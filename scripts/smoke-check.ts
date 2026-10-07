/**
 * scripts/smoke-check.ts
 *
 * Post-deploy smoke check, adapted from the companion sites'. Fetches every
 * page and the recorded workloads and exits non-zero if any fails:
 *
 *     pnpm smoke https://inference-tradeoffs-explained.vercel.app
 *
 * With no argument it checks http://localhost:3000. For a protected
 * preview deployment, pass the bypass token as VERCEL_BYPASS (sent as the
 * `x-vercel-protection-bypass` header; never printed).
 *
 * Fails when a page is not a 200 (redirects count as failures) or lacks
 * the content that proves it rendered from the data: the landing page must
 * print the sweep's own numbers (looked up here with the same code), every
 * page must carry the two-group site switch with Trade-offs current, and
 * each recorded workload must be served with the vendored commit.
 */
import { CHAPTERS } from "@/lib/tradeoffs/chapters";
import { SCENARIOS } from "@/lib/tradeoffs/mech";
import { VENDORED } from "@/lib/tradeoffs/data";
import { WORKLOADS } from "@/lib/tradeoffs/metrics";
import { formatValue, lookup } from "@/lib/tradeoffs/values";

type Result = { path: string; ok: boolean; detail: string };

const headers: Record<string, string> = process.env.VERCEL_BYPASS
  ? { "x-vercel-protection-bypass": process.env.VERCEL_BYPASS }
  : {};

const SWITCH = [
  'data-site-switch="full"',
  'href="https://agent-harnesses-explained.vercel.app"',
  'href="https://systolic-arrays-explained.vercel.app"',
  'href="https://inference-tradeoffs-explained.vercel.app"',
  'data-site-switch="compact"',
];

const v = (path: string, fmt: Parameters<typeof formatValue>[2]) =>
  `data-v="${path}">${formatValue(path, lookup(path), fmt)}<`;

async function checkPage(
  base: string,
  path: string,
  mustContain: string[],
): Promise<Result> {
  try {
    const res = await fetch(base + path, { redirect: "manual", headers });
    if (res.status !== 200)
      return { path, ok: false, detail: String(res.status) };
    const html = await res.text();
    const missing = mustContain.filter((s) => !html.includes(s));
    if (missing.length)
      return {
        path,
        ok: false,
        detail: `200 but missing ${missing.join(", ")}`,
      };
    return { path, ok: true, detail: "200" };
  } catch (err) {
    return { path, ok: false, detail: (err as Error).message };
  }
}

async function main(): Promise<void> {
  const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
  const checks: Promise<Result>[] = [
    checkPage(base, "/", [
      "Inference Trade-offs Explained",
      v("meta.points", "int"),
      v("effect.chat.h100.chunked-512.goodput_req_s_per_gpu", "signed"),
      "data-pending-widget",
      ...SWITCH,
    ]),
    checkPage(base, "/explore", [
      "Pareto explorer",
      v("meta.points", "int"),
      ...SWITCH,
    ]),
    checkPage(base, "/matrix", ['data-testid="sign-changes"', ...SWITCH]),
    checkPage(base, "/what-if", ["Live what-if", ...SWITCH]),
    checkPage(base, "/method", [
      'id="caveat-pp"',
      'id="caveat-edge"',
      VENDORED.commit.slice(0, 7),
    ]),
    checkPage(base, "/about", ["One number source"]),
    checkPage(
      base,
      "/learn",
      CHAPTERS.map((c) => c.slug),
    ),
    ...CHAPTERS.map((c) =>
      checkPage(base, `/learn/${c.slug}`, [
        c.title,
        "data-pending-widget",
        'id="references"',
        ...SWITCH,
      ]),
    ),
    checkPage(
      base,
      "/workloads",
      WORKLOADS.map((w) => `/workloads/${w}`),
    ),
    ...WORKLOADS.map((w) =>
      checkPage(base, `/workloads/${w}`, [
        'data-testid="recommended"',
        'data-testid="case-flips"',
        ...SWITCH,
      ]),
    ),
    ...[...SCENARIOS, "cost_model"].map((s) =>
      checkPage(base, `/tradeoffs/mechanisms/${s}.json`, [
        `"commit":"${VENDORED.commit}"`,
      ]),
    ),
    ...WORKLOADS.map((w) =>
      checkPage(base, `/tradeoffs/workloads/${w}.json`, [
        `"commit":"${VENDORED.commit}"`,
        `"workload":"${w}"`,
      ]),
    ),
  ];
  const results = await Promise.all(checks);
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? "ok  " : "FAIL"} ${r.path} ${r.detail}`);
  }
  console.log(
    `${results.length - failed}/${results.length} checks passed against ${base}`,
  );
  if (failed) process.exit(1);
}

void main();
