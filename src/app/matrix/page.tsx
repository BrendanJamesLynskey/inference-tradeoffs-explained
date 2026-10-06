/**
 * /matrix: the knob × metric matrix, and the levers whose effect changes
 * sign between workloads (recomputed from the sweep; a unit test checks it
 * against the simulator's results.md section 26). Server Component.
 */
import { LeverMatrix } from "@/components/interactive/lazy";
import { DeltaEq } from "@/components/mdx/equations";
import { MdxTable } from "@/components/ui/MdxTable";
import { SWEEP, slimLevers } from "@/lib/tradeoffs/data";
import { NEUTRAL, pctOf, signChanges } from "@/lib/tradeoffs/effects";
import { WORKLOADS, WORKLOAD_LABEL } from "@/lib/tradeoffs/metrics";
import { matrixProps } from "@/lib/tradeoffs/props";

export const metadata = {
  title: "Lever × metric matrix",
  description:
    "Every serving lever against every metric, measured: better or worse than the baseline and by how much, for each workload and device.",
};

export default function MatrixPage(): JSX.Element {
  const mx = matrixProps();
  const levers = slimLevers();
  const flips = signChanges(
    Object.fromEntries(
      WORKLOADS.map((w) => [w, SWEEP.effects[w].h100]),
    ) as never,
    WORKLOADS,
    levers.map((l) => l.key),
    "goodput_req_s_per_gpu",
  );
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent dark:text-indigo-300">
        /matrix
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        Lever × metric matrix
      </h1>
      <div className="mdx-content mt-4 max-w-3xl text-neutral-700 dark:text-neutral-300">
        <p>
          Each row is one lever, each column one metric, and each cell the
          lever&apos;s measured change from the baseline (two colocated
          instances of four GPUs, prefill-priority batching, reserved KV, BF16)
          on the same workload and device. Blue is better and vermillion worse,
          whichever way the metric runs; the arrows say which way it moved and
          roughly how far. Capacity metrics (goodput, throughput, cost, energy)
          are at each configuration&apos;s own capacity; latencies at the
          workload&apos;s reference load.
        </p>
      </div>
      <LeverMatrix {...mx} equation={<DeltaEq />} />
      <h2 className="mt-12 text-xl font-semibold tracking-tight">
        Levers that change sign
      </h2>
      <p className="mt-3 max-w-3xl text-neutral-700 dark:text-neutral-300">
        The same lever can help one workload and hurt another. These are the
        levers whose effect on goodput per GPU changes sign between workloads on
        H100 (+ more goodput than the baseline, − less, 0 within ±
        {pctOf(NEUTRAL)}):
      </p>
      <MdxTable>
        <thead>
          <tr>
            <th className="p-2 text-left">Lever</th>
            {WORKLOADS.map((w) => (
              <th key={w} className="p-2 text-center">
                {WORKLOAD_LABEL[w]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody data-testid="sign-changes">
          {flips.map((f) => (
            <tr
              key={f.lever}
              className="border-t border-neutral-200 dark:border-neutral-800"
            >
              <td className="p-2">
                {levers.find((l) => l.key === f.lever)!.label}
              </td>
              {f.signs.map((s, i) => (
                <td key={i} className="p-2 text-center font-mono">
                  {s === "-" ? "−" : s}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </MdxTable>
    </main>
  );
}
