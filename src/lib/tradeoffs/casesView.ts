/**
 * The client-safe half of the case studies and the hardware and combining
 * animations: types, the bar scale and the captions (no sweep data here, so
 * the widgets' bundles stay small; src/lib/tradeoffs/cases.ts builds the
 * frames on the server).
 */
import type { HwKey, MetricKey, WorkloadKey } from "./metrics";

export type DeviceBars = {
  w: WorkloadKey;
  rows: {
    hw: HwKey;
    /** The baseline configuration on this device, and its best lever. */
    base: { goodput: number; usd: number };
    best: { goodput: number; usd: number; lever: string };
  }[];
};

/** The combined configurations' relative change from the H100 baseline on the six objectives. */
export const COMBINED = [
  "modern-colocated",
  "modern-disagg",
  "modern-spec",
] as const;
export const COMBINE_METRICS: readonly MetricKey[] = [
  "goodput_req_s_per_gpu",
  "usd_per_mtok",
  "j_per_tok",
  "ttft_p99",
  "tpot_p99",
  "itl_p99",
];

export type CombineFrame = {
  w: WorkloadKey;
  /** rel[lever][metric]: relative change from the baseline (null: no value). */
  rel: Record<string, (number | null)[]>;
};

/**
 * Bars of relative change on a log scale of the ratio, so halving and
 * doubling are the same length: x = log2(1 + rel) / 6, clamped to ±1
 * (a factor of 64 either way fills the bar; -100% is the full length down).
 */
export function ratioScale(rel: number): number {
  const r = 1 + rel;
  if (r <= 0) return -1;
  return Math.max(-1, Math.min(1, Math.log2(r) / 6));
}

const HWL: Record<HwKey, string> = { h100: "H100", h200: "H200", b200: "B200" };

/** The hardware animation's caption for one workload. */
export function costCaption(
  f: DeviceBars,
  label: string,
  leverLabels: Record<string, string>,
): string {
  return `${label}: ${f.rows
    .map(
      (r) =>
        `${HWL[r.hw]} baseline ${r.base.goodput.toFixed(2)} req/s per GPU at $${r.base.usd.toFixed(2)} per M tokens, best ${leverLabels[r.best.lever] ?? r.best.lever} (${r.best.goodput.toFixed(2)} req/s per GPU)`,
    )
    .join("; ")}.`;
}

/** The combining animation's caption for one workload. */
export function combineCaption(
  f: CombineFrame,
  label: string,
  leverLabels: Record<string, string>,
): string {
  const g = (l: string) => f.rel[l]![0];
  const fmt = (x: number | null | undefined) =>
    x === null || x === undefined
      ? "no capacity"
      : `${x >= 0 ? "+" : "−"}${Math.abs(100 * x).toFixed(0)}%`;
  return `${label}: goodput per GPU ${COMBINED.map((l) => `${leverLabels[l] ?? l} ${fmt(g(l))}`).join(", ")} against the baseline.`;
}
