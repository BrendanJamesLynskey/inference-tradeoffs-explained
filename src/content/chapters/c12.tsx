/** Chapter 12: hardware choice and cost. */
import { CostWidget } from "@/components/interactive/lazy";
import { CostEq } from "@/components/mdx/equations";
import { V } from "@/components/mdx/V";
import { MdxTable } from "@/components/ui/MdxTable";
import { deviceBars } from "@/lib/tradeoffs/cases";
import { SWEEP } from "@/lib/tradeoffs/data";
import { cell } from "@/lib/tradeoffs/effects";
import { HW_LABEL, WORKLOADS, WORKLOAD_LABEL } from "@/lib/tradeoffs/metrics";
import { kernelsCh, siliconCh } from "@/lib/site";
import { signedPct } from "@/lib/format";

import { A, Cite, Deeper, Sec } from "../ui";
import type { ChapterContent } from "./types";

const p = (w: string, hw: string, metric: string, lever = "baseline") =>
  `point.${w}.${hw}.${lever}.${metric}`;

function labels(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(SWEEP.levers).map(([k, v]) => [k, v.label]),
  );
}

function Hero(): JSX.Element {
  return (
    <CostWidget
      frames={WORKLOADS.map((w) => deviceBars(w))}
      leverLabels={labels()}
      equation={<CostEq />}
    />
  );
}

/** The baseline on each device against H100, per workload, in the matrix's terms. */
function Row(): JSX.Element {
  const bars = WORKLOADS.map((w) => deviceBars(w));
  return (
    <>
      <p className="mt-3 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
        The baseline configuration on H200 and B200 against H100, workload by
        workload (the sweep&apos;s own points; ✓ / ✗ as in the matrix). Prices
        per GPU-hour are illustrative.
      </p>
      <MdxTable>
        <thead>
          <tr>
            <th className="p-2 text-left">Workload</th>
            {(["h200", "b200"] as const).flatMap((hw) => [
              <th key={`${hw}g`} className="p-2 text-right">
                {HW_LABEL[hw]} goodput
              </th>,
              <th key={`${hw}u`} className="p-2 text-right">
                {HW_LABEL[hw]} $/M tok
              </th>,
            ])}
          </tr>
        </thead>
        <tbody data-testid="device-table">
          {bars.map((b) => {
            const h = b.rows[0]!;
            return (
              <tr
                key={b.w}
                className="border-t border-neutral-200 dark:border-neutral-800"
              >
                <td className="p-2">{WORKLOAD_LABEL[b.w]}</td>
                {b.rows.slice(1).flatMap((r) => {
                  const g = cell(
                    r.base.goodput / h.base.goodput - 1,
                    "goodput_req_s_per_gpu",
                  );
                  const u = cell(r.base.usd / h.base.usd - 1, "usd_per_mtok");
                  return [g, u].map((c, i) => (
                    <td
                      key={`${r.hw}${i}`}
                      className="whitespace-nowrap p-2 text-right font-mono"
                      data-verdict={c.verdict}
                    >
                      {signedPct(c.rel!)}{" "}
                      <span aria-hidden>
                        {c.verdict === "better"
                          ? "✓"
                          : c.verdict === "worse"
                            ? "✗"
                            : ""}
                      </span>
                    </td>
                  ));
                })}
              </tr>
            );
          })}
        </tbody>
      </MdxTable>
    </>
  );
}

function Body(): JSX.Element {
  return (
    <>
      <Sec id="mechanism" title="Bandwidth, capacity and compute, per dollar">
        <p>
          The three devices differ in what the earlier chapters showed matters.
          An H200 has an H100&apos;s compute with more and faster HBM (
          <Cite k="h200" />
          ), so its decode passes, which are memory-bound, run faster and it
          holds more KV. A B200 has more of everything and FP4 units (
          <Cite k="b200" />
          ). Cost per million output tokens is the price per GPU-hour over the
          tokens each GPU serves at capacity, so a dearer device wins when its
          capacity grows by more than its price (illustrative prices per hour:
          H100 <V of="price.h100" fmt="usd" />, H200{" "}
          <V of="price.h200" fmt="usd" />
          , B200 <V of="price.b200" fmt="usd" />
          ).
        </p>
      </Sec>
      <Sec id="why" title="What the sweep measured">
        <p>
          On chat the baseline serves{" "}
          <V of={p("chat", "h100", "goodput_req_s_per_gpu")} fmt="metric" />{" "}
          requests per second per H100,{" "}
          <V of={p("chat", "h200", "goodput_req_s_per_gpu")} fmt="metric" /> per
          H200 and{" "}
          <V of={p("chat", "b200", "goodput_req_s_per_gpu")} fmt="metric" /> per
          B200; per million tokens that is{" "}
          <V of={p("chat", "h100", "usd_per_mtok")} fmt="metric" />,{" "}
          <V of={p("chat", "h200", "usd_per_mtok")} fmt="metric" /> and{" "}
          <V of={p("chat", "b200", "usd_per_mtok")} fmt="metric" />. The H200
          buys capacity but at these prices barely changes the cost, and on
          offline batch it costs more per token than an H100 (
          <V
            of={p("offline-batch", "h200", "usd_per_mtok")}
            fmt="metric"
          />{" "}
          against{" "}
          <V of={p("offline-batch", "h100", "usd_per_mtok")} fmt="metric" />
          ): there its extra bandwidth does not pay for its price. The B200 is
          cheapest per token on every workload here, but its BF16 rate and power
          are assumptions (the matrix&apos;s B caveat), so treat the B200
          columns as a sketch.
        </p>
        <p>
          The levers matter as much as the device: the best lever on an H100
          serves chat at{" "}
          <V
            of={p("chat", "h100", "usd_per_mtok", "modern-colocated")}
            fmt="metric"
          />{" "}
          per million tokens, less than the B200 baseline. Why the bytes and
          FLOPs of each device decide which passes speed up:{" "}
          <A href={kernelsCh("01-memory-hierarchy")}>the memory hierarchy</A>{" "}
          and <A href={kernelsCh("02-roofline")}>the roofline</A>; how other
          matrix engines are built:{" "}
          <A href={siliconCh("08-other-ways")}>Systolic Arrays Explained</A>.
        </p>
      </Sec>
      <Deeper>
        <li>
          GPU Kernels Explained:{" "}
          <A href={kernelsCh("01-memory-hierarchy")}>the memory hierarchy</A>{" "}
          and <A href={kernelsCh("02-roofline")}>the roofline</A>.
        </li>
        <li>
          Systolic Arrays Explained:{" "}
          <A href={siliconCh("07-the-tpu")}>the TPU</A>, a different matrix
          engine.
        </li>
      </Deeper>
    </>
  );
}

export const C12: ChapterContent = {
  Hero,
  Row,
  Body,
  refs: ["h100", "h200", "b200"],
};
