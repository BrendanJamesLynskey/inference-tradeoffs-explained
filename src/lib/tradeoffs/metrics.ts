/**
 * The metrics the site compares, with the direction that is better and how
 * each is printed. Shared by the server (pages) and the client widgets, so
 * it holds no data, only definitions.
 *
 * Capacity metrics (goodput, throughput, cost, energy) are measured at each
 * configuration's capacity: the highest arrival rate at which at least 90%
 * of requests meet both SLOs (DistServe's goodput, arXiv:2401.09670).
 * Latency percentiles are measured at the workload's reference load (half
 * the H100 baseline's capacity), the same offered load for every lever.
 */
import { fixed, ms } from "@/lib/format";

export const WORKLOADS = [
  "chat",
  "coding-agent",
  "offline-batch",
  "long-rag",
  "voice",
] as const;
export type WorkloadKey = (typeof WORKLOADS)[number];

export const HARDWARE = ["h100", "h200", "b200"] as const;
export type HwKey = (typeof HARDWARE)[number];

export const FAMILIES = [
  "baseline",
  "batching",
  "kv-memory",
  "prefix-caching",
  "disaggregation",
  "parallelism",
  "quantisation",
  "speculative",
  "combined",
] as const;
export type Family = (typeof FAMILIES)[number];

export type MetricKey =
  | "goodput_req_s_per_gpu"
  | "tok_s_per_gpu"
  | "usd_per_mtok"
  | "j_per_tok"
  | "ttft_p50"
  | "ttft_p99"
  | "tpot_p50"
  | "tpot_p99"
  | "itl_p50"
  | "itl_p99"
  | "kv_peak_frac";

export type MetricDef = {
  key: MetricKey;
  /** Short label for axes, column heads and selects. */
  label: string;
  /** What it is, in a sentence fragment (tooltips, legends). */
  long: string;
  better: "max" | "min";
  /** Measured at capacity, or at the workload's reference load. */
  at: "capacity" | "load";
  unit: string;
  fmt: (v: number) => string;
};

const sec = (v: number) => ms(v);

export const METRICS: Record<MetricKey, MetricDef> = {
  goodput_req_s_per_gpu: {
    key: "goodput_req_s_per_gpu",
    label: "Goodput / GPU",
    long: "requests per second per GPU meeting both SLOs, at capacity",
    better: "max",
    at: "capacity",
    unit: "req/s/GPU",
    fmt: (v) => fixed(v, 3),
  },
  tok_s_per_gpu: {
    key: "tok_s_per_gpu",
    label: "Tokens/s / GPU",
    long: "output tokens per second per GPU, at capacity",
    better: "max",
    at: "capacity",
    unit: "tok/s/GPU",
    fmt: (v) => fixed(v, 0),
  },
  usd_per_mtok: {
    key: "usd_per_mtok",
    label: "$ / M tokens",
    long: "dollars per million output tokens at capacity (illustrative $/GPU-hour)",
    better: "min",
    at: "capacity",
    unit: "$/M tok",
    fmt: (v) => `$${fixed(v, 2)}`,
  },
  j_per_tok: {
    key: "j_per_tok",
    label: "J / token",
    long: "joules per output token at capacity (the power model, static power included)",
    better: "min",
    at: "capacity",
    unit: "J/tok",
    fmt: (v) => `${fixed(v, 2)} J`,
  },
  ttft_p50: {
    key: "ttft_p50",
    label: "TTFT p50",
    long: "median time to first token at the reference load",
    better: "min",
    at: "load",
    unit: "s",
    fmt: sec,
  },
  ttft_p99: {
    key: "ttft_p99",
    label: "TTFT p99",
    long: "99th-percentile time to first token at the reference load",
    better: "min",
    at: "load",
    unit: "s",
    fmt: sec,
  },
  tpot_p50: {
    key: "tpot_p50",
    label: "TPOT p50",
    long: "median time per output token at the reference load",
    better: "min",
    at: "load",
    unit: "s",
    fmt: sec,
  },
  tpot_p99: {
    key: "tpot_p99",
    label: "TPOT p99",
    long: "99th-percentile time per output token at the reference load",
    better: "min",
    at: "load",
    unit: "s",
    fmt: sec,
  },
  itl_p50: {
    key: "itl_p50",
    label: "ITL p50",
    long: "median inter-token latency at the reference load",
    better: "min",
    at: "load",
    unit: "s",
    fmt: sec,
  },
  itl_p99: {
    key: "itl_p99",
    label: "ITL p99",
    long: "99th-percentile inter-token latency at the reference load",
    better: "min",
    at: "load",
    unit: "s",
    fmt: sec,
  },
  kv_peak_frac: {
    key: "kv_peak_frac",
    label: "KV peak",
    long: "peak KV-cache occupancy at the reference load (lower leaves more headroom)",
    better: "min",
    at: "load",
    unit: "of KV capacity",
    fmt: (v) => `${fixed(100 * v, 1)}%`,
  },
};

/** The explorer's axis choices (the sweep's six objectives first). */
export const AXIS_METRICS: readonly MetricKey[] = [
  "goodput_req_s_per_gpu",
  "usd_per_mtok",
  "j_per_tok",
  "ttft_p99",
  "tpot_p99",
  "itl_p99",
  "tok_s_per_gpu",
  "ttft_p50",
  "tpot_p50",
  "itl_p50",
];

/** The matrix columns: every metric the sweep's `effects` records. */
export const MATRIX_METRICS: readonly MetricKey[] = [
  "goodput_req_s_per_gpu",
  "tok_s_per_gpu",
  "usd_per_mtok",
  "j_per_tok",
  "ttft_p50",
  "ttft_p99",
  "tpot_p50",
  "tpot_p99",
  "itl_p99",
  "kv_peak_frac",
];

/** The sweep's headline objectives (its Pareto flags use these). */
export const OBJECTIVES: readonly MetricKey[] = [
  "goodput_req_s_per_gpu",
  "usd_per_mtok",
  "j_per_tok",
  "ttft_p99",
  "tpot_p99",
  "itl_p99",
];

export const WORKLOAD_LABEL: Record<WorkloadKey, string> = {
  chat: "Chat",
  "coding-agent": "Coding agent",
  "offline-batch": "Offline batch",
  "long-rag": "Long-context RAG",
  voice: "Real-time voice",
};

export const HW_LABEL: Record<HwKey, string> = {
  h100: "H100",
  h200: "H200",
  b200: "B200",
};

export const FAMILY_LABEL: Record<Family, string> = {
  baseline: "Baseline",
  batching: "Batching",
  "kv-memory": "KV memory",
  "prefix-caching": "Prefix caching",
  disaggregation: "Disaggregation",
  parallelism: "Parallelism",
  quantisation: "Quantisation",
  speculative: "Speculative decoding",
  combined: "Combined",
};
