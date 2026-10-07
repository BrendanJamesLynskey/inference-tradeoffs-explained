"use client";

/**
 * Chapter 3's mechanism: a prefix cache filling and serving hits. Four
 * three-turn sessions share two system prompts (Mistral-7B, one A100,
 * paged KV); each turn's prompt is the system prompt, the earlier turns and
 * its new input. Left: the cached segments (solid while a running request
 * pins them, hatched when only the LRU list holds them). Right: each
 * running request's prompt, split into the part found in the cache and the
 * part it had to compute, then its output.
 */
import { useMemo, useState } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { useWidth } from "@/components/anim/useTween";
import { Segmented, Stat } from "@/components/ui/Controls";
import {
  fmtSeconds,
  frameTime,
  prefixCaption,
  prefixView,
  variantOf,
} from "@/lib/tradeoffs/mech";
import { OKABE_ITO, PHASE_COLOUR } from "@/lib/viz/palette";

import { Hatch, Loading, Provenance, useMech } from "./common";

const FRAMES = 80;

export default function PrefixWidget({
  equation,
}: {
  equation?: React.ReactNode;
}): JSX.Element {
  const f = useMech("prefix");
  const [key, setKey] = useState("on");
  const [ref, width] = useWidth(640);
  const stepper = useStepper(FRAMES, { stepMs: 300, resetKey: key });
  const v = f ? variantOf(f, key) : null;
  const t = v ? frameTime(v, stepper.step, FRAMES) : 0;
  const p = useMemo(() => (v ? prefixView(v, t) : null), [v, t]);
  if (!f || !v || !p) return <Loading what="prefix-cache animation" />;
  const W = width;
  const narrow = W < 560;
  const colW = narrow ? W - 8 : (W - 24) / 2;
  const maxSeg = Math.max(
    1,
    ...v.steps.flatMap((s) => (s.cache ?? []).map((c) => c[1])),
  );
  const maxPrompt = Math.max(
    1,
    ...v.steps.flatMap((s) => s.rows.map((r) => r[2] + r[3])),
  );
  const rowH = 18;
  const segs = p.segments;
  const leftH = 24 + Math.max(1, segs.length) * rowH;
  const rightX = narrow ? 4 : colW + 20;
  const rightY = narrow ? leftH + 16 : 0;
  const rightH = 24 + Math.max(1, p.rows.length) * rowH;
  const H = Math.max(leftH, rightY + rightH) + 26;
  const labelW = 54;
  const segScale = (colW - labelW - 8) / maxSeg;
  const rowScale = (colW - 34 - 8) / maxPrompt;
  const hit = p.promptTokens ? p.hitTokens / p.promptTokens : 0;
  return (
    <AnimationPanel
      title="A prefix cache filling and serving hits"
      summary={
        <>
          Four three-turn sessions share two system prompts (Mistral-7B, one
          A100). Left: the cached segments, solid while a running request uses
          them, hatched when only the LRU list holds them. Right: each running
          request&apos;s prompt, the part found in the cache (green) and the
          part it computed (orange), then its output (blue).
        </>
      }
      stepper={stepper}
      stepLabel="frame"
      countFrom={0}
      caption={prefixCaption(p)}
      testId="mech-prefix"
      equation={equation}
      hl={p.rows.some((r) => r.cached > 0) ? "acc" : ""}
      visual={
        <div ref={ref} className="min-w-0">
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Cached prefix segments, and each running request's cached and computed prompt tokens"
            className="text-neutral-800 dark:text-neutral-200"
          >
            <defs>
              <Hatch id="px-lru" colour={OKABE_ITO.green} />
            </defs>
            <text x={4} y={14} fontSize={12} fill="currentColor">
              Cache: {p.cachedTokens} tokens
            </text>
            {segs.length === 0 && (
              <text
                x={4}
                y={36}
                fontSize={11}
                fill="currentColor"
                opacity={0.7}
              >
                {key === "off" ? "(prefix caching off)" : "(empty)"}
              </text>
            )}
            {segs.map((s, i) => (
              <g key={s.key}>
                <text
                  x={4}
                  y={24 + i * rowH + 12}
                  fontSize={11}
                  fill="currentColor"
                >
                  {s.key}
                </text>
                <rect
                  x={labelW}
                  y={24 + i * rowH + 2}
                  width={Math.max(2, s.tokens * segScale)}
                  height={rowH - 6}
                  fill={s.refs > 0 ? OKABE_ITO.green : "url(#px-lru)"}
                  stroke={OKABE_ITO.green}
                >
                  <title>{`${s.key}: ${s.tokens} tokens, used by ${s.refs}`}</title>
                </rect>
              </g>
            ))}
            <text x={rightX} y={rightY + 14} fontSize={12} fill="currentColor">
              Running: {p.rows.length}
            </text>
            {p.rows.map((r, i) => {
              const y = rightY + 24 + i * rowH + 2;
              const x0 = rightX + 34;
              const wc = r.cached * rowScale;
              const wp = r.computed * rowScale;
              const wo = r.out * rowScale;
              return (
                <g key={r.rid}>
                  <text x={rightX} y={y + 10} fontSize={11} fill="currentColor">
                    r{r.rid}
                  </text>
                  <rect
                    x={x0}
                    y={y}
                    width={Math.max(0, r.prompt * rowScale)}
                    height={rowH - 6}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={0.25}
                  />
                  <rect
                    x={x0}
                    y={y}
                    width={wc}
                    height={rowH - 6}
                    fill={OKABE_ITO.green}
                  />
                  <rect
                    x={x0 + wc}
                    y={y}
                    width={wp}
                    height={rowH - 6}
                    fill={PHASE_COLOUR.prefill}
                  />
                  <rect
                    x={x0 + r.prompt * rowScale}
                    y={y}
                    width={Math.max(wo, r.out ? 2 : 0)}
                    height={rowH - 6}
                    fill={PHASE_COLOUR.decode}
                  />
                </g>
              );
            })}
            <text x={4} y={H - 6} fontSize={11} fill="currentColor">
              Prompt tokens found in the cache so far: {(100 * hit).toFixed(0)}%
            </text>
          </svg>
        </div>
      }
      stats={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Hit rate (run)"
            value={`${(100 * v.summary.hit_rate).toFixed(0)}%`}
          />
          <Stat label="TTFT p50" value={fmtSeconds(v.summary.ttft_p50)} />
          <Stat label="TPOT p99" value={fmtSeconds(v.summary.tpot_p99)} />
          <Stat label="All done at" value={fmtSeconds(v.horizon)} />
        </div>
      }
      params={
        <div className="sm:col-span-2">
          <Segmented
            label="Prefix caching"
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
