/**
 * /workloads/[w]: one workload's case study. Its SLOs and what the
 * workload is; the recommended configuration under those SLOs (most goodput
 * per GPU on any device and on each, and the cheapest per million tokens),
 * all from the sweep's points; its Pareto front (the explorer, starting on
 * this workload); and the levers whose effect on goodput changes sign
 * between this workload and the others. Server Component, statically
 * generated for the five workloads.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { ParetoExplorer } from "@/components/interactive/lazy";
import { FrontEq } from "@/components/mdx/equations";
import { V } from "@/components/mdx/V";
import { MdxTable } from "@/components/ui/MdxTable";
import { A_CLASS } from "@/content/ui";
import { flips, recommend } from "@/lib/tradeoffs/cases";
import { NEUTRAL, pctOf } from "@/lib/tradeoffs/effects";
import { chapterOf } from "@/lib/tradeoffs/chapters";
import { SWEEP, type SweepPoint } from "@/lib/tradeoffs/data";
import {
  HARDWARE,
  HW_LABEL,
  METRICS,
  WORKLOADS,
  WORKLOAD_LABEL,
  type MetricKey,
  type WorkloadKey,
} from "@/lib/tradeoffs/metrics";
import { explorerProps } from "@/lib/tradeoffs/props";
import { harnessesCh } from "@/lib/site";

export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ w: string }[]> {
  return WORKLOADS.map((w) => ({ w }));
}

export async function generateMetadata({ params }: { params: { w: string } }) {
  const w = params.w as WorkloadKey;
  return WORKLOADS.includes(w)
    ? {
        title: `${WORKLOAD_LABEL[w]}: case study`,
        description: `The best serving configuration for ${WORKLOAD_LABEL[w].toLowerCase()} under its SLOs, its Pareto front, and the levers that change sign, measured by the simulator.`,
      }
    : {};
}

const COLS: MetricKey[] = [
  "goodput_req_s_per_gpu",
  "usd_per_mtok",
  "j_per_tok",
  "ttft_p99",
  "tpot_p99",
];

function Row({ title, p }: { title: string; p: SweepPoint }): JSX.Element {
  const ch = chapterOf(p.family);
  return (
    <tr className="border-t border-neutral-200 dark:border-neutral-800">
      <td className="p-2">{title}</td>
      <td className="p-2">
        {ch ? (
          <Link href={`/learn/${ch.slug}#${p.lever}`} className={A_CLASS}>
            {p.label}
          </Link>
        ) : (
          p.label
        )}{" "}
        on {HW_LABEL[p.hardware]}
      </td>
      {COLS.map((m) => {
        const v = p.metrics[m];
        return (
          <td key={m} className="whitespace-nowrap p-2 text-right font-mono">
            {typeof v === "number" ? METRICS[m].fmt(v) : "–"}
          </td>
        );
      })}
    </tr>
  );
}

const SIGN = { "+": "+", "-": "−", "0": "0" } as const;

export default function WorkloadPage({
  params,
}: {
  params: { w: string };
}): JSX.Element {
  const w = params.w as WorkloadKey;
  if (!WORKLOADS.includes(w)) notFound();
  const info = SWEEP.workloads[w];
  const r = recommend(w);
  const fl = flips(w);
  const ex = explorerProps();
  const others = WORKLOADS.filter((x) => x !== w);
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent dark:text-indigo-300">
        Case study
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {WORKLOAD_LABEL[w]}
      </h1>
      <div className="mdx-content mt-4 max-w-3xl space-y-3 text-neutral-700 dark:text-neutral-300">
        <p>
          SLOs: time to first token at most{" "}
          <V of={`workload.${w}.ttft_slo`} fmt="ms" /> and time per output token
          at most <V of={`workload.${w}.tpot_slo`} fmt="ms" />, met by at least{" "}
          <V of="meta.slo_target" fmt="pct" /> of requests at capacity. The
          workload, as the sweep generates it:
        </p>
        <blockquote className="border-l-4 border-neutral-300 pl-4 text-sm dark:border-neutral-700">
          {info.rationale}
        </blockquote>
        {w === "coding-agent" && (
          <p>
            This page is the serving side of a coding agent. The other side, how
            many model calls one task makes, how much of each prompt the cache
            serves and how long the human waits, belongs to the harness:{" "}
            <a href={harnessesCh("10-cost-and-latency")} className={A_CLASS}>
              Agent Harnesses Explained, chapter 10
            </a>{" "}
            prices a whole task turn by turn.
          </p>
        )}
      </div>

      <section id="recommended" className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">
          The recommended configuration
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
          Goodput per GPU is capacity under both SLOs, so every configuration
          here meets them by construction. Same eight GPUs and model for every
          row; prices illustrative.
        </p>
        <MdxTable>
          <thead>
            <tr>
              <th className="p-2 text-left">Choice</th>
              <th className="p-2 text-left">Configuration</th>
              {COLS.map((m) => (
                <th key={m} className="p-2 text-right">
                  {METRICS[m].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody data-testid="recommended">
            <Row title="Most goodput per GPU" p={r.top} />
            <Row title="Cheapest per M tokens" p={r.cheapest} />
            {HARDWARE.map((hw) => (
              <Row
                key={hw}
                title={`Best on ${HW_LABEL[hw]}`}
                p={r.perDevice[hw]}
              />
            ))}
            <Row title="Baseline" p={r.baseline} />
          </tbody>
        </MdxTable>
      </section>

      <section id="front" className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">The frontier</h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
          Goodput per GPU against cost per million tokens, starting on this
          workload (play to compare the others; pick other metrics below).
        </p>
        <ParetoExplorer
          points={ex.points}
          workloads={ex.workloads}
          caveats={ex.caveats}
          initial={{
            x: "goodput_req_s_per_gpu",
            y: "usd_per_mtok",
            workload: w,
          }}
          compact
          testId="case-explorer"
          equation={<FrontEq />}
        />
      </section>

      <section id="sign-changes" className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">
          Levers that change sign
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
          Levers whose effect on goodput per GPU (H100) points one way here and
          the other way on at least one other workload: + more goodput than the
          baseline, − less, 0 within ±{pctOf(NEUTRAL)}.
        </p>
        <MdxTable>
          <thead>
            <tr>
              <th className="p-2 text-left">Lever</th>
              <th className="p-2 text-center">{WORKLOAD_LABEL[w]}</th>
              {others.map((x) => (
                <th key={x} className="p-2 text-center">
                  {WORKLOAD_LABEL[x]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody data-testid="case-flips">
            {fl.map((f) => {
              const ch = chapterOf(SWEEP.levers[f.lever]!.family);
              return (
                <tr
                  key={f.lever}
                  className="border-t border-neutral-200 dark:border-neutral-800"
                >
                  <td className="p-2">
                    {ch ? (
                      <Link
                        href={`/learn/${ch.slug}#${f.lever}`}
                        className={A_CLASS}
                      >
                        {SWEEP.levers[f.lever]!.label}
                      </Link>
                    ) : (
                      SWEEP.levers[f.lever]!.label
                    )}
                  </td>
                  <td className="p-2 text-center font-mono font-semibold">
                    {SIGN[f.here]}
                  </td>
                  {f.others.map((o) => (
                    <td key={o.w} className="p-2 text-center font-mono">
                      {SIGN[o.s]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </MdxTable>
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          Other case studies:{" "}
          {others.map((x, i) => (
            <span key={x}>
              {i > 0 ? " · " : ""}
              <Link href={`/workloads/${x}`} className={A_CLASS}>
                {WORKLOAD_LABEL[x]}
              </Link>
            </span>
          ))}
          .
        </p>
      </section>
    </main>
  );
}
