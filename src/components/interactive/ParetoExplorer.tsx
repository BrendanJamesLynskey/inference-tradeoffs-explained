"use client";

/**
 * The Pareto explorer: every swept configuration of one workload as a point
 * on two chosen metrics, with the front drawn. The animation tours the
 * workloads (play, step, scrub): when the workload or the SLO filter
 * changes, the points move and fade to their new places and the front
 * re-forms, each frame computed by `frame(from, to, t)` from the recorded
 * sweep (src/lib/tradeoffs/explorer.ts). Hover a point for its
 * configuration; click it to open it in the live simulator.
 */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { useTween, useWidth } from "@/components/anim/useTween";
import { Segmented } from "@/components/ui/Controls";
import { trim } from "@/lib/format";
import type { Caveat } from "@/lib/tradeoffs/caveats";
import {
  SLO_SCALES,
  caption as explorerCaption,
  domainOf,
  frame,
  layout,
  sloLabel,
  ticks,
  type Dims,
  type ExplorerPoint,
  type ExplorerState,
  type SloInfo,
} from "@/lib/tradeoffs/explorer";
import {
  AXIS_METRICS,
  FAMILIES,
  FAMILY_LABEL,
  HARDWARE,
  HW_LABEL,
  METRICS,
  WORKLOADS,
  type HwKey,
  type MetricKey,
  type WorkloadKey,
} from "@/lib/tradeoffs/metrics";
import { FAMILY_COLOUR } from "@/lib/viz/palette";

const SEL =
  "focus-ring h-11 w-full min-w-0 rounded border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950";

/** Axis tick labels: short, in the metric's unit. */
export function tickLabel(k: MetricKey, v: number): string {
  const u = METRICS[k].unit;
  if (u === "s") return v < 1 ? `${trim(v * 1e3, 3)} ms` : `${trim(v, 3)} s`;
  if (k === "usd_per_mtok") return `$${trim(v, 3)}`;
  if (k === "j_per_tok") return `${trim(v, 3)} J`;
  return trim(v, 3);
}

/** A device's mark, centred on (x, y). */
function Mark({
  hw,
  x,
  y,
  r,
  fill,
  stroke,
  sw,
  fo,
  op,
}: {
  hw: HwKey;
  x: number;
  y: number;
  r: number;
  fill: string;
  stroke: string;
  sw: number;
  fo: number;
  op: number;
}): JSX.Element {
  const common = {
    fill,
    stroke,
    strokeWidth: sw,
    fillOpacity: fo,
    opacity: op,
  };
  if (hw === "h100") return <circle cx={x} cy={y} r={r} {...common} />;
  if (hw === "h200")
    return (
      <rect
        x={x - r * 0.9}
        y={y - r * 0.9}
        width={r * 1.8}
        height={r * 1.8}
        {...common}
      />
    );
  const h = r * 1.15;
  return (
    <polygon
      points={`${x},${y - h} ${x + h},${y + h * 0.8} ${x - h},${y + h * 0.8}`}
      {...common}
    />
  );
}

export default function ParetoExplorer({
  points,
  workloads,
  caveats,
  initial = { x: "goodput_req_s_per_gpu", y: "ttft_p99" },
  compact = false,
  testId = "explorer",
  equation,
}: {
  points: ExplorerPoint[];
  workloads: SloInfo[];
  caveats: Caveat[];
  initial?: { x: MetricKey; y: MetricKey; workload?: WorkloadKey };
  compact?: boolean;
  testId?: string;
  /** Server-rendered KaTeX: what "on the front" means. */
  equation?: React.ReactNode;
}): JSX.Element {
  const router = useRouter();
  const [x, setX] = useState<MetricKey>(initial.x);
  const [y, setY] = useState<MetricKey>(initial.y);
  const [hw, setHw] = useState<HwKey[]>([...HARDWARE]);
  const [slo, setSlo] = useState<number>(Infinity);
  const [hover, setHover] = useState<string | null>(null);
  const stepper = useStepper(WORKLOADS.length, {
    stepMs: 2600,
    resetKey: `${x}|${y}`,
  });
  const startAt = initial.workload ? WORKLOADS.indexOf(initial.workload) : 0;
  const { setStep } = stepper;
  // a deep link names a workload: start there (paused)
  useEffect(() => {
    if (startAt > 0) setStep(startAt);
  }, [startAt, setStep]);
  const workload = WORKLOADS[stepper.step]!;
  const label = (w: WorkloadKey) => workloads.find((s) => s.key === w)!.label;

  const [wrapRef, width] = useWidth(compact ? 420 : 720);
  const narrow = width < 520;
  const dims: Dims = useMemo(
    () => ({
      w: width,
      h: compact
        ? Math.round(Math.min(340, Math.max(260, width * 0.72)))
        : Math.round(Math.min(460, Math.max(300, width * 0.62))),
      left: narrow ? 54 : 66,
      right: 14,
      top: 14,
      bottom: 44,
    }),
    [width, compact, narrow],
  );
  const domains = useMemo(
    () => ({ x: domainOf(points, x), y: domainOf(points, y) }),
    [points, x, y],
  );
  const st: ExplorerState = useMemo(
    () => ({ workload, x, y, hw, slo }),
    [workload, x, y, hw, slo],
  );
  const target = useMemo(
    () => layout(points, workloads, st, dims, domains),
    [points, workloads, st, dims, domains],
  );
  const tween = useTween(target, `${workload}|${x}|${y}|${hw.join()}|${slo}`);
  const f = frame(tween.from, tween.to, tween.t);
  const byId = useMemo(
    () => new Map(points.filter((p) => p.w === workload).map((p) => [p.id, p])),
    [points, workload],
  );
  const prevLayout =
    tween.from && tween.from.workload !== workload ? tween.from : null;
  const cap = explorerCaption(target, prevLayout, points, st, label(workload));

  const xt = ticks(domains.x, narrow ? 4 : 7);
  const yt = ticks(domains.y, 6);
  const X = (v: number) =>
    dims.left +
    ((Math.log10(v) - domains.x.lo) / (domains.x.hi - domains.x.lo)) *
      (dims.w - dims.left - dims.right);
  const Y = (v: number) =>
    dims.h -
    dims.bottom -
    ((Math.log10(v) - domains.y.lo) / (domains.y.hi - domains.y.lo)) *
      (dims.h - dims.top - dims.bottom);
  const hovered = hover ? byId.get(hover) : undefined;
  const hp = hover ? target.pts.get(hover) : undefined;
  const open = (id: string) => {
    const p = byId.get(id);
    if (p) router.push(`/what-if?w=${p.w}&hw=${p.hw}&lever=${p.lever}`);
  };
  const better = (k: MetricKey) =>
    METRICS[k].better === "max" ? "higher is better" : "lower is better";
  const shownCaveats = caveats.filter(
    (c) =>
      (c.key === "price" && (x === "usd_per_mtok" || y === "usd_per_mtok")) ||
      (c.key === "edge" &&
        (METRICS[x].at === "capacity" || METRICS[y].at === "capacity")) ||
      (c.key === "b200" && hw.includes("b200")) ||
      c.key === "pp" ||
      c.key === "tp" ||
      c.key === "alpha",
  );

  const visual = (
    <div
      ref={wrapRef}
      className="relative min-w-0"
      data-testid="explorer-chart"
    >
      <svg
        width={dims.w}
        height={dims.h}
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        role="img"
        aria-label={`${METRICS[y].label} against ${METRICS[x].label} for ${label(workload)}: ${cap}`}
        className="block max-w-full text-neutral-800 dark:text-neutral-200"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <pattern
            id={`${testId}-hatch`}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="5"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.35"
            />
          </pattern>
        </defs>
        {/* grid and axes */}
        {xt.map((v) => (
          <g key={`x${v}`}>
            <line
              x1={X(v)}
              x2={X(v)}
              y1={dims.top}
              y2={dims.h - dims.bottom}
              stroke="currentColor"
              opacity={0.12}
            />
            <text
              x={X(v)}
              y={dims.h - dims.bottom + 16}
              textAnchor="middle"
              fontSize={11}
              fill="currentColor"
            >
              {tickLabel(x, v)}
            </text>
          </g>
        ))}
        {yt.map((v) => (
          <g key={`y${v}`}>
            <line
              x1={dims.left}
              x2={dims.w - dims.right}
              y1={Y(v)}
              y2={Y(v)}
              stroke="currentColor"
              opacity={0.12}
            />
            <text
              x={dims.left - 6}
              y={Y(v) + 4}
              textAnchor="end"
              fontSize={11}
              fill="currentColor"
            >
              {tickLabel(y, v)}
            </text>
          </g>
        ))}
        <text
          x={(dims.left + dims.w - dims.right) / 2}
          y={dims.h - 6}
          textAnchor="middle"
          fontSize={12}
          fill="currentColor"
        >
          {METRICS[x].label} ({better(x)}, log)
        </text>
        <text
          x={12}
          y={(dims.top + dims.h - dims.bottom) / 2}
          textAnchor="middle"
          fontSize={12}
          fill="currentColor"
          transform={`rotate(-90 12 ${(dims.top + dims.h - dims.bottom) / 2})`}
        >
          {METRICS[y].label} ({better(y)}, log)
        </text>
        {/* the fronts: the old one fades out as the new one fades in */}
        {f.fromLine.length > 1 && (
          <polyline
            points={f.fromLine.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke="#4f46e5"
            strokeWidth={2.5}
            opacity={1 - f.t}
          />
        )}
        {f.toLine.length > 1 && (
          <polyline
            points={f.toLine.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke="#4f46e5"
            strokeWidth={2.5}
            opacity={f.t}
            data-testid="front-line"
          />
        )}
        {f.pts.map((p) => {
          const meta = byId.get(p.id) ?? points.find((q) => q.id === p.id)!;
          const colour = FAMILY_COLOUR[meta.fam] ?? "currentColor";
          const r = (narrow ? 4 : 5) + 2.5 * p.front;
          return (
            <g
              key={p.id}
              data-id={p.id}
              data-front={p.front > 0.5 ? "1" : "0"}
              className="cursor-pointer"
              onMouseEnter={() => setHover(p.id)}
              onClick={() => open(p.id)}
            >
              <Mark
                hw={meta.hw}
                x={p.px}
                y={p.py}
                r={r}
                fill={meta.fam === "combined" ? "none" : colour}
                stroke={
                  meta.fam === "speculative" ||
                  meta.fam === "combined" ||
                  p.front > 0.5
                    ? "currentColor"
                    : colour
                }
                sw={meta.fam === "combined" ? 2 : 1 + p.front}
                fo={0.12 + 0.78 * p.pass}
                op={p.opacity * (0.35 + 0.65 * p.pass)}
              />
              {/* a larger invisible target for the pointer */}
              <circle cx={p.px} cy={p.py} r={10} fill="transparent" />
            </g>
          );
        })}
      </svg>
      {hovered && hp && (
        <div
          role="tooltip"
          data-testid="explorer-tooltip"
          className="pointer-events-none absolute z-10 max-w-64 rounded border border-neutral-300 bg-white p-2 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          style={{
            left: Math.min(Math.max(0, hp.px - 120), Math.max(0, dims.w - 256)),
            top:
              hp.py + 14 > dims.h - 90 ? Math.max(0, hp.py - 96) : hp.py + 14,
          }}
        >
          <p className="font-semibold">{hovered.label}</p>
          <p className="text-neutral-600 dark:text-neutral-400">
            {HW_LABEL[hovered.hw]} ·{" "}
            {FAMILY_LABEL[hovered.fam as keyof typeof FAMILY_LABEL]}
            {hp.front ? " · on the front" : ""}
          </p>
          <p className="mt-1 font-mono">
            {METRICS[x].label}: {METRICS[x].fmt(hovered.m[x]!)}
            <br />
            {METRICS[y].label}: {METRICS[y].fmt(hovered.m[y]!)}
          </p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">
            Click to open it in the live simulator.
          </p>
        </div>
      )}
    </div>
  );

  const frontList = target.frontIds.map((id) => byId.get(id)!);
  const stats = (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Legend">
        {FAMILIES.map((fam) => (
          <span key={fam} className="inline-flex items-center gap-1">
            <svg
              width="12"
              height="12"
              aria-hidden
              className="text-neutral-800 dark:text-neutral-200"
            >
              <circle
                cx="6"
                cy="6"
                r="4.5"
                fill={fam === "combined" ? "none" : FAMILY_COLOUR[fam]}
                stroke={
                  fam === "speculative" || fam === "combined"
                    ? "currentColor"
                    : FAMILY_COLOUR[fam]
                }
                strokeWidth={fam === "combined" ? 2 : 1}
              />
            </svg>
            {FAMILY_LABEL[fam]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <svg
            width="40"
            height="12"
            aria-hidden
            className="text-neutral-800 dark:text-neutral-200"
          >
            <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" />
            <rect
              x="15"
              y="2.4"
              width="7.2"
              height="7.2"
              fill="none"
              stroke="currentColor"
            />
            <polygon
              points="33,1.4 37.6,9.2 28.4,9.2"
              fill="none"
              stroke="currentColor"
            />
          </svg>
          H100 · H200 · B200
        </span>
      </div>
      {!compact && (
        <details className="rounded bg-white p-2 ring-1 ring-neutral-200 dark:bg-neutral-950 dark:ring-neutral-800">
          <summary className="focus-ring cursor-pointer font-medium">
            The front: {frontList.length} configurations (open each in the live
            simulator)
          </summary>
          <ol className="mt-2 space-y-1" data-testid="front-list">
            {frontList.map((p) => (
              <li key={p.id}>
                <a
                  href={`/what-if?w=${p.w}&hw=${p.hw}&lever=${p.lever}`}
                  className="focus-ring rounded text-accent underline underline-offset-2 dark:text-indigo-300"
                >
                  {p.label}, {HW_LABEL[p.hw]}
                </a>
                : {METRICS[x].fmt(p.m[x]!)}, {METRICS[y].fmt(p.m[y]!)}
              </li>
            ))}
          </ol>
        </details>
      )}
      <p className="text-neutral-600 dark:text-neutral-400">
        {METRICS[x].at === "capacity" || METRICS[y].at === "capacity"
          ? "Goodput, throughput, cost and energy are at each configuration's capacity; latencies are at the workload's reference load. "
          : "Latencies are at the workload's reference load, the same offered load for every configuration. "}
        {target.missing > 0 &&
          `${target.missing} configurations had no capacity at this workload's SLOs, so they have no cost or energy per token and are not drawn. `}
        Hollow, faded points are outside the SLO filter.
      </p>
      <ul
        className="space-y-1 text-neutral-600 dark:text-neutral-400"
        aria-label="Caveats"
      >
        {shownCaveats.map((c) => (
          <li key={c.key}>
            <span className="mr-1 font-mono font-semibold text-neutral-800 dark:text-neutral-200">
              {c.mark}
            </span>
            {c.short}.{" "}
            <a
              href={`/method#caveat-${c.key}`}
              className="focus-ring rounded underline underline-offset-2"
            >
              Why
            </a>
          </li>
        ))}
      </ul>
    </div>
  );

  const params = (
    <>
      <Segmented
        label="Workload"
        value={workload}
        options={WORKLOADS.map((w) => ({ value: w, label: label(w) }))}
        onChange={(w) => stepper.setStep(WORKLOADS.indexOf(w))}
      />
      {!compact && (
        <>
          <Segmented
            label="SLO filter (p99 at the reference load)"
            value={sloLabel(slo)}
            options={SLO_SCALES.map((s) => ({
              value: sloLabel(s),
              label: sloLabel(s),
            }))}
            onChange={(v) => setSlo(SLO_SCALES.find((s) => sloLabel(s) === v)!)}
          />
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
            Horizontal axis
            <select
              value={x}
              onChange={(e) => setX(e.target.value as MetricKey)}
              className={SEL}
              data-testid="x-metric"
            >
              {AXIS_METRICS.filter((k) => k !== y).map((k) => (
                <option key={k} value={k}>
                  {METRICS[k].label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
            Vertical axis
            <select
              value={y}
              onChange={(e) => setY(e.target.value as MetricKey)}
              className={SEL}
              data-testid="y-metric"
            >
              {AXIS_METRICS.filter((k) => k !== x).map((k) => (
                <option key={k} value={k}>
                  {METRICS[k].label}
                </option>
              ))}
            </select>
          </label>
          <div className="min-w-0">
            <span className="text-xs font-medium uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Devices
            </span>
            <div
              className="mt-1 flex flex-wrap gap-1"
              role="group"
              aria-label="Devices"
            >
              {HARDWARE.map((h) => {
                const on = hw.includes(h);
                return (
                  <button
                    key={h}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setHw(
                        on
                          ? hw.length > 1
                            ? hw.filter((v) => v !== h)
                            : hw
                          : HARDWARE.filter((v) => v === h || hw.includes(v)),
                      )
                    }
                    className={`focus-ring h-11 min-w-16 rounded border px-3 text-sm ${
                      on
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-neutral-300 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
                    }`}
                  >
                    {HW_LABEL[h]}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );

  return (
    <AnimationPanel
      title={
        compact ? "The trade-off, workload by workload" : "Pareto explorer"
      }
      summary={
        <>
          Every swept configuration of one workload on two metrics, the front
          drawn through the ones nothing beats on both. Play tours the
          workloads: the points move to where that workload puts them.
        </>
      }
      stepper={stepper}
      stepLabel="workload"
      caption={cap}
      visual={visual}
      stats={stats}
      params={params}
      equation={equation}
      testId={testId}
    />
  );
}
