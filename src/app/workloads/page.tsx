/**
 * /workloads: the five workload case studies (brief 20 §5). Each workload
 * gets its recommended configuration under its SLOs, its frontier and the
 * levers whose effect changes sign against the other workloads. Server
 * Component.
 */
import Link from "next/link";

import { V } from "@/components/mdx/V";
import { recommend } from "@/lib/tradeoffs/cases";
import { SWEEP } from "@/lib/tradeoffs/data";
import { HW_LABEL, WORKLOADS, WORKLOAD_LABEL } from "@/lib/tradeoffs/metrics";

export const metadata = {
  title: "Workload case studies",
  description:
    "Chat, a coding agent, offline batch, long-context RAG and real-time voice: the best configuration for each under its SLOs, measured.",
};

export default function WorkloadsIndex(): JSX.Element {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent dark:text-indigo-300">
        /workloads
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Workload case studies
      </h1>
      <p className="mt-4 text-neutral-600 dark:text-neutral-300">
        The same levers rank differently for different traffic. Each case study
        gives a workload&apos;s SLOs, the configuration the sweep measured
        serving it best, its Pareto front, and the levers that help it but hurt
        another workload (or the reverse).
      </p>
      <ul className="mt-10 divide-y divide-neutral-200 dark:divide-neutral-800">
        {WORKLOADS.map((w) => {
          const r = recommend(w);
          return (
            <li key={w} className="py-5">
              <Link
                href={`/workloads/${w}`}
                className="focus-ring rounded text-lg font-medium text-neutral-900 hover:text-accent dark:text-neutral-100"
              >
                {WORKLOAD_LABEL[w]}
              </Link>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                SLOs: TTFT <V of={`workload.${w}.ttft_slo`} fmt="ms" />, TPOT{" "}
                <V of={`workload.${w}.tpot_slo`} fmt="ms" />. Most goodput per
                GPU: {SWEEP.levers[r.top.lever]!.label} on{" "}
                {HW_LABEL[r.top.hardware]}.
              </p>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
