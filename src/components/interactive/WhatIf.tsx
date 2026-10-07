"use client";

/**
 * The live what-if: start from a configuration the sweep measured, toggle
 * levers, and re-run the simulator's own engine (vendored, bit-exact with
 * its Python package) on the very requests the sweep used, in a Web Worker.
 * Before/after bars compare the two runs; "where the time went" splits each
 * request's time into stages; and the timeline animation replays the same
 * requests under both configurations, a clock sweeping simulated time
 * (src/lib/tradeoffs/timeline.ts).
 */
import { useEffect, useMemo, useState } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { useTween, useWidth } from "@/components/anim/useTween";
import { Segmented } from "@/components/ui/Controls";
import { fixed, signedPct } from "@/lib/format";
import type { Caveat, CaveatKey } from "@/lib/tradeoffs/caveats";
import {
  STAGES,
  type PlainRun,
  type RunMetrics,
  type Stage,
} from "@/lib/tradeoffs/engine";
import {
  HARDWARE,
  HW_LABEL,
  METRICS,
  WORKLOADS,
  WORKLOAD_LABEL,
  type HwKey,
  type MetricKey,
  type WorkloadKey,
} from "@/lib/tradeoffs/metrics";
import {
  PHASES,
  caption as timelineCaption,
  lanes,
  phaseAt,
  timeAt,
  type Lanes,
} from "@/lib/tradeoffs/timeline";
import {
  LEVER_TOGGLES,
  configFor,
  leverOf,
  problems,
  type BatchChoice,
  type KvChoice,
  type ParallelChoice,
  type Serving,
  type SpecChoice,
  type Toggles,
  type WeightChoice,
} from "@/lib/tradeoffs/whatif";
import { PHASE_COLOUR, VERDICT_COLOUR } from "@/lib/viz/palette";

import { loadWorkload, simulateAll } from "./sim/runner";

export type WhatIfPoint = {
  w: WorkloadKey;
  hw: HwKey;
  lever: string;
  label: string;
  m: Partial<Record<MetricKey, number | null>>;
};

type Bar = {
  key: keyof RunMetrics;
  label: string;
  better: "max" | "min";
  fmt: (v: number) => string;
};

const ms = (v: number) => METRICS.ttft_p99.fmt(v);
const BARS: Bar[] = [
  { key: "ttft_p99", label: "TTFT p99", better: "min", fmt: ms },
  { key: "ttft_p50", label: "TTFT p50", better: "min", fmt: ms },
  { key: "tpot_p99", label: "TPOT p99", better: "min", fmt: ms },
  { key: "itl_p99", label: "ITL p99", better: "min", fmt: ms },
  { key: "e2e_p50", label: "End to end p50", better: "min", fmt: ms },
  {
    key: "out_tok_s",
    label: "Output tokens/s",
    better: "max",
    fmt: (v) => fixed(v, 0),
  },
  {
    key: "j_per_tok",
    label: "Joules / token",
    better: "min",
    fmt: (v) => `${fixed(v, 2)} J`,
  },
  {
    key: "slo_attain",
    label: "SLO attainment",
    better: "max",
    fmt: (v) => `${fixed(100 * v, 1)}%`,
  },
];

const STAGE_LABEL: Record<Stage, string> = {
  prefill_queue: "waiting for prefill",
  prefill: "prefill",
  kv_wait: "KV waiting for decode room",
  kv_transfer: "KV crossing the link",
  decode_queue: "waiting for decode",
  decode: "decode",
};
const STAGE_COLOUR: Record<Stage, string> = {
  prefill_queue: PHASE_COLOUR.queue,
  prefill: PHASE_COLOUR.prefill,
  kv_wait: "#56B4E9",
  kv_transfer: "#009E73",
  decode_queue: "#737373",
  decode: PHASE_COLOUR.decode,
};

type Choice<T extends string> = { value: T; label: string }[];
const SERVING: Choice<Serving> = [
  { value: "colocated", label: "Colocated" },
  { value: "disagg-1p1d", label: "Disagg 1P1D" },
  { value: "disagg-2p1d", label: "Disagg 2P(TP2)+1D" },
];
const PARALLEL: Choice<ParallelChoice> = [
  { value: "tp4x2", label: "2 × TP4" },
  { value: "tp8", label: "1 × TP8" },
  { value: "tp2x4", label: "4 × TP2" },
  { value: "tp2pp2", label: "2 × TP2·PP2" },
  { value: "tp2pp2-mb1", label: "TP2·PP2, 1 µbatch" },
];
const BATCH: Choice<BatchChoice> = [
  { value: "prefill-priority", label: "Prefill first" },
  { value: "decode-priority", label: "Decode first" },
  { value: "chunked-512", label: "Chunked 512" },
  { value: "chunked-2048", label: "Chunked 2,048" },
];
const KV: Choice<KvChoice> = [
  { value: "reserved", label: "Reserved" },
  { value: "paged", label: "Paged" },
  { value: "paged-swap", label: "Paged, swap" },
];
const WEIGHTS: Choice<WeightChoice> = [
  { value: "bf16", label: "BF16" },
  { value: "fp8", label: "FP8 W8A8" },
  { value: "int4", label: "INT4 W4A16" },
  { value: "fp4", label: "FP4 W4A4" },
];
const SPEC: Choice<SpecChoice> = [
  { value: "off", label: "Off" },
  { value: "mtp", label: "MTP γ3" },
  { value: "1b", label: "1B draft γ4" },
];

const SEL =
  "focus-ring h-11 w-full min-w-0 rounded border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950";
const LAB =
  "flex min-w-0 flex-col gap-1 text-xs font-medium uppercase tracking-widest text-neutral-500 dark:text-neutral-400";

type Status = {
  kind: "idle" | "loading" | "running" | "done" | "error";
  msg?: string;
};

export default function WhatIf({
  points,
  leverLabels,
  slos,
  caveats,
  equation,
}: {
  points: WhatIfPoint[];
  leverLabels: Record<string, string>;
  slos: Record<WorkloadKey, { ttft: number; tpot: number }>;
  caveats: Record<CaveatKey, Caveat>;
  /** Server-rendered KaTeX for the timeline: how a request's time splits. */
  equation?: React.ReactNode;
}): JSX.Element {
  const [w, setW] = useState<WorkloadKey>("chat");
  const [hw, setHw] = useState<HwKey>("h100");
  const [baseLever, setBaseLever] = useState("baseline");
  const [after, setAfter] = useState<Toggles>(
    LEVER_TOGGLES["modern-colocated"]!,
  );
  const [runs, setRuns] = useState<{
    before: PlainRun;
    after: PlainRun;
    key: string;
  } | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // a link from the explorer or the matrix: ?w=…&hw=…&lever=… (that lever against the baseline)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const qw = q.get("w") as WorkloadKey | null;
    const qh = q.get("hw") as HwKey | null;
    const ql = q.get("lever");
    if (qw && WORKLOADS.includes(qw)) setW(qw);
    if (qh && HARDWARE.includes(qh)) setHw(qh);
    if (ql && LEVER_TOGGLES[ql]) setAfter(LEVER_TOGGLES[ql]!);
  }, []);

  const before = LEVER_TOGGLES[baseLever]!;
  const afterLever = leverOf(after);
  const issues = useMemo(() => problems(after, hw), [after, hw]);
  const key = `${w}|${hw}|${JSON.stringify(before)}|${JSON.stringify(after)}`;

  useEffect(() => {
    if (issues.length) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        setStatus({ kind: "loading" });
        const rows = await loadWorkload(w);
        if (!live) return;
        setStatus({ kind: "running" });
        const r = await simulateAll(rows, {
          before: configFor(before, hw, slos[w]),
          after: configFor(after, hw, slos[w]),
        });
        if (!live) return;
        setRuns({ before: r.before!, after: r.after!, key });
        setStatus({ kind: "done" });
      } catch (e) {
        if (live)
          setStatus({
            kind: "error",
            msg: e instanceof Error ? e.message : String(e),
          });
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, issues.length]);

  const rec = (lever: string | null) =>
    lever
      ? points.find((p) => p.w === w && p.hw === hw && p.lever === lever)
      : undefined;
  const recBefore = rec(baseLever);
  const recAfter = rec(afterLever);
  const fresh = runs && runs.key === key ? runs : null;
  const matches = (run: PlainRun | undefined, p: WhatIfPoint | undefined) =>
    !!run &&
    !!p &&
    (["ttft_p99", "tpot_p99", "itl_p99", "ttft_p50"] as const).every(
      (k) => run.metrics[k] === p.m[k],
    );

  // bars grow from the old values to the new ones
  const barTarget = useMemo(
    () => (runs ? { b: runs.before.metrics, a: runs.after.metrics } : null),
    [runs],
  );
  const barTween = useTween(barTarget, runs?.key ?? "", 600);

  const set = <K extends keyof Toggles>(k: K, v: Toggles[K]) =>
    setAfter((t) => ({ ...t, [k]: v }));

  return (
    <div className="space-y-6" data-testid="whatif">
      <section
        aria-label="Configurations"
        className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={LAB}>
            Workload
            <select
              value={w}
              onChange={(e) => setW(e.target.value as WorkloadKey)}
              className={SEL}
              data-testid="wi-workload"
            >
              {WORKLOADS.map((k) => (
                <option key={k} value={k}>
                  {WORKLOAD_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={LAB}>
            Device (8 GPUs)
            <select
              value={hw}
              onChange={(e) => setHw(e.target.value as HwKey)}
              className={SEL}
              data-testid="wi-hw"
            >
              {HARDWARE.map((h) => (
                <option key={h} value={h}>
                  {HW_LABEL[h]}
                </option>
              ))}
            </select>
          </label>
          <label className={LAB}>
            Before: a sweep configuration
            <select
              value={baseLever}
              onChange={(e) => setBaseLever(e.target.value)}
              className={SEL}
              data-testid="wi-before"
            >
              {Object.keys(LEVER_TOGGLES)
                .filter((k) => k !== "w4a4-fp4" || hw === "b200")
                .map((k) => (
                  <option key={k} value={k}>
                    {leverLabels[k]}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <h2 className="mt-5 text-sm font-semibold">After: toggle the levers</h2>
        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
          {afterLever ? (
            <>
              This is the sweep&apos;s{" "}
              <strong>{leverLabels[afterLever]}</strong>.
            </>
          ) : (
            <>
              This combination is not one of the sweep&apos;s points: the live
              run is all there is.
            </>
          )}{" "}
          <button
            type="button"
            className="focus-ring ml-1 inline-flex min-h-11 items-center rounded underline underline-offset-2"
            onClick={() => setAfter(before)}
          >
            Copy &ldquo;before&rdquo;
          </button>
        </p>
        <div
          className="mt-3 grid gap-3 sm:grid-cols-2"
          data-testid="wi-toggles"
        >
          <Segmented
            label="Serving"
            value={after.serving}
            options={SERVING}
            onChange={(v) => set("serving", v)}
          />
          <div className={after.serving !== "colocated" ? "opacity-50" : ""}>
            <Segmented
              label={
                after.serving === "colocated"
                  ? "Parallelism"
                  : "Parallelism (TP4 pools when disaggregated)"
              }
              value={after.parallel}
              options={PARALLEL}
              onChange={(v) => set("parallel", v)}
            />
          </div>
          <Segmented
            label="Batching"
            value={after.batch}
            options={BATCH}
            onChange={(v) => set("batch", v)}
          />
          <Segmented
            label="KV memory"
            value={after.kv}
            options={KV}
            onChange={(v) => set("kv", v)}
          />
          <Segmented
            label="Prefix caching"
            value={after.prefix ? "on" : "off"}
            options={[
              { value: "off", label: "Off" },
              { value: "on", label: "On" },
            ]}
            onChange={(v) => set("prefix", v === "on")}
          />
          <Segmented
            label="Weights and matmuls"
            value={after.weights}
            options={WEIGHTS}
            onChange={(v) => set("weights", v)}
          />
          <Segmented
            label="KV cache format"
            value={after.kvFormat}
            options={[
              { value: "bf16", label: "BF16" },
              { value: "fp8", label: "FP8" },
            ]}
            onChange={(v) => set("kvFormat", v)}
          />
          <Segmented
            label="Speculative decoding"
            value={after.spec}
            options={SPEC}
            onChange={(v) => set("spec", v)}
          />
        </div>
        {issues.length > 0 && (
          <ul
            role="alert"
            className="mt-3 list-disc pl-5 text-sm text-red-700 dark:text-red-400"
            data-testid="wi-issues"
          >
            {issues.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
        <p
          aria-live="polite"
          className="mt-3 text-xs text-neutral-600 dark:text-neutral-400"
          data-testid="wi-status"
        >
          {issues.length
            ? "Not run."
            : status.kind === "loading"
              ? "Loading the recorded workload…"
              : status.kind === "running" || (status.kind === "done" && !fresh)
                ? "Simulating both configurations in a Web Worker…"
                : status.kind === "error"
                  ? `The simulator refused this configuration: ${status.msg}`
                  : status.kind === "done"
                    ? "Done: both configurations simulated on the same requests."
                    : "Starting…"}
        </p>
      </section>

      {runs && (
        <section
          aria-label="Before and after"
          data-testid="wi-results"
          className={fresh ? "" : "opacity-60"}
        >
          <h2 className="text-lg font-semibold">Before and after</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {WORKLOAD_LABEL[w]} at its reference load, on 8 {HW_LABEL[hw]}s.
            Before: {leverLabels[baseLever]}. After:{" "}
            {afterLever ? leverLabels[afterLever] : "your combination"}.
          </p>
          <Bars run={runs} tween={barTween} />
          <Recorded
            before={recBefore}
            after={recAfter}
            okBefore={matches(fresh?.before, recBefore)}
            okAfter={matches(fresh?.after, recAfter)}
            caveats={caveats}
            hw={hw}
            afterToggles={after}
          />
          <Stages run={runs} />
        </section>
      )}

      {runs && <Timeline run={runs} equation={equation} />}
    </div>
  );
}

function Bars({
  run,
  tween,
}: {
  run: { before: PlainRun; after: PlainRun };
  tween: { from: { b: RunMetrics; a: RunMetrics } | null; t: number };
}): JSX.Element {
  const t = tween.t;
  const lerp = (u: number, v: number) => u + (v - u) * t;
  return (
    <div className="mt-3 space-y-2" data-testid="wi-bars">
      {BARS.map((b) => {
        const vb = run.before.metrics[b.key] as number;
        const va = run.after.metrics[b.key] as number;
        const fb = tween.from ? (tween.from.b[b.key] as number) : vb;
        const fa = tween.from ? (tween.from.a[b.key] as number) : va;
        const max = Math.max(vb, va, fb, fa) || 1;
        const rel = vb ? (va - vb) / vb : 0;
        const good =
          Math.abs(rel) <= 0.02 ? null : (b.better === "max") === rel > 0;
        return (
          <div
            key={b.key}
            className="grid grid-cols-[7.5rem_1fr] items-center gap-2 text-xs sm:grid-cols-[9rem_1fr_5rem]"
          >
            <span className="font-medium">{b.label}</span>
            <div className="min-w-0 space-y-0.5">
              {(["before", "after"] as const).map((which) => {
                const v = which === "before" ? lerp(fb, vb) : lerp(fa, va);
                return (
                  <div key={which} className="flex items-center gap-2">
                    <div className="h-3 min-w-0 flex-1 rounded-sm bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className="h-3 rounded-sm"
                        style={{
                          width: `${(100 * v) / max}%`,
                          background:
                            which === "before"
                              ? "#a3a3a3"
                              : good === false
                                ? VERDICT_COLOUR.worse
                                : VERDICT_COLOUR.better,
                        }}
                      />
                    </div>
                    <span className="w-32 shrink-0 whitespace-nowrap text-right font-mono">
                      {which === "before" ? "before " : "after "}
                      {b.fmt(which === "before" ? vb : va)}
                    </span>
                  </div>
                );
              })}
            </div>
            <span
              className="col-span-2 font-mono sm:col-span-1 sm:text-right"
              data-testid={`wi-change-${b.key}`}
            >
              {signedPct(rel)} {good === null ? "≈" : good ? "better" : "worse"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Recorded({
  before,
  after,
  okBefore,
  okAfter,
  caveats,
  hw,
  afterToggles,
}: {
  before: WhatIfPoint | undefined;
  after: WhatIfPoint | undefined;
  okBefore: boolean;
  okAfter: boolean;
  caveats: Record<CaveatKey, Caveat>;
  hw: HwKey;
  afterToggles: Toggles;
}): JSX.Element {
  const row = (name: string, p: WhatIfPoint | undefined, ok: boolean) =>
    p ? (
      <li>
        <strong>{name}</strong> is the sweep&apos;s {p.label}:{" "}
        {ok ? (
          <span data-testid={`wi-match-${name.toLowerCase()}`}>
            its live TTFT and TPOT p99 are identical to the recorded
            sweep&apos;s, to the last bit.
          </span>
        ) : (
          <span>(simulating…)</span>
        )}{" "}
        At its capacity the sweep recorded goodput{" "}
        {METRICS.goodput_req_s_per_gpu.fmt(p.m.goodput_req_s_per_gpu ?? 0)}{" "}
        req/s per GPU
        {p.m.usd_per_mtok != null && (
          <>, {METRICS.usd_per_mtok.fmt(p.m.usd_per_mtok)} per million tokens</>
        )}
        {p.m.j_per_tok != null && (
          <> and {METRICS.j_per_tok.fmt(p.m.j_per_tok)} per token</>
        )}
        .
      </li>
    ) : (
      <li>
        <strong>{name}</strong> is not a sweep point, so it has no recorded
        capacity (finding it takes a search of several runs).
      </li>
    );
  const keys: CaveatKey[] = ["edge", "price"];
  if (hw === "b200") keys.push("b200");
  if (afterToggles.spec !== "off") keys.push("alpha");
  if (
    afterToggles.parallel.startsWith("tp2pp2") &&
    afterToggles.serving === "colocated"
  )
    keys.push("pp");
  if (afterToggles.parallel !== "tp4x2" || afterToggles.serving === "colocated")
    keys.push("tp");
  if (afterToggles.kv !== "reserved") keys.push("paged");
  return (
    <div className="mt-4 rounded bg-white p-3 text-xs ring-1 ring-neutral-200 dark:bg-neutral-950 dark:ring-neutral-800">
      <ul className="space-y-1">
        {row("Before", before, okBefore)}
        {row("After", after, okAfter)}
      </ul>
      <ul
        className="mt-2 space-y-1 text-neutral-600 dark:text-neutral-400"
        aria-label="Caveats"
      >
        {[...new Set(keys)].map((k) => (
          <li key={k}>
            <span className="mr-1 font-mono font-semibold">
              {caveats[k].mark}
            </span>
            {caveats[k].short}.{" "}
            <a
              href={`/method#caveat-${k}`}
              className="focus-ring rounded underline underline-offset-2"
            >
              Why
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stages({
  run,
}: {
  run: { before: PlainRun; after: PlainRun };
}): JSX.Element {
  const total = (m: RunMetrics) => STAGES.reduce((s, k) => s + m.stages[k], 0);
  const max =
    Math.max(total(run.before.metrics), total(run.after.metrics)) || 1;
  return (
    <div className="mt-5" data-testid="wi-stages">
      <h3 className="text-sm font-semibold">
        Where the time went (mean per request)
      </h3>
      <div className="mt-2 space-y-1">
        {(["before", "after"] as const).map((which) => {
          const m = run[which].metrics;
          return (
            <div key={which} className="flex items-center gap-2 text-xs">
              <span className="w-12 shrink-0">{which}</span>
              <div className="flex h-4 min-w-0 flex-1 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800">
                {STAGES.map((k) =>
                  m.stages[k] > 0 ? (
                    <div
                      key={k}
                      title={`${STAGE_LABEL[k]}: ${ms(m.stages[k])}`}
                      className={k.endsWith("queue") ? "stall-hatch" : ""}
                      style={{
                        width: `${(100 * m.stages[k]) / max}%`,
                        background: STAGE_COLOUR[k],
                      }}
                    />
                  ) : null,
                )}
              </div>
              <span className="w-20 shrink-0 text-right font-mono">
                {ms(total(m))}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
        {STAGES.map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className={`inline-block size-3 rounded-sm ${k.endsWith("queue") ? "stall-hatch" : ""}`}
              style={{ background: STAGE_COLOUR[k] }}
            />
            {STAGE_LABEL[k]}
          </span>
        ))}
      </p>
    </div>
  );
}

const STEPS = 60;

function Timeline({
  run,
  equation,
}: {
  run: { before: PlainRun; after: PlainRun; key: string };
  equation?: React.ReactNode;
}): JSX.Element {
  const l: Lanes = useMemo(() => lanes(run.before.reqs, run.after.reqs), [run]);
  const stepper = useStepper(STEPS, {
    stepMs: 160,
    resetKey: run.key,
    smooth: true,
  });
  const [ref, width] = useWidth(640);
  const left = 64;
  const laneH = 6;
  const gap = 2;
  const block = l.ids.length * (laneH + gap);
  const h = 28 + 2 * block + 30;
  const tNow = timeAt(l, stepper.step + stepper.frac, STEPS);
  const X = (t: number) =>
    left + ((t - l.t0) / Math.max(1e-9, l.t1 - l.t0)) * (width - left - 8);
  const cap = timelineCaption(l, stepper.step, STEPS);
  const draw = (segs: typeof l.before, y0: number, name: string) => (
    <g data-testid={`tl-${name}`}>
      <text x={0} y={y0 + block / 2} fontSize={12} fill="currentColor">
        {name}
      </text>
      {segs.map((s, i) => {
        const y = y0 + i * (laneH + gap);
        const ph = phaseAt(s, l.arrival[i]!, tNow);
        return (
          <g key={i} data-phase={ph}>
            {s.map((seg, k) => {
              const x0 = X(seg.t0);
              const x1 = X(seg.t1);
              const cut = Math.min(Math.max(X(tNow), x0), x1);
              return (
                <g key={k}>
                  <rect
                    x={x0}
                    y={y}
                    width={Math.max(0, cut - x0)}
                    height={laneH}
                    fill={
                      seg.phase === "queue"
                        ? `url(#tl-hatch)`
                        : PHASE_COLOUR[seg.phase]
                    }
                  />
                  <rect
                    x={cut}
                    y={y}
                    width={Math.max(0, x1 - cut)}
                    height={laneH}
                    fill={
                      seg.phase === "queue"
                        ? PHASE_COLOUR.queue
                        : PHASE_COLOUR[seg.phase]
                    }
                    opacity={0.18}
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
  const visual = (
    <div ref={ref} className="min-w-0">
      <svg
        width={width}
        height={h}
        viewBox={`0 0 ${width} ${h}`}
        role="img"
        aria-label={`Timeline of ${l.ids.length} requests under both configurations. ${cap}`}
        className="block max-w-full text-neutral-800 dark:text-neutral-200"
      >
        <defs>
          <pattern
            id="tl-hatch"
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="4" height="4" fill={PHASE_COLOUR.queue} />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="4"
              stroke="#404040"
              strokeWidth="1.2"
            />
          </pattern>
        </defs>
        {draw(l.before, 14, "before")}
        {draw(l.after, 14 + block + 18, "after")}
        <line
          x1={0}
          x2={width}
          y1={14 + block + 9}
          y2={14 + block + 9}
          stroke="currentColor"
          strokeDasharray="4 4"
          opacity={0.35}
        />
        <line
          x1={X(tNow)}
          x2={X(tNow)}
          y1={6}
          y2={h - 26}
          stroke="#4f46e5"
          strokeWidth={2}
        />
        <text x={left} y={h - 8} fontSize={11} fill="currentColor">
          0 s
        </text>
        <text
          x={width - 8}
          y={h - 8}
          fontSize={11}
          fill="currentColor"
          textAnchor="end"
        >
          {(l.t1 - l.t0).toFixed(1)} s
        </text>
      </svg>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
        {PHASES.map((p) => (
          <span key={p} className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className={`inline-block size-3 rounded-sm ${p === "queue" ? "stall-hatch" : ""}`}
              style={{ background: PHASE_COLOUR[p] }}
            />
            {p === "queue" ? "queued" : p === "handoff" ? "KV hand-off" : p}
          </span>
        ))}
      </p>
    </div>
  );
  return (
    <AnimationPanel
      title="Where the time went, request by request"
      summary={
        <>
          The same {l.ids.length} requests under both configurations, from the
          engine&apos;s own timestamps: queued, prefill, KV hand-off, decode.
          Play sweeps the clock across simulated time.
        </>
      }
      stepper={stepper}
      stepLabel="frame"
      caption={cap}
      visual={visual}
      equation={equation}
      testId="timeline"
    />
  );
}
