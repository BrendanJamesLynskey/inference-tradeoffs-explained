/**
 * The workload case studies, the hardware chapter and the combining
 * chapter, against the sweep they are built from: the recommendation is
 * the sweep's best point, the device bars and combined bars are its
 * measured values, and every listed sign change is a real one.
 */
import { describe, expect, it } from "vitest";

import {
  COMBINED,
  COMBINE_METRICS,
  best,
  combineCaption,
  combineFrame,
  costCaption,
  deviceBars,
  flips,
  pointsOf,
  ratioScale,
  recommend,
} from "@/lib/tradeoffs/cases";
import { SWEEP } from "@/lib/tradeoffs/data";
import { sign } from "@/lib/tradeoffs/effects";
import { HARDWARE, WORKLOADS } from "@/lib/tradeoffs/metrics";

const labels = Object.fromEntries(
  Object.entries(SWEEP.levers).map(([k, v]) => [k, v.label]),
);

describe("case studies", () => {
  for (const w of WORKLOADS) {
    it(`${w}: the recommendation is the sweep's best point`, () => {
      const r = recommend(w);
      const all = pointsOf(w);
      const g = (p: (typeof all)[number]) => p.metrics.goodput_req_s_per_gpu!;
      expect(g(r.top)).toBe(Math.max(...all.map(g)));
      for (const hw of HARDWARE) {
        expect(r.perDevice[hw].hardware).toBe(hw);
        expect(g(r.perDevice[hw])).toBe(Math.max(...pointsOf(w, hw).map(g)));
      }
      const cheap = pointsOf(w, undefined, "usd_per_mtok");
      expect(r.cheapest.metrics.usd_per_mtok).toBe(
        Math.min(...cheap.map((p) => p.metrics.usd_per_mtok!)),
      );
      expect(r.baseline.lever).toBe("baseline");
      expect(r.baseline.hardware).toBe("h100");
      // every point that is recommended has capacity (meets its SLOs)
      expect(g(r.top)).toBeGreaterThan(0);
    });
    it(`${w}: every listed sign change is real`, () => {
      for (const f of flips(w)) {
        expect(f.here).not.toBe("0");
        expect(
          sign(SWEEP.effects[w].h100![f.lever]!.goodput_req_s_per_gpu),
        ).toBe(f.here);
        expect(f.others.some((o) => o.s !== "0" && o.s !== f.here)).toBe(true);
        expect(f.others).toHaveLength(WORKLOADS.length - 1);
      }
    });
  }
  it("chunked prefill helps chat and hurts the coding agent", () => {
    const f = flips("chat").find((x) => x.lever === "chunked-512")!;
    expect(f.here).toBe("+");
    expect(f.others.find((o) => o.w === "coding-agent")!.s).toBe("-");
    expect(flips("offline-batch").some((x) => x.lever === "prefix-cache")).toBe(
      false,
    );
  });
  it("best() keeps the first of equals", () => {
    const pts = pointsOf("chat", "h100");
    expect(best([pts[0]!, pts[0]!], "goodput_req_s_per_gpu", "max")).toBe(
      pts[0],
    );
    expect(best(pts, "ttft_p99", "min").metrics.ttft_p99).toBe(
      Math.min(...pts.map((p) => p.metrics.ttft_p99!)),
    );
  });
});

describe("hardware and combining frames = the sweep", () => {
  it("device bars", () => {
    for (const w of WORKLOADS) {
      const d = deviceBars(w);
      for (const r of d.rows) {
        const b = SWEEP.points.find(
          (p) =>
            p.workload === w && p.hardware === r.hw && p.lever === "baseline",
        )!;
        expect(r.base.goodput).toBe(b.metrics.goodput_req_s_per_gpu);
        expect(r.base.usd).toBe(b.metrics.usd_per_mtok);
        expect(r.best.goodput).toBe(
          recommend(w).perDevice[r.hw].metrics.goodput_req_s_per_gpu,
        );
      }
    }
    expect(costCaption(deviceBars("chat"), "Chat", labels)).toMatch(
      /^Chat: H100 baseline 1\.42 req\/s per GPU at \$1\.84 per M tokens, best /,
    );
  });
  it("combined bars", () => {
    for (const w of WORKLOADS) {
      const f = combineFrame(w);
      for (const l of COMBINED)
        COMBINE_METRICS.forEach((m, j) =>
          expect(f.rel[l]![j]).toBe(SWEEP.effects[w].h100![l]![m] ?? null),
        );
    }
    expect(
      combineCaption(combineFrame("offline-batch"), "Offline batch", labels),
    ).toBe(
      `Offline batch: goodput per GPU ${labels["modern-colocated"]} +73%, ${labels["modern-disagg"]} +16%, ${labels["modern-spec"]} +95% against the baseline.`,
    );
    expect(
      combineCaption(
        {
          w: "chat",
          rel: {
            "modern-colocated": [null],
            "modern-disagg": [-0.5],
            "modern-spec": [undefined as never],
          },
        },
        "X",
        {},
      ),
    ).toBe(
      "X: goodput per GPU modern-colocated no capacity, modern-disagg −50%, modern-spec no capacity against the baseline.",
    );
  });
  it("the ratio scale: halving and doubling the same length", () => {
    expect(ratioScale(0)).toBe(0);
    expect(ratioScale(1)).toBeCloseTo(-ratioScale(-0.5), 12);
    expect(ratioScale(100)).toBe(1);
    expect(ratioScale(-1)).toBe(-1);
    expect(ratioScale(-0.999)).toBe(-1);
  });
});
