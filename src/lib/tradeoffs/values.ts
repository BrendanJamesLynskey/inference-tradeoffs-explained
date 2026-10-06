/**
 * Every number the pages quote in running prose comes from here: a path
 * into the vendored sweep (or the vendored engine's tables), formatted by
 * kind. Pages write <V of="…" fmt="…" />, so prose cannot drift from the
 * data; tests/unit/values.test.ts checks every path the pages use resolves,
 * and tests/unit/prose.test.ts that no page spells out a number by hand.
 *
 * Paths:
 *   meta.points | meta.levers | meta.workloads | meta.devices | meta.gpus |
 *   meta.wall_min | meta.workers | meta.slo_target | meta.alpha | meta.seed
 *   effect.<workload>.<hw>.<lever>.<metric>   relative change from the baseline
 *   point.<workload>.<hw>.<lever>.<metric>    the measured value
 *   workload.<workload>.<field>               ttft_slo, tpot_slo, reference_rate, …
 *   price.<hw>                                illustrative $ per GPU-hour
 */
import { buildCaveats, type CaveatNumbers } from "./caveats";
import { LEVER_KEYS, SWEEP, VENDORED } from "./data";
import { engine } from "./engine";
import {
  METRICS,
  type HwKey,
  type MetricKey,
  type WorkloadKey,
} from "./metrics";
import { fixed, int, signedPct } from "@/lib/format";

export type Fmt =
  | "int"
  | "num"
  | "pct"
  | "signed"
  | "metric"
  | "ms"
  | "usd"
  | "raw";

export function lookup(path: string): number | string {
  const [head, ...rest] = path.split(".");
  const fail = (): never => {
    throw new Error(`no value at "${path}"`);
  };
  if (head === "meta") {
    const k = rest[0];
    const m = SWEEP.meta;
    const table: Record<string, number | string> = {
      points: SWEEP.points.length,
      levers: LEVER_KEYS.length - 1,
      workloads: Object.keys(SWEEP.workloads).length,
      devices: Object.keys(SWEEP.hardware).length,
      gpus: m.gpus,
      model: m.model,
      wall_min: Math.round(m.wall_s / 60),
      workers: m.workers,
      slo_target: m.slo_target,
      alpha: m.speculative_alpha,
      seed: m.seed,
      commit: VENDORED.commit.slice(0, 7),
      sweep_commit: m.simulator_commit,
      generated: m.generated,
    };
    return k !== undefined && k in table ? table[k]! : fail();
  }
  if (head === "effect" || head === "point") {
    const [w, hw, lever, metric] = rest as [
      WorkloadKey,
      HwKey,
      string,
      MetricKey,
    ];
    if (head === "effect") {
      const v = SWEEP.effects[w]?.[hw]?.[lever]?.[metric];
      return v === undefined || v === null ? fail() : v;
    }
    const p = SWEEP.points.find(
      (q) => q.workload === w && q.hardware === hw && q.lever === lever,
    );
    const v = p?.metrics[metric];
    return v === undefined || v === null ? fail() : v;
  }
  if (head === "workload") {
    const [w, f] = rest as [WorkloadKey, string];
    const v = (
      SWEEP.workloads[w] as unknown as Record<string, unknown> | undefined
    )?.[f];
    return typeof v === "number" || typeof v === "string" ? v : fail();
  }
  if (head === "price") {
    const v = SWEEP.meta.usd_per_gpu_hour[rest[0] as HwKey];
    return v === undefined ? fail() : v;
  }
  return fail();
}

/** The metric a path ends in (for fmt="metric"). */
function metricOf(path: string): MetricKey | null {
  const last = path.split(".").pop() as MetricKey;
  return last in METRICS ? last : null;
}

export function formatValue(
  path: string,
  v: number | string,
  fmt: Fmt,
): string {
  if (typeof v === "string") return v;
  switch (fmt) {
    case "int":
      return int(v);
    case "pct":
      return `${fixed(100 * v, 0)}%`;
    case "signed":
      return signedPct(v);
    case "ms":
      return METRICS.ttft_p99.fmt(v);
    case "usd":
      return `$${fixed(v, 2)}`;
    case "metric": {
      const m = metricOf(path);
      return m ? METRICS[m].fmt(v) : String(v);
    }
    case "raw":
      return String(v);
    default:
      return Number.isInteger(v) ? int(v) : fixed(v, 3);
  }
}

/** The numbers the caveats quote, from the vendored sweep and engine. */
export function caveatNumbers(): CaveatNumbers {
  const b = engine.DEVICES.b200!;
  return {
    usd: SWEEP.meta.usd_per_gpu_hour,
    alpha: SWEEP.meta.speculative_alpha,
    hopUs: engine.LINKS.nvlink4!.lat * 1e6,
    b200: { tdp: b.tdp, idle: b.idle },
    sloTarget: SWEEP.meta.slo_target,
  };
}

/** The caveats with their numbers filled in. */
export function caveats() {
  return buildCaveats(caveatNumbers());
}
