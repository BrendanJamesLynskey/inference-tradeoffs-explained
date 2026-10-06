/**
 * /learn/[slug]: one lever family's page, built from the vendored sweep: its
 * rows of the matrix (animated across the workloads, the hero), then what
 * each lever measured on every workload, its caveats, and links into the
 * explorer and the live simulator. Server Component, statically generated
 * for every chapter with sweep data.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { LeverMatrix } from "@/components/interactive/lazy";
import { DeltaEq } from "@/components/mdx/equations";
import { MdxTable } from "@/components/ui/MdxTable";
import { signedPct } from "@/lib/format";
import { BUILT, CHAPTERS } from "@/lib/tradeoffs/chapters";
import { SWEEP, slimLevers } from "@/lib/tradeoffs/data";
import { NEUTRAL, cell, pctOf } from "@/lib/tradeoffs/effects";
import {
  FAMILY_LABEL,
  WORKLOADS,
  WORKLOAD_LABEL,
  type MetricKey,
} from "@/lib/tradeoffs/metrics";
import { caveatsFor, CAVEAT_ORDER } from "@/lib/tradeoffs/caveats";
import { matrixProps } from "@/lib/tradeoffs/props";
import { caveats as allCaveats } from "@/lib/tradeoffs/values";

export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return BUILT.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const c = BUILT.find((x) => x.slug === params.slug);
  return c ? { title: c.title, description: c.summary } : {};
}

const COLS: MetricKey[] = [
  "goodput_req_s_per_gpu",
  "usd_per_mtok",
  "ttft_p99",
  "tpot_p99",
  "itl_p99",
];
const COL_LABEL: Record<string, string> = {
  goodput_req_s_per_gpu: "goodput",
  usd_per_mtok: "$/M tok",
  ttft_p99: "TTFT p99",
  tpot_p99: "TPOT p99",
  itl_p99: "ITL p99",
};
const A =
  "focus-ring rounded text-accent underline underline-offset-2 dark:text-indigo-300";

export default function LeverPage({
  params,
}: {
  params: { slug: string };
}): JSX.Element {
  const ch = BUILT.find((c) => c.slug === params.slug);
  if (!ch || !ch.family) notFound();
  const fam = ch.family;
  const mx = matrixProps(fam);
  const levers = slimLevers().filter((l) => l.fam === fam);
  const cav = allCaveats();
  const used = new Set<string>();
  const n = CHAPTERS.indexOf(ch) + 1;
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent dark:text-indigo-300">
        Chapter {String(n).padStart(2, "0")} · {FAMILY_LABEL[fam]}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{ch.title}</h1>
      <LeverMatrix
        {...mx}
        title={`${FAMILY_LABEL[fam]}: the measured effects`}
        testId="lever-matrix"
        equation={<DeltaEq />}
      />
      <p className="max-w-3xl text-neutral-700 dark:text-neutral-300">
        {ch.summary}
      </p>
      <p className="mt-3 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
        The chapter text (the mechanism animated, why it behaves as measured,
        and the papers) is being written. This page already shows what the sweep
        measured.
      </p>
      {levers.map((l) => (
        <section key={l.key} id={l.key} className="mt-10 scroll-mt-6">
          <h2 className="text-xl font-semibold tracking-tight">{l.label}</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Change from the baseline on H100
            {l.only ? " (B200 here: it needs FP4 units)" : ""}, at capacity for
            goodput and cost, at the reference load for latency.{" "}
            <Link
              href={`/what-if?w=chat&hw=${l.only ? l.only[0] : "h100"}&lever=${l.key}`}
              className={A}
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
      ))}
      <section className="mt-10" aria-label="Caveats">
        <h2 className="text-xl font-semibold tracking-tight">
          Caveats on these numbers
        </h2>
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
          <Link href="/matrix" className={A}>
            the matrix
          </Link>
          ; on any two metrics:{" "}
          <Link href="/explore" className={A}>
            the explorer
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
