/**
 * The explorer's frames (visual standard §4: key frames checked against the
 * reference). The reference here is the sweep's own Pareto flags: at t = 1
 * the layout's front is the flagged set, for three workloads; at t = 0 a
 * frame is the previous layout; in between, positions are eased.
 */
import { describe, expect, it } from "vitest";

import { SWEEP, slimPoints, slimWorkloads } from "@/lib/tradeoffs/data";
import {
  caption,
  domainOf,
  ease,
  frame,
  layout,
  passes,
  project,
  ticks,
  type Dims,
  type ExplorerState,
} from "@/lib/tradeoffs/explorer";
import { HARDWARE } from "@/lib/tradeoffs/metrics";

const points = slimPoints();
const slos = slimWorkloads();
const dims: Dims = { w: 640, h: 400, left: 60, right: 10, top: 10, bottom: 40 };
const domains = {
  x: domainOf(points, "goodput_req_s_per_gpu"),
  y: domainOf(points, "ttft_p99"),
};
const st = (
  workload: ExplorerState["workload"],
  slo = Infinity,
): ExplorerState => ({
  workload,
  x: "goodput_req_s_per_gpu",
  y: "ttft_p99",
  hw: HARDWARE,
  slo,
});

describe("axes", () => {
  it("log domains cover every workload, padded", () => {
    const vals = points.map((p) => p.m.ttft_p99!).filter((v) => v > 0);
    expect(domains.y.lo).toBeLessThan(Math.log10(Math.min(...vals)));
    expect(domains.y.hi).toBeGreaterThan(Math.log10(Math.max(...vals)));
    expect(project(10 ** domains.x.lo, domains.x, 0, 100)).toBeCloseTo(0, 9);
    expect(project(10 ** domains.x.hi, domains.x, 0, 100)).toBeCloseTo(100, 9);
  });
  it("ticks are 1-2-5 values inside the domain, decades when crowded", () => {
    expect(ticks({ lo: -1.1, hi: 1.1 })).toEqual([0.1, 0.2, 0.5, 1, 2, 5, 10]);
    expect(ticks({ lo: -2.2, hi: 3.2 })).toEqual([0.01, 0.1, 1, 10, 100, 1000]);
  });
});

describe("key frames", () => {
  for (const w of ["chat", "long-rag", "voice"] as const) {
    it(`${w}: the front at t = 1 is the sweep's flagged set`, () => {
      const l = layout(points, slos, st(w), dims, domains);
      const flagged = SWEEP.points
        .filter(
          (p) => p.workload === w && p.pareto["goodput_req_s_per_gpu|ttft_p99"],
        )
        .map((p) => `${p.hardware}:${p.lever}`)
        .sort();
      expect([...l.frontIds].sort()).toEqual(flagged);
      const f = frame(null, l, 0);
      expect(
        f.pts
          .filter((p) => p.front === 1)
          .map((p) => p.id)
          .sort(),
      ).toEqual(flagged);
      // the drawn points are this workload's, minus those with no capacity
      expect(l.pts.size + l.missing).toBe(70);
    });
  }

  it("t = 0 is the old layout, t = 1 the new one, eased in between", () => {
    const a = layout(points, slos, st("chat"), dims, domains);
    const b = layout(points, slos, st("voice"), dims, domains);
    const id = [...a.pts.keys()].find((k) => b.pts.has(k))!;
    const at = (t: number) => frame(a, b, t).pts.find((p) => p.id === id)!;
    expect([at(0).px, at(0).py]).toEqual([
      a.pts.get(id)!.px,
      a.pts.get(id)!.py,
    ]);
    expect([at(1).px, at(1).py]).toEqual([
      b.pts.get(id)!.px,
      b.pts.get(id)!.py,
    ]);
    const mid =
      a.pts.get(id)!.px + (b.pts.get(id)!.px - a.pts.get(id)!.px) * ease(0.5);
    expect(at(0.5).px).toBeCloseTo(mid, 9);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(frame(a, b, 0.25).fromLine).toEqual(a.frontLine);
  });

  it("the SLO filter keeps only points within s × the SLOs, and the front re-forms among them", () => {
    const l = layout(points, slos, st("chat", 1), dims, domains);
    const chat = slos.find((s) => s.key === "chat")!;
    for (const p of points.filter((q) => q.w === "chat" && l.pts.has(q.id)))
      expect(l.pts.get(p.id)!.pass).toBe(
        p.m.ttft_p99! <= chat.ttftSlo && p.m.tpot_p99! <= chat.tpotSlo,
      );
    for (const id of l.frontIds) expect(l.pts.get(id)!.pass).toBe(true);
    expect(passes(points[0]!, chat, Infinity)).toBe(true);
  });

  it("captions name the front and what changed", () => {
    const a = layout(points, slos, st("chat"), dims, domains);
    const b = layout(points, slos, st("voice"), dims, domains);
    const c = caption(b, a, points, st("voice"), "Real-time voice");
    expect(c).toMatch(
      new RegExp(
        `^Real-time voice: ${b.frontIds.length} of ${b.pts.size} configurations`,
      ),
    );
    expect(c).toMatch(/joined the front/);
  });
});
