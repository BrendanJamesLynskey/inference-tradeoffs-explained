/**
 * The live what-if re-runs the sweep: for every one of the 350 points, the
 * vendored engine, given the point's recorded configuration and the
 * recorded workload, reproduces the point's reference-load latency
 * percentiles exactly. (About a minute: 350 simulations.)
 */
import { describe, expect, it } from "vitest";

import { SWEEP } from "@/lib/tradeoffs/data";
import { engine } from "@/lib/tradeoffs/engine";
import { WORKLOADS } from "@/lib/tradeoffs/metrics";

import { workload } from "./helpers/load";

describe("every sweep point, re-run in the browser's engine", () => {
  for (const w of WORKLOADS) {
    it(`${w}: TTFT, TPOT and ITL p50 and p99 identical`, () => {
      const rows = workload(w).rows;
      const pts = SWEEP.points.filter((p) => p.workload === w);
      expect(pts.length).toBe(70);
      for (const p of pts) {
        const s = engine.summarise(engine.simulate(p.js_cfg, rows));
        const got = [
          s.ttft.p50,
          s.ttft.p99,
          s.tpot.p50,
          s.tpot.p99,
          s.itl.p50,
          s.itl.p99,
        ];
        const want = [
          "ttft_p50",
          "ttft_p99",
          "tpot_p50",
          "tpot_p99",
          "itl_p50",
          "itl_p99",
        ].map((k) => p.metrics[k]);
        expect(got, `${p.hardware}/${p.lever}`).toEqual(want);
      }
    }, 300_000);
  }
});
