/**
 * The modelling caveats the site must label wherever the affected numbers
 * appear (the planner's verdict on the sweep, brief 20A2): each has a mark
 * drawn next to an affected matrix cell or tooltip, a one-line statement and
 * a longer explanation for the legend and the method page. `caveatsFor`
 * decides which apply to one number, from the data alone.
 */
import type { Family, HwKey, MetricKey, WorkloadKey } from "./metrics";
import { METRICS } from "./metrics";

export type CaveatKey =
  | "pp"
  | "tp"
  | "paged"
  | "edge"
  | "price"
  | "alpha"
  | "b200";

export type Caveat = {
  key: CaveatKey;
  /** One character drawn as a superscript next to the number. */
  mark: string;
  short: string;
  long: string;
};

/** The numbers the caveats quote, read from the vendored sweep and engine (`caveatNumbers()` in values.ts). */
export type CaveatNumbers = {
  /** Illustrative prices per GPU-hour (the sweep's meta). */
  usd: Record<HwKey, number>;
  /** The speculative acceptance rate the sweep assumes. */
  alpha: number;
  /** The scale-up link's latency per hop, microseconds (the engine's NVLink 4). */
  hopUs: number;
  /** B200's board power and idle power, watts (the engine's device table). */
  b200: { tdp: number; idle: number };
  /** The share of requests that must meet both SLOs at capacity. */
  sloTarget: number;
};

const usd = (v: number) => `$${v.toFixed(2)}`;

/** Every caveat, its texts filled in from the data. */
export function buildCaveats(n: CaveatNumbers): Record<CaveatKey, Caveat> {
  return {
    pp: {
      key: "pp",
      mark: "P",
      short: "Pipeline parallelism is not overlapped",
      long: "The simulator does not keep several batches in flight across pipeline stages, so PP shows only its cost (bubbles, weight re-reads, an activation hop per stage) and every PP configuration in the sweep loses. Real engines overlap micro-batches across steps.",
    },
    tp: {
      key: "tp",
      mark: "T",
      short: "TP all-reduce cost is pessimistic at small batch",
      long: `Tensor-parallel all-reduces use a first-order α–β ring model whose latency term (${n.hopUs} µs a hop, illustrative) dominates at small batch; NVSwitch hardware with in-switch reduction does better. It has not been calibrated against nccl-tests, and communication does not overlap with compute.`,
    },
    paged: {
      key: "paged",
      mark: "M",
      short: "Paged KV shows +0% where memory does not bind",
      long: "Llama-3-70B on four GPUs per instance never runs out of KV cache at these loads, so paged allocation has nothing to win and the sweep shows no change. Paged KV matters where memory binds: the simulator's results.md section 23 shows it on OPT-13B.",
    },
    edge: {
      key: "edge",
      mark: "E",
      short: "Huge percentages come from a baseline at its SLO edge",
      long: `Capacity is the highest load at which ${Math.round(100 * n.sloTarget)}% of requests meet both SLOs. Where the baseline sits just past a latency cliff (voice and the coding agent especially), a lever that pulls latency back under the SLO multiplies capacity, so gains of hundreds or thousands of percent are real in the model but say more about the cliff than about the lever. Marked wherever capacity at least doubles; read the absolute numbers too.`,
    },
    price: {
      key: "price",
      mark: "$",
      short: "Prices per GPU-hour are illustrative",
      long: `Cost per million tokens uses round illustrative prices (H100 ${usd(n.usd.h100)}, H200 ${usd(n.usd.h200)}, B200 ${usd(n.usd.b200)} per GPU-hour), not quotes. Cost scales linearly with them, so the ranking of levers on one device does not depend on them; comparisons across devices do.`,
    },
    alpha: {
      key: "alpha",
      mark: "α",
      short: `Speculative acceptance α = ${n.alpha} is assumed`,
      long: `Speculative decoding's gain depends on how often the target accepts a drafted token, which depends on the draft, the target and the text. The sweep fixes α at ${n.alpha} as a parameter; it is not measured.`,
    },
    b200: {
      key: "b200",
      mark: "B",
      short: "B200 BF16 rate and power are illustrative",
      long: `B200's BF16 rate is taken as half its FP8 datasheet rate, and its power coefficients (${n.b200.tdp.toLocaleString("en-GB")} W board power, ${n.b200.idle} W idle, energy per FLOP and per byte) are illustrative.`,
    },
  };
}

export const CAVEAT_ORDER: readonly CaveatKey[] = [
  "pp",
  "tp",
  "paged",
  "edge",
  "price",
  "alpha",
  "b200",
];

const PP = new Set(["tp2pp2", "tp2pp2-mb1"]);
const TP = new Set(["tp8", "tp2x4", "tp2pp2", "tp2pp2-mb1"]);
const PAGED = new Set(["paged", "paged-swap"]);
const CAPACITY: ReadonlySet<MetricKey> = new Set(
  (Object.keys(METRICS) as MetricKey[]).filter(
    (k) => METRICS[k].at === "capacity",
  ),
);

/**
 * The caveats that apply to one number: a lever's value (or its relative
 * change) for one metric, workload and device. `goodputRel` is the lever's
 * relative change of goodput on that workload and device (the SLO-edge rule:
 * capacity metrics of a configuration whose capacity at least doubled).
 */
export function caveatsFor(o: {
  lever: string;
  family: Family;
  metric: MetricKey;
  workload: WorkloadKey;
  hw: HwKey;
  rel?: number | null;
  goodputRel?: number | null;
}): CaveatKey[] {
  const out: CaveatKey[] = [];
  if (PP.has(o.lever)) out.push("pp");
  if (TP.has(o.lever)) out.push("tp");
  if (
    PAGED.has(o.lever) &&
    o.rel !== undefined &&
    o.rel !== null &&
    Math.abs(o.rel) <= 0.02
  )
    out.push("paged");
  if (
    CAPACITY.has(o.metric) &&
    o.goodputRel !== undefined &&
    o.goodputRel !== null &&
    o.goodputRel >= 1
  )
    out.push("edge");
  if (o.metric === "usd_per_mtok") out.push("price");
  if (o.family === "speculative" || o.lever === "modern-spec")
    out.push("alpha");
  if (o.hw === "b200") out.push("b200");
  return out;
}
