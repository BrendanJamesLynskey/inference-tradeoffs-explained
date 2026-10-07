"use client";

/**
 * Chapter 11's mechanism: power per GPU, step by step. One colocated
 * instance of Llama-3-70B on four H100s serves ten requests; each bar is
 * one forward pass, as wide as it took and as tall as the power it drew
 * per GPU: static (idle) power, then the compute and the memory energy
 * over the step's time (the simulator's power model). Prefills are
 * compute-bound and tall; decodes are memory-bound and lower. A cap
 * clips the tall ones (hatched: power-bound), which stretches them.
 */
import { useMemo, useState } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { useWidth } from "@/components/anim/useTween";
import { Segmented, Stat } from "@/components/ui/Controls";
import {
  fmtSeconds,
  frameTime,
  peakPower,
  powerBars,
  powerCaption,
  devicesOf,
  variantOf,
} from "@/lib/tradeoffs/mech";
import { OKABE_ITO } from "@/lib/viz/palette";

import { Hatch, Loading, Provenance, useMech } from "./common";

const FRAMES = 80;
const COLOUR = {
  idle: "#a3a3a3",
  compute: OKABE_ITO.purple,
  memory: OKABE_ITO.sky,
};

export default function PowerWidget({
  equation,
}: {
  equation?: React.ReactNode;
}): JSX.Element {
  const f = useMech("power");
  const [key, setKey] = useState("default");
  const [ref, width] = useWidth(640);
  const stepper = useStepper(FRAMES, { stepMs: 260, resetKey: key });
  const v = f ? variantOf(f, key) : null;
  const bars = useMemo(() => (v ? powerBars(v) : []), [v]);
  if (!f || !v) return <Loading what="power animation" />;
  const t = frameTime(v, stepper.step, FRAMES);
  // the same scale for every variant: the uncapped run's peak
  const top = Math.max(
    ...f.variants.flatMap((x) =>
      powerBars(x).map((b) => b.idle + b.compute + b.memory),
    ),
  );
  const W = width;
  const pad = 4;
  const axisW = 40;
  const plotH = 170;
  const y0 = 24;
  const T = v.horizon;
  const x = (s: number) => pad + axisW + (s / T) * (W - axisW - 2 * pad);
  const y = (w: number) => y0 + plotH - (w / top) * plotH;
  const cap = typeof v.cfg.powerCap === "number" ? v.cfg.powerCap : null;
  const cur = bars.find((b) => b.t0 <= t && t < b.t1);
  const H = y0 + plotH + 44;
  const hl = cur
    ? cur.bound === "power"
      ? "u"
      : cur.bound === "compute"
        ? "c"
        : "w"
    : "t";
  return (
    <AnimationPanel
      title="Power per GPU, step by step"
      summary={
        <>
          One instance of Llama-3-70B on four H100s serves ten requests. Each
          bar is one forward pass, as wide as it took and as tall as the power
          per GPU it drew: static (grey), compute (purple), memory (sky).
          Hatched passes hit the power cap. Pick a cap or DVFS.
        </>
      }
      stepper={stepper}
      stepLabel="frame"
      countFrom={0}
      caption={powerCaption(v, bars, t)}
      testId="mech-power"
      equation={equation}
      hl={hl}
      visual={
        <div ref={ref} className="min-w-0">
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Power per GPU of every forward pass over time, split into static, compute and memory power"
            className="text-neutral-800 dark:text-neutral-200"
          >
            <defs>
              <Hatch id="pw-cap" colour={OKABE_ITO.vermillion} />
            </defs>
            <text x={pad} y={14} fontSize={12} fill="currentColor">
              W per GPU · {v.label}
            </text>
            {[0, 0.5, 1].map((q) => (
              <g key={q}>
                <line
                  x1={pad + axisW}
                  x2={W - pad}
                  y1={y(q * top)}
                  y2={y(q * top)}
                  stroke="currentColor"
                  strokeOpacity={0.12}
                />
                <text
                  x={pad}
                  y={y(q * top) + 4}
                  fontSize={11}
                  fill="currentColor"
                >
                  {(q * top).toFixed(0)}
                </text>
              </g>
            ))}
            {bars.map((b, i) => {
              const bx = x(b.t0);
              const bw = Math.max(0.6, x(b.t1) - x(b.t0) - 0.2);
              const op = b.t0 > t ? 0.12 : 1;
              const yi = y(b.idle);
              const yc = y(b.idle + b.compute);
              const ym = y(b.idle + b.compute + b.memory);
              return (
                <g key={i} opacity={op}>
                  <rect
                    x={bx}
                    y={yi}
                    width={bw}
                    height={y0 + plotH - yi}
                    fill={COLOUR.idle}
                  />
                  <rect
                    x={bx}
                    y={yc}
                    width={bw}
                    height={yi - yc}
                    fill={COLOUR.compute}
                  />
                  <rect
                    x={bx}
                    y={ym}
                    width={bw}
                    height={yc - ym}
                    fill={COLOUR.memory}
                  />
                  {b.bound === "power" && (
                    <rect
                      x={bx}
                      y={ym}
                      width={bw}
                      height={y0 + plotH - ym}
                      fill="url(#pw-cap)"
                    />
                  )}
                </g>
              );
            })}
            {cap !== null && (
              <g>
                <line
                  x1={pad + axisW}
                  x2={W - pad}
                  y1={y(cap)}
                  y2={y(cap)}
                  stroke={OKABE_ITO.vermillion}
                  strokeDasharray="5 3"
                  strokeWidth={1.5}
                />
                <text
                  x={W - pad}
                  y={y(cap) - 4}
                  fontSize={11}
                  textAnchor="end"
                  fill="currentColor"
                >
                  cap {cap.toFixed(0)} W
                </text>
              </g>
            )}
            <line
              x1={x(t)}
              x2={x(t)}
              y1={y0}
              y2={y0 + plotH}
              stroke={OKABE_ITO.blue}
              strokeWidth={1.5}
            />
            <text x={pad + axisW} y={H - 18} fontSize={11} fill="currentColor">
              0
            </text>
            <text
              x={W - pad}
              y={H - 18}
              fontSize={11}
              textAnchor="end"
              fill="currentColor"
            >
              {fmtSeconds(T)}
            </text>
            <text x={pad} y={H - 4} fontSize={11} fill="currentColor">
              {W < 560
                ? "grey static · purple compute · sky memory"
                : "grey static · purple compute · sky memory · hatched: power-bound"}
            </text>
          </svg>
        </div>
      }
      stats={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="J / output token"
            value={v.summary.j_per_tok.toFixed(2)}
          />
          <Stat
            label="Peak W per GPU"
            value={(peakPower(v) / devicesOf(v)).toFixed(0)}
          />
          <Stat label="TPOT p99" value={fmtSeconds(v.summary.tpot_p99)} />
          <Stat label="All done at" value={fmtSeconds(v.horizon)} />
        </div>
      }
      params={
        <div className="sm:col-span-2">
          <Segmented
            label="Power management"
            value={key}
            options={f.variants.map((x) => ({ value: x.key, label: x.label }))}
            onChange={setKey}
          />
          <Provenance f={f} />
        </div>
      }
    />
  );
}
