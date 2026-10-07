/**
 * The workload case studies and the hardware chapter, as pure functions of
 * the vendored sweep: the recommended configuration under each workload's
 * SLOs (the most goodput per GPU, which is capacity at >= 90% SLO
 * attainment, so it meets the SLOs by construction; and the cheapest per
 * million output tokens), what each device buys, and the levers whose
 * effect changes sign in this workload against the others.
 */
import { SWEEP, type SweepPoint } from "./data";
import {
  COMBINED,
  COMBINE_METRICS,
  type CombineFrame,
  type DeviceBars,
} from "./casesView";
import { sign } from "./effects";
import {
  HARDWARE,
  WORKLOADS,
  type HwKey,
  type MetricKey,
  type WorkloadKey,
} from "./metrics";

const val = (p: SweepPoint, m: MetricKey): number | null => {
  const v = p.metrics[m];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

/** The points of one workload (optionally one device) with a value of the metric. */
export function pointsOf(
  w: WorkloadKey,
  hw?: HwKey,
  metric: MetricKey = "goodput_req_s_per_gpu",
): SweepPoint[] {
  return SWEEP.points.filter(
    (p) =>
      p.workload === w &&
      (!hw || p.hardware === hw) &&
      val(p, metric) !== null &&
      // a configuration that never meets the SLOs has no capacity
      (val(p, "goodput_req_s_per_gpu") ?? 0) > 0,
  );
}

/** The best point by a metric (its own direction), ties to the first. */
export function best(
  points: readonly SweepPoint[],
  metric: MetricKey,
  dir: "max" | "min",
): SweepPoint {
  let b = points[0]!;
  for (const p of points.slice(1)) {
    const a = val(p, metric)!;
    const c = val(b, metric)!;
    if (dir === "max" ? a > c : a < c) b = p;
  }
  return b;
}

export type Recommendation = {
  /** Most goodput per GPU on any device, and on each device. */
  top: SweepPoint;
  perDevice: Record<HwKey, SweepPoint>;
  /** Cheapest per million output tokens. */
  cheapest: SweepPoint;
  /** The H100 baseline, for comparison. */
  baseline: SweepPoint;
};

export function recommend(w: WorkloadKey): Recommendation {
  const perDevice = {} as Record<HwKey, SweepPoint>;
  for (const hw of HARDWARE)
    perDevice[hw] = best(pointsOf(w, hw), "goodput_req_s_per_gpu", "max");
  return {
    top: best(pointsOf(w), "goodput_req_s_per_gpu", "max"),
    perDevice,
    cheapest: best(
      pointsOf(w, undefined, "usd_per_mtok"),
      "usd_per_mtok",
      "min",
    ),
    baseline: SWEEP.points.find(
      (p) =>
        p.workload === w && p.hardware === "h100" && p.lever === "baseline",
    )!,
  };
}

export type Flip = {
  lever: string;
  here: "+" | "-" | "0";
  /** The sign in each other workload, in WORKLOADS order. */
  others: { w: WorkloadKey; s: "+" | "-" | "0" }[];
};

/**
 * Levers whose effect on a metric (H100) points one way in this workload
 * and the other way in at least one other workload.
 */
export function flips(
  w: WorkloadKey,
  metric: MetricKey = "goodput_req_s_per_gpu",
): Flip[] {
  const out: Flip[] = [];
  const levers = Object.keys(SWEEP.levers).filter(
    (k) => k !== "baseline" && !SWEEP.levers[k]!.hardware,
  );
  for (const lever of levers) {
    const here = sign(SWEEP.effects[w].h100?.[lever]?.[metric]);
    if (here === "0") continue;
    const others = WORKLOADS.filter((x) => x !== w).map((x) => ({
      w: x,
      s: sign(SWEEP.effects[x].h100?.[lever]?.[metric]),
    }));
    if (others.some((o) => o.s !== "0" && o.s !== here))
      out.push({ lever, here, others });
  }
  return out;
}

/** What each device buys on one workload: baseline and best lever, goodput per GPU and $/M. */
export function deviceBars(w: WorkloadKey): DeviceBars {
  return {
    w,
    rows: HARDWARE.map((hw) => {
      const b = SWEEP.points.find(
        (p) => p.workload === w && p.hardware === hw && p.lever === "baseline",
      )!;
      const top = best(pointsOf(w, hw), "goodput_req_s_per_gpu", "max");
      return {
        hw,
        base: {
          goodput: val(b, "goodput_req_s_per_gpu") ?? 0,
          usd: val(b, "usd_per_mtok") ?? 0,
        },
        best: {
          goodput: val(top, "goodput_req_s_per_gpu")!,
          usd: val(top, "usd_per_mtok")!,
          lever: top.lever,
        },
      };
    }),
  };
}

export function combineFrame(w: WorkloadKey): CombineFrame {
  const rel: Record<string, (number | null)[]> = {};
  for (const l of COMBINED)
    rel[l] = COMBINE_METRICS.map(
      (m) => SWEEP.effects[w].h100?.[l]?.[m] ?? null,
    );
  return { w, rel };
}

export {
  COMBINED,
  COMBINE_METRICS,
  combineCaption,
  costCaption,
  ratioScale,
  type CombineFrame,
  type DeviceBars,
} from "./casesView";
