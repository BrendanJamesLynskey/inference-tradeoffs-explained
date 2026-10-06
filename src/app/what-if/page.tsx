/**
 * /what-if: the live simulator. Server Component: hands the client widget
 * the sweep's recorded values (to compare the live runs with) and the
 * caveats; the widget loads the recorded workload and runs the vendored
 * engine in a Web Worker.
 */
import { WhatIf } from "@/components/interactive/lazy";
import { V } from "@/components/mdx/V";
import { TimelineEq } from "@/components/mdx/equations";
import { whatIfProps } from "@/lib/tradeoffs/props";

export const metadata = {
  title: "Live what-if",
  description:
    "Toggle serving levers and re-run the simulator's own engine in the browser on the sweep's recorded requests: before/after metrics and where the time went.",
};

export default function WhatIfPage(): JSX.Element {
  const p = whatIfProps();
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent dark:text-indigo-300">
        /what-if
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Live what-if
      </h1>
      <div className="mdx-content mt-4 max-w-3xl text-neutral-700 dark:text-neutral-300">
        <p>
          Choose a workload, a device and a starting configuration from the
          sweep, then toggle levers. Your browser runs the simulator&apos;s own
          engine on both configurations, on the very requests the sweep
          generated for that workload at its reference load (a few thousand for
          the multi-turn workloads), in a Web Worker. When a configuration is
          one of the sweep&apos;s, its live latencies are identical to the
          recorded ones, to the last bit: the engine is the same code, bit-exact
          with the simulator&apos;s Python package.
        </p>
        <p>
          The live run measures one load. Capacity (the highest load meeting the
          SLOs, which sets goodput, cost and energy per token in the explorer
          and the matrix) takes a search of several runs, so for those the page
          quotes the sweep&apos;s record. Speculative decoding assumes an
          acceptance rate of <V of="meta.alpha" fmt="raw" />.
        </p>
      </div>
      <WhatIf
        points={p.points}
        leverLabels={p.leverLabels}
        slos={p.slos}
        caveats={p.caveats}
        equation={<TimelineEq />}
      />
    </main>
  );
}
