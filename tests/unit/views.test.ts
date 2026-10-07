/**
 * The slim views and props the pages hand the widgets, the chapter
 * catalogue, the metric formats and the edge cases of the pure helpers.
 */
import { describe, expect, it } from "vitest";

import { int, minus, pct, sci, signed, sub, sup, trim } from "@/lib/format";
import { CHAPTERS, chapterOf } from "@/lib/tradeoffs/chapters";
import {
  LEVER_KEYS,
  SWEEP,
  matrixData,
  point,
  slimLevers,
  slimPoints,
  slimWorkloads,
} from "@/lib/tradeoffs/data";
import { runPlain } from "@/lib/tradeoffs/engine";
import {
  caption,
  domainOf,
  layout,
  sloLabel,
  ticks,
  type ExplorerPoint,
} from "@/lib/tradeoffs/explorer";
import {
  fillAt,
  rgbaOf,
  caption as mcaption,
  grid,
  type EffectsTable,
} from "@/lib/tradeoffs/matrix";
import {
  FAMILIES,
  METRICS,
  WORKLOADS,
  WORKLOAD_LABEL,
  type MetricKey,
} from "@/lib/tradeoffs/metrics";
import {
  chapterHrefs,
  explorerProps,
  matrixProps,
  whatIfProps,
} from "@/lib/tradeoffs/props";
import { caption as tcaption, lanes, timeAt } from "@/lib/tradeoffs/timeline";
import { formatValue, lookup } from "@/lib/tradeoffs/values";
import { cell, pctOf } from "@/lib/tradeoffs/effects";

import { workload } from "./helpers/load";

describe("views and props", () => {
  it("slim points carry every point with the drawn metrics", () => {
    const s = slimPoints();
    expect(s).toHaveLength(350);
    expect(new Set(s.map((p) => `${p.w}|${p.id}`)).size).toBe(350);
    expect(s[0]!.m.ttft_p99).toBe(SWEEP.points[0]!.metrics.ttft_p99);
    expect(slimWorkloads().map((w) => w.key)).toEqual([...WORKLOADS]);
    expect(slimLevers()).toHaveLength(LEVER_KEYS.length - 1);
    expect(matrixData()).toBe(SWEEP.effects);
    expect(point("chat", "h100", "baseline")!.lever).toBe("baseline");
    expect(point("chat", "h100", "nope")).toBeUndefined();
  });

  it("every lever links to its family's chapter", () => {
    const h = chapterHrefs();
    for (const k of LEVER_KEYS) {
      const fam = SWEEP.levers[k]!.family;
      const ch = chapterOf(fam);
      expect(h[k]).toBe(ch ? `/learn/${ch.slug}#${k}` : "/learn");
    }
    expect(h.baseline).toBe("/learn");
    expect(
      new Set(CHAPTERS.filter((c) => c.family).map((c) => c.family)),
    ).toEqual(new Set(FAMILIES.filter((f) => f !== "baseline")));
    expect(CHAPTERS.map((c) => c.slug)).toEqual(
      [...CHAPTERS.map((c) => c.slug)].sort(),
    );
  });

  it("props are plain data for the widgets", () => {
    const e = explorerProps();
    expect(e.caveats.map((c) => c.key)).toEqual([
      "pp",
      "tp",
      "paged",
      "edge",
      "price",
      "alpha",
      "b200",
    ]);
    expect(matrixProps("speculative").levers.map((l) => l.key)).toEqual([
      "spec-mtp",
      "spec-1b",
    ]);
    expect(matrixProps().levers).toHaveLength(23);
    const w = whatIfProps();
    expect(w.slos.voice).toEqual({
      ttft: SWEEP.workloads.voice.ttft_slo,
      tpot: SWEEP.workloads.voice.tpot_slo,
    });
    expect(w.leverLabels.baseline).toBe(SWEEP.levers.baseline!.label);
    expect(JSON.parse(JSON.stringify(w))).toEqual(w);
  });

  it("metric formats", () => {
    const want: Record<MetricKey, [number, string]> = {
      goodput_req_s_per_gpu: [1.4204, "1.420"],
      tok_s_per_gpu: [1206.2, "1,206"],
      usd_per_mtok: [1.8412, "$1.84"],
      j_per_tok: [1.151, "1.15 J"],
      ttft_p50: [0.1157, "115.7 ms"],
      ttft_p99: [2.077, "2,077 ms"],
      tpot_p50: [0.026, "26.0 ms"],
      tpot_p99: [0.0333, "33.3 ms"],
      itl_p50: [0.0195, "19.5 ms"],
      itl_p99: [0.2172, "217.2 ms"],
      kv_peak_frac: [0.0237, "2.4%"],
    };
    for (const [k, [v, s]] of Object.entries(want))
      expect(METRICS[k as MetricKey].fmt(v)).toBe(s);
  });

  it("value formats and lookups", () => {
    expect(formatValue("x", "Llama", "int")).toBe("Llama");
    expect(formatValue("x", 1234.4, "int")).toBe("1,234");
    expect(formatValue("x", 0.9, "pct")).toBe("90%");
    expect(formatValue("x", 0.0333, "ms")).toBe("33.3 ms");
    expect(formatValue("x", 3, "usd")).toBe("$3.00");
    expect(formatValue("a.b", 3, "metric")).toBe("3");
    expect(formatValue("x", 0.7, "raw")).toBe("0.7");
    expect(formatValue("x", 350, "num")).toBe("350");
    expect(formatValue("x", 1.23456, "num")).toBe("1.235");
    expect(lookup("workload.chat.ttft_slo")).toBe(1);
    expect(lookup("price.b200")).toBe(5);
    expect(lookup("point.chat.h100.baseline.ttft_p99")).toBe(
      SWEEP.points.find(
        (p) =>
          p.workload === "chat" &&
          p.hardware === "h100" &&
          p.lever === "baseline",
      )!.metrics.ttft_p99,
    );
    for (const k of [
      "model",
      "commit",
      "sweep_commit",
      "generated",
      "workers",
      "seed",
      "alpha",
      "slo_target",
      "gpus",
      "devices",
      "workloads",
    ])
      expect(lookup(`meta.${k}`)).toBeDefined();
    expect(() => lookup("meta.nope")).toThrow();
    expect(() => lookup("workload.chat.nope")).toThrow();
    expect(() => lookup("price.x")).toThrow();
    expect(() => lookup("point.chat.h100.nope.ttft_p99")).toThrow();
  });

  it("format helpers", () => {
    expect(sup(-12)).toBe("⁻¹²");
    expect(minus("-3")).toBe("−3");
    expect(trim(0)).toBe("0");
    expect(trim(Infinity)).toBe("∞");
    expect(trim(-Infinity)).toBe("−∞");
    expect(trim(NaN)).toBe("NaN");
    expect(trim(1234.5678)).toBe("1,235");
    expect(trim(6.1e-5)).toBe("6.1 × 10⁻⁵");
    expect(sci(0)).toBe("0");
    expect(pct(0.256, 1)).toBe("25.6%");
    expect(int(1234567)).toBe("1,234,567");
    expect(sub(2, 1)).toBe("₂₁");
    expect(sub(12, 1)).toBe("₁₂,₁");
    expect(signed(-3)).toBe("(−3)");
    expect(signed(3)).toBe("3");
  });
});

describe("edge cases of the pure helpers", () => {
  const p = (id: string, v: number | null): ExplorerPoint => ({
    id,
    w: "chat",
    hw: "h100",
    lever: id,
    fam: "batching",
    label: id,
    m: { goodput_req_s_per_gpu: v, ttft_p99: v },
  });
  it("domains and ticks", () => {
    expect(domainOf([p("a", null)], "ttft_p99")).toEqual({ lo: 0, hi: 1 });
    const d = domainOf([p("a", 10)], "ttft_p99");
    expect(d.hi - d.lo).toBeCloseTo(1.12, 9);
    expect(ticks({ lo: -6.2, hi: 6.2 }, 4).length).toBeLessThanOrEqual(4);
    expect(sloLabel(Infinity)).toBe("Any");
    expect(sloLabel(0.5)).toBe("½ × SLO");
    expect(sloLabel(2)).toBe("2 × SLO");
  });
  it("captions when one point is best on both", () => {
    const pts = [p("a", 1), p("b", null)];
    const slos = [
      { key: "chat" as const, label: "Chat", ttftSlo: 1, tpotSlo: 1 },
    ];
    const st = {
      workload: "chat" as const,
      x: "ttft_p99" as const,
      y: "ttft_p50" as const,
      hw: ["h100" as const],
      slo: 0.5,
    };
    pts[0]!.m.ttft_p50 = 1;
    const dims = { w: 100, h: 100, left: 0, right: 0, top: 0, bottom: 0 };
    const l = layout(pts, slos, st, dims, {
      x: { lo: -1, hi: 1 },
      y: { lo: -1, hi: 1 },
    });
    expect(l.missing).toBe(1);
    expect(caption(l, null, pts, { ...st, slo: Infinity }, "Chat")).toMatch(
      /0 of 1 configurations/,
    );
    const l2 = layout(pts, slos, { ...st, slo: Infinity }, dims, {
      x: { lo: -1, hi: 1 },
      y: { lo: -1, hi: 1 },
    });
    expect(caption(l2, null, pts, st, "Chat")).toMatch(
      /a on H100 is best on both/,
    );
  });
  it("matrix: fading to and from no value, and a caption with no flips", () => {
    expect(rgbaOf(cell(0.01, "ttft_p99"))).toEqual([163, 163, 163, 0.12]);
    expect([pctOf(0.02), pctOf(0.5)]).toEqual(["2%", "50%"]);
    const none = cell(null, "usd_per_mtok");
    const good = cell(-0.6, "usd_per_mtok");
    expect(fillAt(none, good, 0)).toBe("rgba(0, 114, 178, 0.000)");
    expect(fillAt(good, none, 1)).toBe("rgba(0, 114, 178, 0.000)");
    const g = grid(
      SWEEP.effects as unknown as EffectsTable,
      slimLevers(),
      ["goodput_req_s_per_gpu"],
      "chat",
      "h100",
      null,
    );
    expect(
      mcaption(g, slimLevers(), "chat", null, WORKLOAD_LABEL, "H100"),
    ).not.toMatch(/flip/);
  });
  it("timeline: one-step clocks and a hand-off caption", () => {
    const rows = workload("chat").rows;
    const run = runPlain(
      {
        ...SWEEP.points.find(
          (q) =>
            q.workload === "chat" &&
            q.hardware === "h100" &&
            q.lever === "disagg-1p1d",
        )!.js_cfg,
      },
      rows,
    );
    const l = lanes(run.reqs, run.reqs);
    expect(timeAt(l, 0, 1)).toBe(l.t1);
    expect(run.metrics.stages.kv_transfer).toBeGreaterThan(0);
    const mid = [...Array(2000).keys()].map((s) => tcaption(l, s, 2000));
    expect(mid.some((c) => /in hand-off/.test(c))).toBe(true);
    expect(lanes([], [], 3)).toMatchObject({ ids: [], t0: 0, t1: 0 });
  });
});
