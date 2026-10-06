/**
 * The vendored files are the simulator's, byte for byte, at the pinned
 * commit, and every fixture and recorded workload was generated at that
 * same commit.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SWEEP, VENDORED } from "@/lib/tradeoffs/data";
import { WORKLOADS } from "@/lib/tradeoffs/metrics";

import { parity, workload } from "./helpers/load";

describe("vendored files", () => {
  it("match the SHA-256 recorded with their commit", () => {
    expect(VENDORED.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(VENDORED.files.map((f) => f.path)).toEqual([
      "web/sim_engine.js",
      "examples/tradeoffs.json",
      "examples/results.md",
    ]);
    for (const f of VENDORED.files) {
      const src = readFileSync(
        join(process.cwd(), "src/lib/tradeoffs/vendor", f.file),
      );
      expect(createHash("sha256").update(src).digest("hex"), f.path).toBe(
        f.sha256,
      );
    }
  });

  it("the sweep is the full grid, recorded from clean code", () => {
    expect(SWEEP.meta.quick).toBe(false);
    expect(SWEEP.meta.simulator_commit).toMatch(/^[0-9a-f]{7}$/);
    expect(SWEEP.points).toHaveLength(350);
    expect(SWEEP.points.every((p) => "metrics" in p)).toBe(true);
  });

  it("fixtures and workloads come from the same commit", () => {
    expect(parity.commit).toBe(VENDORED.commit);
    for (const w of WORKLOADS) {
      const x = workload(w);
      expect(x.commit).toBe(VENDORED.commit);
      expect(x.workload).toBe(w);
      expect(x.rate).toBe(SWEEP.workloads[w].reference_rate);
      expect(x.rows).toHaveLength(x.n);
    }
  });
});
