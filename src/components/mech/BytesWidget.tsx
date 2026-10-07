"use client";

/**
 * Chapter 9's mechanism: a decode step is the time to read its bytes. Two
 * copies of one 64-row decode step of Llama-3-70B on four GPUs, BF16
 * against the format chosen, run side by side on one clock: the weights
 * stream out of HBM (the larger part), then each row's KV cache. Fewer
 * bytes per weight finish sooner; the times are the vendored engine's cost
 * model, live for the device and format chosen.
 */
import { useMemo, useState } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { useWidth } from "@/components/anim/useTween";
import { Segmented, Stat } from "@/components/ui/Controls";
import { formatSteps, native } from "@/lib/tradeoffs/costs";
import { fmtSeconds, streamCaption } from "@/lib/tradeoffs/mech";
import { OKABE_ITO } from "@/lib/viz/palette";

const FRAMES = 60;
const CTX = 64 * 2048 + 64;

const FORMATS = {
  w8a16: { w: "fp8", kv: "bf16", c: "bf16", label: "FP8 weights (W8A16)" },
  w8a8: { w: "fp8", kv: "bf16", c: "fp8", label: "FP8 W8A8" },
  w4a16: { w: "int4", kv: "bf16", c: "bf16", label: "INT4 weights (W4A16)" },
  kv8: { w: "bf16", kv: "fp8", c: "bf16", label: "FP8 KV cache" },
  all8: { w: "fp8", kv: "fp8", c: "fp8", label: "FP8 weights, matmuls, KV" },
  w4a4: { w: "fp4", kv: "bf16", c: "fp4", label: "FP4 W4A4 (B200)" },
} as const;
type FKey = keyof typeof FORMATS;

export default function BytesWidget({
  equation,
}: {
  equation?: React.ReactNode;
}): JSX.Element {
  const [dev, setDev] = useState("h100");
  const [fmt, setFmt] = useState<FKey>("w8a8");
  const F = FORMATS[fmt];
  const ok = native(dev, F.c);
  const base = useMemo(() => formatSteps(dev, "bf16", "bf16", "bf16"), [dev]);
  const alt = useMemo(
    () => (ok ? formatSteps(dev, F.w, F.kv, F.c) : null),
    [dev, F.w, F.kv, F.c, ok],
  );
  const stepper = useStepper(FRAMES, {
    stepMs: 120,
    resetKey: `${dev}-${fmt}`,
  });
  const [ref, width] = useWidth(640);
  const runs = [
    { label: "BF16", s: base },
    ...(alt ? [{ label: F.label, s: alt }] : []),
  ];
  const tMax = Math.max(...runs.map((r) => r.s.decodeB64.time));
  const t = (tMax * stepper.step) / (FRAMES - 1);
  const W = width;
  const barW = W - 16;
  const H = 30 + runs.length * 62 + 10;
  const parts = runs.map((r) => {
    const kv = CTX * r.s.kvTok;
    const total = r.s.decodeB64.bytes;
    return { w: total - kv, kv, total, time: r.s.decodeB64.time };
  });
  const streams = runs.map((r, i) => ({
    label: r.label,
    time: parts[i]!.time,
    total: parts[i]!.total,
    weights: parts[i]!.w,
  }));
  const scale = barW / Math.max(...parts.map((p) => p.total));
  const inWeights = parts.some((p) => Math.min(1, t / p.time) * p.total < p.w);
  return (
    <AnimationPanel
      title="A decode step is the time to read its bytes"
      summary={
        <>
          One 64-row decode step of Llama-3-70B on four GPUs, BF16 against the
          format chosen, on one clock: the weights stream out of HBM (purple),
          then each row&apos;s KV cache (sky). Bars are to scale in bytes; the
          times are the engine&apos;s cost model, live.
        </>
      }
      stepper={stepper}
      stepLabel="frame"
      countFrom={0}
      caption={
        alt
          ? streamCaption(streams, t)
          : `${dev.toUpperCase()} has no ${F.c.toUpperCase()} units: the engine rejects this format there (use weight-only instead).`
      }
      testId="mech-bytes"
      equation={equation}
      hl={inWeights ? "w" : "c"}
      visual={
        <div ref={ref} className="min-w-0">
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="The bytes one decode step reads, weights then KV, filling at the speed of HBM, for BF16 and the chosen format"
            className="text-neutral-800 dark:text-neutral-200"
          >
            <text x={8} y={14} fontSize={12} fill="currentColor">
              t = {fmtSeconds(t)}
            </text>
            {parts.map((p, i) => {
              const y = 30 + i * 62;
              const done = Math.min(1, t / p.time) * p.total;
              const wDone = Math.min(done, p.w);
              const kvDone = Math.max(0, done - p.w);
              return (
                <g key={runs[i]!.label}>
                  <text x={8} y={y + 10} fontSize={11} fill="currentColor">
                    {runs[i]!.label}: {(p.total / 1e9).toFixed(1)} GB in{" "}
                    {fmtSeconds(p.time)}
                  </text>
                  <rect
                    x={8}
                    y={y + 16}
                    width={p.total * scale}
                    height={22}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={0.3}
                  />
                  <rect
                    x={8}
                    y={y + 16}
                    width={wDone * scale}
                    height={22}
                    fill={OKABE_ITO.purple}
                  />
                  <rect
                    x={8 + p.w * scale}
                    y={y + 16}
                    width={kvDone * scale}
                    height={22}
                    fill={OKABE_ITO.sky}
                  />
                  <line
                    x1={8 + p.w * scale}
                    x2={8 + p.w * scale}
                    y1={y + 14}
                    y2={y + 40}
                    stroke="currentColor"
                    strokeOpacity={0.5}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      }
      stats={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Decode b=1"
            value={alt ? fmtSeconds(alt.decodeB1.time) : "–"}
          />
          <Stat
            label="Decode b=64"
            value={alt ? fmtSeconds(alt.decodeB64.time) : "–"}
          />
          <Stat
            label="Prefill 8,192"
            value={alt ? fmtSeconds(alt.prefill8192.time) : "–"}
          />
          <Stat
            label="KV room"
            value={alt ? `${alt.kvTokens.toLocaleString("en-GB")} tok` : "–"}
          />
        </div>
      }
      params={
        <>
          <Segmented
            label="Device"
            value={dev}
            options={[
              { value: "h100", label: "H100" },
              { value: "b200", label: "B200" },
            ]}
            onChange={setDev}
          />
          <Segmented
            label="Format against BF16"
            value={fmt}
            options={(Object.keys(FORMATS) as FKey[]).map((k) => ({
              value: k,
              label: FORMATS[k].label,
            }))}
            onChange={setFmt}
          />
        </>
      }
    />
  );
}
