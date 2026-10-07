/**
 * A sweep family's levers, each with what it measured on every workload
 * (H100, or B200 for FP4), and the caveats those cells carry. Server
 * Component (moved from the 20B lever page).
 */
import Link from "next/link";

import { MdxTable } from "@/components/ui/MdxTable";
import { signedPct } from "@/lib/format";
import { caveatsFor, CAVEAT_ORDER } from "@/lib/tradeoffs/caveats";
import { SWEEP, slimLevers } from "@/lib/tradeoffs/data";
import { NEUTRAL, cell, pctOf } from "@/lib/tradeoffs/effects";
import {
  WORKLOADS,
  WORKLOAD_LABEL,
  type Family,
  type MetricKey,
} from "@/lib/tradeoffs/metrics";
import { caveats as allCaveats } from "@/lib/tradeoffs/values";

import { A_CLASS } from "./ui";

const COLS: MetricKey[] = [
  "goodput_req_s_per_gpu",
  "usd_per_mtok",
  "j_per_tok",
  "ttft_p99",
  "tpot_p99",
  "itl_p99",
];
const COL_LABEL: Record<string, string> = {
  goodput_req_s_per_gpu: "goodput",
  usd_per_mtok: "$/M tok",
  j_per_tok: "J/tok",
  ttft_p99: "TTFT p99",
  tpot_p99: "TPOT p99",
  itl_p99: "ITL p99",
};

export function LeverTables({ fam }: { fam: Family }): JSX.Element {
  const levers = slimLevers().filter((l) => l.fam === fam);
  const cav = allCaveats();
  const used = new Set<string>();
  const body = levers.map((l) => (
    <section key={l.key} id={l.key} className="mt-10 scroll-mt-6">
      <h3 className="text-lg font-semibold tracking-tight">{l.label}</h3>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Change from the baseline on{" "}
        {l.only ? "B200 (it needs FP4 units)" : "H100"}, at capacity for
        goodput, cost and energy, at the reference load for latency.{" "}
        <Link
          href={`/what-if?w=chat&hw=${l.only ? l.only[0] : "h100"}&lever=${l.key}`}
          className={A_CLASS}
        >
          Run it live
        </Link>
      </p>
      <MdxTable>
        <thead>
          <tr>
            <th className="p-2 text-left">Workload</th>
            {COLS.map((m) => (
              <th key={m} className="p-2 text-right">
                {COL_LABEL[m]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WORKLOADS.map((w) => {
            const hw = l.only ? l.only[0]! : "h100";
            const e = SWEEP.effects[w][hw]?.[l.key] ?? {};
            return (
              <tr
                key={w}
                className="border-t border-neutral-200 dark:border-neutral-800"
              >
                <td className="p-2">{WORKLOAD_LABEL[w]}</td>
                {COLS.map((m) => {
                  const c = cell(e[m], m);
                  const marks = caveatsFor({
                    lever: l.key,
                    family: l.fam,
                    metric: m,
                    workload: w,
                    hw,
                    rel: c.rel,
                    goodputRel: e.goodput_req_s_per_gpu ?? null,
                  });
                  marks.forEach((k) => used.add(k));
                  return (
                    <td
                      key={m}
                      className="whitespace-nowrap p-2 text-right font-mono"
                      data-verdict={c.verdict}
                    >
                      {c.rel === null ? "–" : signedPct(c.rel)}{" "}
                      <span aria-hidden>
                        {c.verdict === "better"
                          ? "✓"
                          : c.verdict === "worse"
                            ? "✗"
                            : ""}
                      </span>
                      {marks.length > 0 && (
                        <sup>{marks.map((k) => cav[k].mark).join("")}</sup>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </MdxTable>
    </section>
  ));
  return (
    <section id="measured" className="mt-12 scroll-mt-6">
      <h2 className="text-xl font-semibold tracking-tight">
        What the sweep measured, lever by lever
      </h2>
      {body}
      <div className="mt-8" aria-label="Caveats">
        <h3 className="text-lg font-semibold tracking-tight">
          Caveats on these numbers
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
          {CAVEAT_ORDER.filter((k) => used.has(k)).map((k) => (
            <li key={k}>
              <span className="mr-1 font-mono font-semibold">
                {cav[k].mark}
              </span>
              <strong>{cav[k].short}.</strong> {cav[k].long}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          ✓ better than the baseline, ✗ worse, by more than ±{pctOf(NEUTRAL)}.
          Every lever on every metric and device:{" "}
          <Link href="/matrix" className={A_CLASS}>
            the matrix
          </Link>
          ; on any two metrics:{" "}
          <Link href="/explore" className={A_CLASS}>
            the explorer
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
