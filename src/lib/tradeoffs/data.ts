/**
 * The site's single number source: Disaggregated_Inference_Sim's recorded
 * trade-off sweep, `vendor/tradeoffs.json`, vendored byte for byte at the
 * commit in `vendor/VENDORED.json` (`pnpm vendor`). Every configuration is
 * the same 8 GPUs serving Llama-3-70B; the baseline is two colocated
 * instances of TP4, prefill-priority batching, reserved KV and BF16, and
 * each lever changes that.
 *
 * Server-side only (pages and tests): the JSON is about 1 MB. Pages hand
 * the client widgets the slim views built here (`slimPoints`, `matrixData`).
 */
import sweepJson from "./vendor/tradeoffs.json";
import vendored from "./vendor/VENDORED.json";

import {
  HARDWARE,
  WORKLOADS,
  type Family,
  type HwKey,
  type MetricKey,
  type WorkloadKey,
} from "./metrics";

export type JsConfig = Record<string, unknown> & {
  model: string;
  device: HwKey;
  mode: "colocated" | "disagg";
  ttftSlo: number;
  tpotSlo: number;
};

export type SweepPoint = {
  workload: WorkloadKey;
  hardware: HwKey;
  lever: string;
  family: Family;
  label: string;
  metrics: Record<string, number | null | undefined>;
  js_cfg: JsConfig;
  pareto: Record<string, boolean>;
};

export type WorkloadInfo = {
  label: string;
  ttft_slo: number;
  tpot_slo: number;
  turns: number;
  session_s_estimate: number | null;
  think: number;
  system_prompts: number;
  system_len: number;
  prompt_mean: number;
  prompt_cv: number;
  output_mean: number;
  output_cv: number;
  reference_rate: number;
  rationale: string;
};

export type HardwareInfo = {
  name: string;
  usd_per_gpu_hour: number;
  bf16_tflops: number;
  hbm_tb_s: number;
  hbm_gb: number;
  native_formats: Record<string, number>;
};

export type LeverInfo = {
  family: Family;
  label: string;
  hardware: HwKey[] | null;
};

export type Sweep = {
  meta: {
    generated: string;
    simulator_commit: string;
    model: string;
    gpus: number;
    requests_per_run: number;
    sessions_min: number;
    window_sessions: number;
    seed: number;
    slo_target: number;
    capacity_tolerance: number;
    speculative_alpha: number;
    usd_per_gpu_hour: Record<HwKey, number>;
    objectives: Record<string, "max" | "min">;
    workers: number;
    wall_s: number;
    quick: boolean;
    notes: string[];
  };
  workloads: Record<WorkloadKey, WorkloadInfo>;
  hardware: Record<HwKey, HardwareInfo>;
  levers: Record<string, LeverInfo>;
  points: SweepPoint[];
  effects: Record<
    WorkloadKey,
    Record<HwKey, Record<string, Record<string, number | null>>>
  >;
};

export const SWEEP = sweepJson as unknown as Sweep;
export const VENDORED = vendored as {
  repository: string;
  commit: string;
  committed: string;
  files: { path: string; file: string; sha256: string }[];
};

/** The levers in the sweep's order (the baseline first). */
export const LEVER_KEYS: string[] = Object.keys(SWEEP.levers);

/** A point by its coordinates. */
export function point(
  w: WorkloadKey,
  hw: HwKey,
  lever: string,
): SweepPoint | undefined {
  return SWEEP.points.find(
    (p) => p.workload === w && p.hardware === hw && p.lever === lever,
  );
}

/** One configuration as the client widgets see it. */
export type SlimPoint = {
  /** `${hw}:${lever}`: the same id in every workload (for animating). */
  id: string;
  w: WorkloadKey;
  hw: HwKey;
  lever: string;
  fam: Family;
  label: string;
  m: Partial<Record<MetricKey, number | null>>;
};

const SLIM_KEYS: MetricKey[] = [
  "goodput_req_s_per_gpu",
  "tok_s_per_gpu",
  "usd_per_mtok",
  "j_per_tok",
  "ttft_p50",
  "ttft_p99",
  "tpot_p50",
  "tpot_p99",
  "itl_p50",
  "itl_p99",
  "kv_peak_frac",
];

/** Every point, with only the metrics the widgets draw. */
export function slimPoints(): SlimPoint[] {
  return SWEEP.points.map((p) => {
    const m: Partial<Record<MetricKey, number | null>> = {};
    for (const k of SLIM_KEYS) m[k] = p.metrics[k] ?? null;
    return {
      id: `${p.hardware}:${p.lever}`,
      w: p.workload,
      hw: p.hardware,
      lever: p.lever,
      fam: p.family,
      label: p.label,
      m,
    };
  });
}

/** What the workload and SLO controls need to know about each workload. */
export type SlimWorkload = {
  key: WorkloadKey;
  label: string;
  ttftSlo: number;
  tpotSlo: number;
  referenceRate: number;
};

export function slimWorkloads(): SlimWorkload[] {
  return WORKLOADS.map((k) => ({
    key: k,
    label: SWEEP.workloads[k].label,
    ttftSlo: SWEEP.workloads[k].ttft_slo,
    tpotSlo: SWEEP.workloads[k].tpot_slo,
    referenceRate: SWEEP.workloads[k].reference_rate,
  }));
}

/** The levers (not the baseline) with their family and label, in order. */
export type SlimLever = {
  key: string;
  fam: Family;
  label: string;
  only: HwKey[] | null;
};

export function slimLevers(): SlimLever[] {
  return LEVER_KEYS.filter((k) => k !== "baseline").map((k) => ({
    key: k,
    fam: SWEEP.levers[k]!.family,
    label: SWEEP.levers[k]!.label,
    only: SWEEP.levers[k]!.hardware,
  }));
}

/** effects[workload][hw][lever][metric]: relative change from the baseline. */
export type Effects = Sweep["effects"];

export function matrixData(): Effects {
  return SWEEP.effects;
}

export { HARDWARE, WORKLOADS };
