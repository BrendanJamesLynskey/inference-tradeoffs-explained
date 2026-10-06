/**
 * The live what-if's levers, as a small set of toggles, and the engine
 * configuration they mean. Every sweep configuration is one setting of the
 * toggles (`LEVER_TOGGLES`), and `configFor` turns a setting back into the
 * engine's configuration: for every one of the sweep's 350 points it gives
 * exactly the point's recorded `js_cfg` (tests/unit/whatif.test.ts), so
 * "open in the live simulator" re-runs the very configuration the sweep
 * measured. The base cluster is the sweep's: 8 GPUs serving Llama-3-70B.
 */
import type { HwKey } from "./metrics";

export type Serving = "colocated" | "disagg-1p1d" | "disagg-2p1d";
export type ParallelChoice =
  | "tp4x2"
  | "tp8"
  | "tp2x4"
  | "tp2pp2"
  | "tp2pp2-mb1";
export type BatchChoice =
  | "prefill-priority"
  | "decode-priority"
  | "chunked-512"
  | "chunked-2048";
export type KvChoice = "reserved" | "paged" | "paged-swap";
export type WeightChoice = "bf16" | "fp8" | "int4" | "fp4";
export type SpecChoice = "off" | "mtp" | "1b";

export type Toggles = {
  serving: Serving;
  parallel: ParallelChoice;
  batch: BatchChoice;
  kv: KvChoice;
  prefix: boolean;
  weights: WeightChoice;
  kvFormat: "bf16" | "fp8";
  spec: SpecChoice;
};

export const BASELINE: Toggles = {
  serving: "colocated",
  parallel: "tp4x2",
  batch: "prefill-priority",
  kv: "reserved",
  prefix: false,
  weights: "bf16",
  kvFormat: "bf16",
  spec: "off",
};

const MODERN: Partial<Toggles> = {
  batch: "chunked-2048",
  kv: "paged",
  prefix: true,
  weights: "fp8",
  kvFormat: "fp8",
};

/** Each sweep lever as a setting of the toggles. */
export const LEVER_TOGGLES: Record<string, Toggles> = Object.fromEntries(
  (
    [
      ["baseline", {}],
      ["decode-priority", { batch: "decode-priority" }],
      ["chunked-512", { batch: "chunked-512" }],
      ["chunked-2048", { batch: "chunked-2048" }],
      ["paged", { kv: "paged" }],
      ["paged-swap", { kv: "paged-swap" }],
      ["prefix-cache", { kv: "paged", prefix: true }],
      ["disagg-1p1d", { serving: "disagg-1p1d" }],
      ["disagg-2p1d", { serving: "disagg-2p1d" }],
      ["disagg-levers", { serving: "disagg-1p1d", kv: "paged", prefix: true }],
      ["tp8", { parallel: "tp8" }],
      ["tp2x4", { parallel: "tp2x4" }],
      ["tp2pp2", { parallel: "tp2pp2" }],
      ["tp2pp2-mb1", { parallel: "tp2pp2-mb1" }],
      ["w8a8-fp8", { weights: "fp8" }],
      ["w4-int4", { weights: "int4" }],
      ["kv-fp8", { kvFormat: "fp8" }],
      ["fp8-all", { weights: "fp8", kvFormat: "fp8" }],
      ["w4a4-fp4", { weights: "fp4" }],
      ["spec-mtp", { spec: "mtp" }],
      ["spec-1b", { spec: "1b" }],
      ["modern-colocated", MODERN],
      [
        "modern-disagg",
        { ...MODERN, batch: "prefill-priority", serving: "disagg-1p1d" },
      ],
      ["modern-spec", { ...MODERN, spec: "mtp" }],
    ] as [string, Partial<Toggles>][]
  ).map(([k, t]) => [k, { ...BASELINE, ...t }]),
);

/** The sweep's speculative acceptance rate (a parameter, not a measurement). */
export const ALPHA = 0.7;

type Par = {
  tp: number;
  pp: number;
  ep: number;
  microbatches?: number;
  expertImbalance: number;
};
const par = (tp: number, pp = 1, microbatches?: number): Par =>
  microbatches === undefined
    ? { tp, pp, ep: 1, expertImbalance: 1.0 }
    : { tp, pp, ep: 1, microbatches, expertImbalance: 1.0 };

/**
 * The engine configuration for a setting of the toggles, on a device, with a
 * workload's SLOs. Disaggregated serving keeps TP4 instances (the parallelism
 * toggle applies to colocated serving only, as in the sweep).
 */
export function configFor(
  t: Toggles,
  hw: HwKey,
  slo: { ttft: number; tpot: number },
): Record<string, unknown> {
  const cfg: Record<string, unknown> = {
    model: "llama3-70b",
    device: hw,
    devicesPerInstance: 4,
    mode: t.serving === "colocated" ? "colocated" : "disagg",
    nPrefill: t.serving === "disagg-2p1d" ? 2 : 1,
    nDecode: 1,
    nColocated: 2,
    link: "ib-ndr",
    ttftSlo: slo.ttft,
    tpotSlo: slo.tpot,
    batchPolicy: t.batch.startsWith("chunked") ? "chunked" : t.batch,
    kvPolicy: t.kv === "reserved" ? "oracle" : "paged",
    preemption: t.kv === "paged-swap" ? "swap" : "recompute",
    hostLink: "pcie5",
    prefixCaching: t.prefix,
    parallel: par(4),
    weightFormat: t.weights,
    kvFormat: t.kvFormat,
    computeFormat:
      t.weights === "fp8" || t.weights === "fp4" ? t.weights : "bf16",
  };
  if (t.batch === "chunked-512") cfg.maxNumBatchedTokens = 512;
  if (t.batch === "chunked-2048") cfg.maxNumBatchedTokens = 2048;
  if (t.serving === "disagg-2p1d") {
    cfg.prefillDevicesPerInstance = 2;
    cfg.prefillParallel = par(2);
  }
  if (t.serving === "colocated") {
    if (t.parallel === "tp8")
      Object.assign(cfg, {
        nColocated: 1,
        devicesPerInstance: 8,
        parallel: par(8),
      });
    if (t.parallel === "tp2x4")
      Object.assign(cfg, {
        nColocated: 4,
        devicesPerInstance: 2,
        parallel: par(2),
      });
    if (t.parallel === "tp2pp2") cfg.parallel = par(2, 2);
    if (t.parallel === "tp2pp2-mb1") cfg.parallel = par(2, 2, 1);
  }
  if (t.spec !== "off")
    cfg.speculative =
      t.spec === "mtp"
        ? { draft: "mtp", gamma: 3, alpha: ALPHA, seed: 0 }
        : { draft: "llama3.2-1b", gamma: 4, alpha: ALPHA, seed: 0 };
  return cfg;
}

/** The sweep lever a setting of the toggles is, if it is one. */
export function leverOf(t: Toggles): string | null {
  for (const [k, v] of Object.entries(LEVER_TOGGLES))
    if ((Object.keys(v) as (keyof Toggles)[]).every((f) => v[f] === t[f]))
      return k;
  return null;
}

/**
 * Settings the simulator does not model, explained before running (the
 * engine would reject them too, with the same reason).
 */
export function problems(t: Toggles, hw: HwKey): string[] {
  const out: string[] = [];
  if (t.prefix && t.kv === "paged-swap")
    out.push(
      "Prefix caching with swap-to-host preemption is not modelled: preempt by recompute.",
    );
  if (t.weights === "fp4" && hw !== "b200")
    out.push("FP4 matmuls need FP4 units: only the B200 has them here.");
  if (
    t.spec !== "off" &&
    t.serving === "colocated" &&
    t.parallel.startsWith("tp2pp2")
  )
    out.push("Speculative decoding with pipeline parallelism is not modelled.");
  return out;
}
