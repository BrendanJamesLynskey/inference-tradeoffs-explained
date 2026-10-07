"use client";

/**
 * Chapter 13's animation: the levers together. For each combined
 * configuration (modern colocated, modern disaggregated, modern colocated
 * plus speculation), its relative change from the H100 baseline on the six
 * objectives, as bars on a log scale of the ratio (halving and doubling the
 * same length; blue better, vermillion worse), moving from workload to
 * workload as the sweep measured them.
 */
import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { useWidth } from "@/components/anim/useTween";
import {
  COMBINED,
  COMBINE_METRICS,
  combineCaption,
  ratioScale,
  type CombineFrame,
} from "@/lib/tradeoffs/casesView";
import { METRICS, WORKLOAD_LABEL } from "@/lib/tradeoffs/metrics";
import { VERDICT_COLOUR } from "@/lib/viz/palette";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

export default function CombineWidget({
  frames,
  leverLabels,
  equation,
}: {
  frames: CombineFrame[];
  leverLabels: Record<string, string>;
  equation?: React.ReactNode;
}): JSX.Element {
  const stepper = useStepper(frames.length, { stepMs: 2600, smooth: true });
  const [ref, width] = useWidth(640);
  const k = stepper.step;
  const a = frames[k]!;
  const b = frames[Math.min(k + 1, frames.length - 1)]!;
  const t = stepper.playing ? ease(stepper.frac) : 0;
  const W = width;
  const label = W < 560 ? 76 : 96;
  const half = (W - label - 16) / 2;
  const cx = label + 8 + half;
  const rowH = 18;
  const blockH = 22 + COMBINE_METRICS.length * rowH + 8;
  const H = COMBINED.length * blockH + 26;
  return (
    <AnimationPanel
      title="The levers together, workload by workload"
      summary={
        <>
          Each block is one combined configuration; each bar its change from the
          baseline on one objective, on a log scale of the ratio (halving and
          doubling are the same length). Blue is better, vermillion worse,
          whichever way the metric runs.
        </>
      }
      stepper={stepper}
      stepLabel="workload"
      caption={combineCaption(a, WORKLOAD_LABEL[a.w], leverLabels)}
      testId="mech-combine"
      equation={equation}
      visual={
        <div ref={ref} className="min-w-0">
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Each combined configuration's change from the baseline on six objectives"
            className="text-neutral-800 dark:text-neutral-200"
          >
            {COMBINED.map((l, i) => {
              const y0 = i * blockH;
              return (
                <g key={l}>
                  <text x={4} y={y0 + 14} fontSize={12} fill="currentColor">
                    {leverLabels[l] ?? l}
                  </text>
                  <line
                    x1={cx}
                    x2={cx}
                    y1={y0 + 20}
                    y2={y0 + blockH - 6}
                    stroke="currentColor"
                    strokeOpacity={0.4}
                  />
                  {COMBINE_METRICS.map((m, j) => {
                    const ra = a.rel[l]![j] ?? null;
                    const rb = b.rel[l]![j] ?? null;
                    const y = y0 + 22 + j * rowH;
                    const xa = ra === null ? 0 : ratioScale(ra);
                    const xb = rb === null ? xa : ratioScale(rb);
                    const x = lerp(xa, xb, t);
                    const better = METRICS[m].better === "max" ? x > 0 : x < 0;
                    return (
                      <g key={m}>
                        <text
                          x={4}
                          y={y + 11}
                          fontSize={11}
                          fill="currentColor"
                        >
                          {METRICS[m].label}
                        </text>
                        {ra === null ? (
                          <text
                            x={cx + 4}
                            y={y + 11}
                            fontSize={11}
                            fill="currentColor"
                          >
                            no capacity
                          </text>
                        ) : (
                          <rect
                            x={x >= 0 ? cx : cx + x * half}
                            y={y}
                            width={Math.max(1, Math.abs(x) * half)}
                            height={rowH - 5}
                            fill={
                              better
                                ? VERDICT_COLOUR.better
                                : VERDICT_COLOUR.worse
                            }
                          />
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
            <text
              x={cx}
              y={H - 6}
              fontSize={11}
              textAnchor="middle"
              fill="currentColor"
            >
              baseline
            </text>
            <text x={label + 8} y={H - 6} fontSize={11} fill="currentColor">
              ÷64
            </text>
            <text
              x={W - 8}
              y={H - 6}
              fontSize={11}
              textAnchor="end"
              fill="currentColor"
            >
              ×64
            </text>
          </svg>
        </div>
      }
    />
  );
}
