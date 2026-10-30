/** Chapter 5: heterogeneous pools (H100 and A100). */
import { PoolWidget } from "@/components/interactive/lazy";
import { TimelineEq } from "@/components/mdx/equations";
import { V } from "@/components/mdx/V";
import { kernelsCh, racksCh, siliconCh } from "@/lib/site";

import { A, Cite, Deeper, RecordedTable, Sec } from "../ui";
import type { ChapterContent } from "./types";

const m = (variant: string, key: string) => `mech|hetero|${variant}|${key}`;

function Hero(): JSX.Element {
  return (
    <PoolWidget
      scenario="hetero"
      initial="h100-h100"
      testId="mech-hetero"
      title="A different device in each pool"
      summary={
        <>
          One prefill and one decode instance (Llama-3-8B, one device each),
          fourteen requests at eight per second. Swap the device of either pool
          between H100 and A100, or give a slow A100 prefill pool a second
          instance.
        </>
      }
      equation={<TimelineEq />}
      stats={["ttft_p99", "tpot_p99", "j_per_tok", "horizon"]}
    />
  );
}

function Row(): JSX.Element {
  return (
    <>
      <p className="mt-3 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
        The sweep does not vary pool hardware; these are the simulator&apos;s
        recorded runs (results.md section 10), in the matrix&apos;s colours
        against the all-H100 pools.
      </p>
      <RecordedTable
        section={10}
        table={0}
        rows={[
          "H100 prefill + H100 decode (--device h100)",
          "H100 prefill + A100 decode",
          "A100 prefill + H100 decode",
          "A100 prefill + A100 decode",
          "2x A100 prefill + H100 decode",
        ]}
        cols={[
          "TTFT p99",
          "TPOT p99",
          "Goodput (req/s)",
          "J / token",
          "tok/s per $1000",
        ]}
        better={["min", "min", "max", "min", "max"]}
        baseline="H100 prefill + H100 decode (--device h100)"
        caption={
          <>
            Heterogeneous pools, Llama-3-8B shape, eight requests per second.
            Silicon dollars are illustrative (die area and yield, not prices).
          </>
        }
      />
    </>
  );
}

function Body(): JSX.Element {
  return (
    <>
      <Sec id="mechanism" title="Put each phase on the device that suits it">
        <p>
          Once prefill and decode run on separate pools, they need not run on
          the same hardware (<Cite k="splitwise" />
          ). Decode is memory-bound, so an older or cheaper part with good
          bandwidth may do; prefill is compute-bound, so it wants FLOPs. In the
          animation an A100 decode pool behind an H100 prefill pool raises TPOT
          p99 from <V of={m("h100-h100", "tpot_p99")} fmt="ms" /> to{" "}
          <V of={m("h100-a100", "tpot_p99")} fmt="ms" />, still inside the TPOT
          SLO, while an A100 prefill pool cannot keep up with the prompts: TTFT
          p99 goes from <V of={m("h100-h100", "ttft_p99")} fmt="ms" /> to{" "}
          <V of={m("a100-h100", "ttft_p99")} fmt="ms" />.
        </p>
        <p>
          The remedy for a slow prefill device is more of it: two A100 prefill
          instances in front of the same H100 decode bring TTFT p99 back to{" "}
          <V of={m("2a100-h100", "ttft_p99")} fmt="ms" />. The prefill pool has
          to match the prompt rate in FLOPs, whatever part supplies them.
        </p>
      </Sec>
      <Sec id="why" title="Why each pool wants a different part">
        <p>
          Prefill is bound by compute and decode by memory bandwidth, so a part
          that is short of FLOPs but not of bandwidth costs little in the decode
          pool and a great deal in the prefill pool. At the recorded load the
          A100 decode pool still meets every SLO, at{" "}
          <V of="md|10|0|H100 prefill + A100 decode|J / token" /> joules per
          token against{" "}
          <V of="md|10|0|H100 prefill + H100 decode (--device h100)|J / token" />{" "}
          for all-H100 pools, while the single A100 prefill pool serves{" "}
          <V of="md|10|0|A100 prefill + H100 decode|Goodput (req/s)" /> requests
          per second inside the SLOs. Two A100 prefill instances recover the
          goodput (
          <V of="md|10|0|2x A100 prefill + H100 decode|Goodput (req/s)" />{" "}
          req/s) but buy it with more silicon and energy: per $1000 of
          illustrative silicon they serve{" "}
          <V of="md|10|0|2x A100 prefill + H100 decode|tok/s per $1000" />{" "}
          tokens per second, against{" "}
          <V of="md|10|0|H100 prefill + H100 decode (--device h100)|tok/s per $1000" />{" "}
          for the H100 pair. Whether a mixed fleet pays depends on what the
          older parts cost, which the simulator does not price.
        </p>
        <p>
          Hardware choice inside one pool is{" "}
          <A href="/learn/12-hardware-and-cost">chapter 12</A>; where the FLOPs
          and bytes of each device come from, the{" "}
          <A href={kernelsCh("02-roofline")}>roofline</A> and{" "}
          <A href={siliconCh("08-other-ways")}>
            other ways to build a matrix engine
          </A>
          .
        </p>
      </Sec>
      <Deeper>
        <li>
          GPU Kernels Explained:{" "}
          <A href={kernelsCh("02-roofline")}>the roofline</A>.
        </li>
        <li>
          Systolic Arrays Explained:{" "}
          <A href={siliconCh("08-other-ways")}>other ways</A>, other matrix
          hardware.
        </li>
        <li>
          The hardware underneath, AI Racks Explained:{" "}
          <A href={racksCh("08-disaggregated-inference")}>
            disaggregated inference on a rack
          </A>
          , with a context-optimised part in the prefill or the decode pool.
        </li>
      </Deeper>
    </>
  );
}

export const C05: ChapterContent = {
  Hero,
  Row,
  Body,
  refs: ["splitwise", "distserve"],
};
