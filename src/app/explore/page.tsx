/**
 * /explore: the Pareto explorer. Server Component: hands the client widget
 * a slim view of the vendored sweep.
 */
import Link from "next/link";

import { ParetoExplorer } from "@/components/interactive/lazy";
import { V } from "@/components/mdx/V";
import { FrontEq } from "@/components/mdx/equations";
import { explorerProps } from "@/lib/tradeoffs/props";

export const metadata = {
  title: "Pareto explorer",
  description:
    "Every swept serving configuration on two chosen metrics, with the Pareto front, animated across workloads and SLO filters.",
};

const A =
  "focus-ring rounded text-accent underline underline-offset-2 dark:text-indigo-300";

export default function ExplorePage(): JSX.Element {
  const ex = explorerProps();
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent dark:text-indigo-300">
        /explore
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Pareto explorer
      </h1>
      <div className="mdx-content mt-4 max-w-3xl text-neutral-700 dark:text-neutral-300">
        <p>
          A configuration is on the front when no other configuration is at
          least as good on both metrics and strictly better on one. Everything
          off the front is beaten by something on it, for these two measures;
          which point on the front to choose depends on which measure matters
          more. Pick the metrics, a workload and the devices; tighten the SLO
          filter to keep only configurations whose p99 latencies at the
          reference load fit within a multiple of the workload&apos;s SLOs, and
          watch the front re-form.
        </p>
        <p>
          The points are the sweep&apos;s <V of="meta.points" fmt="int" />{" "}
          configurations, one set per workload. With every device shown and no
          SLO filter, the front drawn here is exactly the sweep&apos;s own
          Pareto flag for that pair of metrics (a unit test checks all of them).
          Hover a point for its configuration; click it to re-run it in the{" "}
          <Link href="/what-if" className={A}>
            live simulator
          </Link>
          .
        </p>
      </div>
      <ParetoExplorer
        points={ex.points}
        workloads={ex.workloads}
        caveats={ex.caveats}
        equation={<FrontEq />}
      />
    </main>
  );
}
