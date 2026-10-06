/**
 * The explorer's front is the sweep's own: for every workload and every
 * pair of the six objectives (and all six at once), the points the site
 * puts on the front are exactly those the sweep flagged.
 */
import { describe, expect, it } from "vitest";

import { SWEEP, slimPoints } from "@/lib/tradeoffs/data";
import { OBJECTIVES, WORKLOADS } from "@/lib/tradeoffs/metrics";
import { cost, frontIndices, pairKey } from "@/lib/tradeoffs/pareto";

describe("Pareto fronts = the sweep's flags", () => {
  const slim = slimPoints();
  for (const w of WORKLOADS) {
    it(`${w}: all fifteen pairs and the six-metric front`, () => {
      const idx = SWEEP.points
        .map((p, i) => [p, i] as const)
        .filter(([p]) => p.workload === w);
      const pts = idx.map(([, i]) => slim[i]!);
      let flagged = 0;
      for (let a = 0; a < OBJECTIVES.length; a++)
        for (let b = a + 1; b < OBJECTIVES.length; b++) {
          const x = OBJECTIVES[a]!;
          const y = OBJECTIVES[b]!;
          const key = pairKey(y, x, OBJECTIVES);
          expect(key).toBe(`${x}|${y}`);
          const ours = new Set(
            frontIndices(pts, [x, y]).map((i) => pts[i]!.id),
          );
          const theirs = new Set(
            idx
              .filter(([p]) => p.pareto[key])
              .map(([p]) => `${p.hardware}:${p.lever}`),
          );
          expect(ours, `${w} ${key}`).toEqual(theirs);
          flagged += theirs.size;
        }
      const all = new Set(frontIndices(pts, OBJECTIVES).map((i) => pts[i]!.id));
      expect(all).toEqual(
        new Set(
          idx
            .filter(([p]) => p.pareto.all)
            .map(([p]) => `${p.hardware}:${p.lever}`),
        ),
      );
      expect(flagged).toBeGreaterThan(15);
    });
  }

  it("missing values are the worst and never on the front", () => {
    expect(cost({ m: { usd_per_mtok: null } }, "usd_per_mtok")).toBe(Infinity);
    expect(
      cost({ m: { goodput_req_s_per_gpu: 2 } }, "goodput_req_s_per_gpu"),
    ).toBe(-2);
    expect(
      frontIndices(
        [
          { m: { usd_per_mtok: null, ttft_p99: 0.1 } },
          { m: { usd_per_mtok: 3, ttft_p99: 1 } },
        ],
        ["usd_per_mtok", "ttft_p99"],
      ),
    ).toEqual([1]);
  });
});
