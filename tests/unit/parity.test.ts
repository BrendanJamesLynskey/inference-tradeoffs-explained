/**
 * Engine parity: the vendored engine against the simulator's Python package
 * at the same commit (fixtures from scripts/tradeoffs_reference.py). For
 * fourteen sweep configurations, run from the point's recorded `js_cfg` on
 * the recorded workload, every request's seven timestamps must be
 * identical, bit for bit (a SHA-256 of the doubles), and so must the
 * summary's latency percentiles and energy.
 */
import { describe, expect, it } from "vitest";

import { engine } from "@/lib/tradeoffs/engine";

import { parity, stampDigest, stampsOf, workload } from "./helpers/load";

describe("vendored engine = Python package, request by request", () => {
  it("covers every lever family, workload and device", () => {
    expect(parity.cases).toHaveLength(14);
    expect(new Set(parity.cases.map((c) => c.workload)).size).toBe(5);
    expect(new Set(parity.cases.map((c) => c.hardware)).size).toBe(3);
  });

  for (const c of parity.cases) {
    it(c.name, () => {
      const res = engine.simulate(c.cfg, workload(c.workload).rows);
      expect(res.reqs).toHaveLength(c.requests);
      expect(res.reqs.slice(0, 5).map(stampsOf)).toEqual(c.first);
      expect(stampDigest(res.reqs)).toBe(c.stamps_sha256);
      const s = engine.summarise(res);
      expect(s.ttft.p50).toBe(c.summary.ttft_p50);
      expect(s.ttft.p99).toBe(c.summary.ttft_p99);
      expect(s.tpot.p99).toBe(c.summary.tpot_p99);
      expect(s.itl.p99).toBe(c.summary.itl_p99);
      expect(s.completed).toBe(c.summary.completed);
      expect(s.energy.totalJ).toBe(c.summary.total_J);
    });
  }
});
