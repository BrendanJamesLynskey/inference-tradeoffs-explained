"use client";

/**
 * The knob × metric matrix: one row per lever, one column per metric, each
 * cell the measured relative change from the baseline for the chosen
 * workload and device, as a colour plus a glyph (src/lib/tradeoffs/
 * effects.ts). The animation tours the workloads: cells fade to their new
 * colours, and the cells that flip (better in one workload, worse in the
 * next) are outlined, each frame a pure function of the two workloads'
 * cells and t (src/lib/tradeoffs/matrix.ts). Every cell links to its
 * lever's chapter.
 */
import { useEffect, useMemo, useState } from "react";

import { AnimationPanel } from "@/components/anim/AnimationPanel";
import { useStepper } from "@/components/anim/useStepper";
import { useTween } from "@/components/anim/useTween";
import { Segmented } from "@/components/ui/Controls";
import { signedPct } from "@/lib/format";
import { NEUTRAL, SIZE_EDGES, pctOf } from "@/lib/tradeoffs/effects";
import type { Caveat, CaveatKey } from "@/lib/tradeoffs/caveats";
import {
  caption as matrixCaption,
  fillAt,
  grid,
  type EffectsTable,
  type MatrixLever,
} from "@/lib/tradeoffs/matrix";
import {
  HARDWARE,
  HW_LABEL,
  MATRIX_METRICS,
  METRICS,
  WORKLOADS,
  WORKLOAD_LABEL,
  type HwKey,
  type MetricKey,
  type WorkloadKey,
} from "@/lib/tradeoffs/metrics";

const VERDICT_WORD = {
  better: "better",
  worse: "worse",
  same: "about the same",
  none: "no value",
} as const;

export default function LeverMatrix({
  effects,
  levers,
  caveats,
  chapterHref,
  metrics = MATRIX_METRICS,
  title = "Lever × metric matrix",
  initialWorkload,
  testId = "matrix",
  equation,
}: {
  effects: EffectsTable;
  levers: MatrixLever[];
  caveats: Record<CaveatKey, Caveat>;
  /** The chapter page for each lever (cells link there). */
  chapterHref: Record<string, string>;
  metrics?: readonly MetricKey[];
  title?: string;
  initialWorkload?: WorkloadKey;
  testId?: string;
  /** Server-rendered KaTeX: what a cell is. */
  equation?: React.ReactNode;
}): JSX.Element {
  const [hw, setHw] = useState<HwKey>("h100");
  const stepper = useStepper(WORKLOADS.length, { stepMs: 2600, resetKey: hw });
  const startAt = initialWorkload ? WORKLOADS.indexOf(initialWorkload) : 0;
  const { setStep } = stepper;
  useEffect(() => {
    if (startAt > 0) setStep(startAt);
  }, [startAt, setStep]);
  const w = WORKLOADS[stepper.step]!;

  const target = useMemo(
    () => ({ w, hw, cells: grid(effects, levers, metrics, w, hw, null) }),
    [effects, levers, metrics, w, hw],
  );
  const tween = useTween(target, `${w}|${hw}`, 650);
  const from = tween.from && tween.from.hw === hw ? tween.from.cells : null;
  // the workload the transition came from (for the flips and the caption)
  const prevW =
    tween.from && tween.from.hw === hw && tween.from.w !== w
      ? tween.from.w
      : null;
  const shown = useMemo(
    () => grid(effects, levers, metrics, w, hw, prevW),
    [effects, levers, metrics, w, hw, prevW],
  );
  const cap = matrixCaption(
    shown,
    levers,
    w,
    prevW,
    WORKLOAD_LABEL,
    HW_LABEL[hw],
  );
  const used = new Set<CaveatKey>(shown.flat().flatMap((c) => c.caveats));
  const t = tween.t;

  const visual = (
    <div
      role="region"
      aria-label={`${title}: ${WORKLOAD_LABEL[w]} on ${HW_LABEL[hw]}`}
      tabIndex={0}
      className="focus-ring max-w-full overflow-x-auto rounded"
      data-testid="matrix-table"
    >
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 bg-neutral-50 p-1 text-left font-medium dark:bg-neutral-900"
            >
              Lever{" "}
              <span className="font-normal text-neutral-500 dark:text-neutral-400">
                vs the baseline
              </span>
            </th>
            {metrics.map((m) => (
              <th
                key={m}
                scope="col"
                title={`${METRICS[m].long}; ${METRICS[m].better === "max" ? "higher" : "lower"} is better`}
                className="min-w-[4.6rem] p-1 text-center align-bottom font-medium"
              >
                {METRICS[m].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => {
            const lever = levers[i]!;
            return (
              <tr key={lever.key}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-48 bg-neutral-50 p-1 text-left font-normal dark:bg-neutral-900"
                >
                  {lever.label}
                </th>
                {row.map((c, j) => {
                  const old = from?.[i]?.[j]?.cell ?? null;
                  const bg = fillAt(old, c.cell, t);
                  const marks = c.caveats.map((k) => caveats[k].mark).join("");
                  const text = c.na
                    ? `${lever.label} needs FP4 units: B200 only`
                    : `${lever.label}, ${METRICS[c.metric].label}: ${c.cell.rel === null ? "no value (no capacity at the SLO)" : signedPct(c.cell.rel)} (${VERDICT_WORD[c.cell.verdict]}) on ${WORKLOAD_LABEL[w]}, ${HW_LABEL[hw]}${c.flip ? `; flipped since ${prevW ? WORKLOAD_LABEL[prevW] : ""}` : ""}${c.caveats.length ? `. Caveats: ${c.caveats.map((k) => caveats[k].short).join("; ")}` : ""}`;
                  return (
                    <td key={c.metric} className="p-0">
                      <a
                        href={chapterHref[lever.key]}
                        title={text}
                        aria-label={text}
                        data-cell={`${lever.key}|${c.metric}`}
                        data-verdict={c.na ? "na" : c.cell.verdict}
                        data-flip={c.flip ? "1" : "0"}
                        className={`focus-ring flex min-h-9 items-center justify-center gap-0.5 rounded px-1 font-mono text-[0.7rem] leading-tight text-neutral-900 dark:text-neutral-100 ${
                          c.cell.verdict === "none" ? "matrix-none" : ""
                        }`}
                        style={{
                          backgroundColor: bg,
                          outline: c.flip
                            ? `${1 + 1.5 * Math.sin(Math.PI * Math.min(1, t))}px dashed currentColor`
                            : undefined,
                          outlineOffset: c.flip ? "-2px" : undefined,
                        }}
                      >
                        {c.na ? (
                          <span className="text-neutral-500 dark:text-neutral-400">
                            n/a
                          </span>
                        ) : (
                          <>
                            <span aria-hidden>{c.cell.glyph}</span>
                            <span aria-hidden className="whitespace-nowrap">
                              {c.cell.rel === null ? "" : signedPct(c.cell.rel)}
                            </span>
                            {marks && (
                              <sup
                                aria-hidden
                                className="text-[0.6rem] text-neutral-600 dark:text-neutral-300"
                              >
                                {marks}
                              </sup>
                            )}
                          </>
                        )}
                      </a>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const stats = (
    <div className="space-y-2 text-xs text-neutral-700 dark:text-neutral-300">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden
            className="inline-block size-3 rounded-sm"
            style={{ background: "rgba(0,114,178,0.58)" }}
          />
          better than the baseline
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden
            className="inline-block size-3 rounded-sm"
            style={{ background: "rgba(213,94,0,0.58)" }}
          />
          worse
        </span>
        <span>≈ within ±{pctOf(NEUTRAL)}</span>
        <span>
          ▲/▼ the metric went up/down: one arrow {pctOf(NEUTRAL)}–
          {pctOf(SIZE_EDGES[0])}, two {pctOf(SIZE_EDGES[0])}–
          {pctOf(SIZE_EDGES[1])}, three {pctOf(SIZE_EDGES[1])} or more
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden
            className="matrix-none inline-block size-3 rounded-sm"
          />
          – no value (no capacity at the SLO)
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden
            className="inline-block size-3 rounded-sm outline-dashed outline-1"
          />{" "}
          flipped since the last workload
        </span>
      </p>
      <ul className="space-y-1" aria-label="Caveats">
        {[...used].map((k) => (
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

  const params = (
    <>
      <Segmented
        label="Workload"
        value={w}
        options={WORKLOADS.map((k) => ({ value: k, label: WORKLOAD_LABEL[k] }))}
        onChange={(k) => stepper.setStep(WORKLOADS.indexOf(k))}
      />
      <Segmented
        label="Device"
        value={hw}
        options={HARDWARE.map((h) => ({ value: h, label: HW_LABEL[h] }))}
        onChange={setHw}
      />
    </>
  );

  return (
    <AnimationPanel
      title={title}
      summary={
        <>
          Each cell is one lever&apos;s measured change from the baseline on the
          same workload and device. Play tours the workloads; outlined cells
          flipped between better and worse. Each cell links to its lever&apos;s
          chapter.
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
