"use client";

/**
 * Chapter 12's animation: what each device buys, workload by workload.
 * For H100, H200 and B200, the baseline's goodput per GPU and dollars per
 * million output tokens, and the same for the best lever on that device;
 * the bars move to each workload's measured values in turn (a pure function
 * of the two workloads' values and the clock).
 */
import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { useWidth } from "@/components/anim/useTween";
import { costCaption, type DeviceBars } from "@/lib/tradeoffs/casesView";
import { HW_LABEL, WORKLOAD_LABEL } from "@/lib/tradeoffs/metrics";
import { OKABE_ITO } from "@/lib/viz/palette";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

export default function CostWidget({
  frames,
  leverLabels,
  equation,
}: {
  frames: DeviceBars[];
  leverLabels: Record<string, string>;
  equation?: React.ReactNode;
}): JSX.Element {
  const stepper = useStepper(frames.length, { stepMs: 2600, smooth: true });
  const [ref, width] = useWidth(640);
  const k = stepper.step;
  const a = frames[k]!;
  const b = frames[Math.min(k + 1, frames.length - 1)]!;
  const t = stepper.playing ? ease(stepper.frac) : 0;
  const rows = a.rows.map((r, i) => {
    const s = b.rows[i]!;
    return {
      hw: r.hw,
      bg: lerp(r.base.goodput, s.base.goodput, t),
      bu: lerp(r.base.usd, s.base.usd, t),
      tg: lerp(r.best.goodput, s.best.goodput, t),
      tu: lerp(r.best.usd, s.best.usd, t),
      lever: r.best.lever,
    };
  });
  const gMax = Math.max(
    ...frames.flatMap((f) => f.rows.map((r) => r.best.goodput)),
  );
  const uMax = Math.max(
    ...frames.flatMap((f) => f.rows.map((r) => r.base.usd)),
  );
  const W = width;
  const narrow = W < 560;
  const colW = narrow ? W - 8 : (W - 24) / 2;
  const label = 52;
  const bw = colW - label - 70;
  const rowH = 46;
  const blockH = 20 + rows.length * rowH;
  const H = (narrow ? 2 * blockH + 20 : blockH) + 20;
  const block = (x0: number, y0: number, title: string, which: "g" | "u") => (
    <g>
      <text x={x0} y={y0 + 12} fontSize={12} fill="currentColor">
        {title}
      </text>
      {rows.map((r, i) => {
        const y = y0 + 20 + i * rowH;
        const base = which === "g" ? r.bg : r.bu;
        const top = which === "g" ? r.tg : r.tu;
        const max = which === "g" ? gMax : uMax;
        const fmt = (v: number) =>
          which === "g" ? v.toFixed(2) : `$${v.toFixed(2)}`;
        return (
          <g key={r.hw}>
            <text x={x0} y={y + 14} fontSize={11} fill="currentColor">
              {HW_LABEL[r.hw]}
            </text>
            <rect
              x={x0 + label}
              y={y}
              width={Math.max(1, (base / max) * bw)}
              height={16}
              fill="#a3a3a3"
            />
            <text
              x={x0 + label + Math.max(1, (base / max) * bw) + 4}
              y={y + 12}
              fontSize={11}
              fill="currentColor"
            >
              {fmt(base)}
            </text>
            <rect
              x={x0 + label}
              y={y + 20}
              width={Math.max(1, (Math.min(top, max) / max) * bw)}
              height={16}
              fill={which === "g" ? OKABE_ITO.blue : OKABE_ITO.green}
            />
            <text
              x={x0 + label + Math.max(1, (Math.min(top, max) / max) * bw) + 4}
              y={y + 32}
              fontSize={11}
              fill="currentColor"
            >
              {fmt(top)}
            </text>
          </g>
        );
      })}
    </g>
  );
  return (
    <AnimationPanel
      title="What each device buys, workload by workload"
      summary={
        <>
          For each GPU, the baseline configuration (grey) and its best lever
          (colour): goodput per GPU and dollars per million output tokens at the
          illustrative prices. The bars move from workload to workload as the
          sweep measured them.
        </>
      }
      stepper={stepper}
      stepLabel="workload"
      caption={costCaption(a, WORKLOAD_LABEL[a.w], leverLabels)}
      testId="mech-cost"
      equation={equation}
      hl={k % 2 ? "c" : "t"}
      visual={
        <div ref={ref} className="min-w-0">
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Goodput per GPU and dollars per million tokens for each device, baseline and best lever"
            className="text-neutral-800 dark:text-neutral-200"
          >
            {block(4, 0, `Goodput / GPU · ${WORKLOAD_LABEL[a.w]}`, "g")}
            {block(
              narrow ? 4 : colW + 20,
              narrow ? blockH + 20 : 0,
              "$ / M output tokens",
              "u",
            )}
          </svg>
        </div>
      }
    />
  );
}
