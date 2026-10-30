/** Chapter 6: KV hand-off links and compressing the hand-off. */
import { PoolWidget } from "@/components/interactive/lazy";
import { HandoffEq } from "@/components/mdx/equations";
import { V } from "@/components/mdx/V";
import { inferenceCh, numericsCh, racksCh } from "@/lib/site";

import { A, Cite, Deeper, RecordedTable, Sec } from "../ui";
import type { ChapterContent } from "./types";

const m = (variant: string, key: string) => `mech|handoff|${variant}|${key}`;

function Hero(): JSX.Element {
  return (
    <PoolWidget
      scenario="handoff"
      initial="eth-25g"
      testId="mech-handoff"
      title="Every prompt's KV cache crosses the link"
      summary={
        <>
          One prefill and one decode H100 (Llama-3-8B), fourteen requests at ten
          per second with long prompts. Watch the KV link lane: on a slow link
          the hand-offs queue, and decode waits for them. Compress the cache on
          the prefill GPU before it leaves.
        </>
      }
      equation={<HandoffEq />}
      stats={["tpot_p99", "itl_p99", "handoff", "horizon"]}
    />
  );
}

function Row(): JSX.Element {
  return (
    <>
      <p className="mt-3 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
        The sweep keeps the link fixed; these are the simulator&apos;s recorded
        runs (results.md sections 14 and 15), in the matrix&apos;s colours
        against NVLink.
      </p>
      <RecordedTable
        section={14}
        table={1}
        rows={["nvlink4", "ib-ndr", "cpo-optical", "eth-100g", "eth-25g"]}
        cols={[
          "KV wait + transfer share of E2E",
          "Link busy",
          "TPOT p99",
          "SLO met",
        ]}
        better={["min", null, "min", "max"]}
        baseline="nvlink4"
        caption={
          <>
            A grouped-query KV cache over each link (Llama-3-8B shape, eight
            requests per second, 2,048-token prompts). The co-packaged optics
            switch link is illustrative.
          </>
        }
      />
      <RecordedTable
        section={15}
        table={3}
        rows={["#0", "#1", "#2"]}
        cols={[
          "Load",
          "Best preset",
          "Hand-off p99 uncompressed",
          "#5",
          "Hand-off gain",
          "SLO uncompressed",
          "SLO compressed",
        ]}
        headers={[
          "Load",
          "Best preset",
          "Hand-off p99 uncompressed",
          "Hand-off p99 compressed",
          "Hand-off gain",
          "SLO uncompressed",
          "SLO compressed",
        ]}
        better={[null, null, null, null, null, null, "max"]}
        baseline="#0"
        caption={
          <>
            Where serving is transport-bound (GQA KV over 25 GbE as the load
            rises): what compressing the hand-off on the prefill GPU buys.
          </>
        }
      />
    </>
  );
}

function Body(): JSX.Element {
  return (
    <>
      <Sec id="mechanism" title="The hand-off is bytes over a wire">
        <p>
          A disaggregated request&apos;s first token comes from the prefill
          pool; every token after it needs the prompt&apos;s whole KV cache on
          the decode pool. That cache is large (two values per layer per token),
          and it crosses the link once per request, so the link is a third
          resource with its own queue. In the animation decode TPOT p99 is{" "}
          <V of={m("nvlink4", "tpot_p99")} fmt="ms" /> over NVLink,{" "}
          <V of={m("ib-ndr", "tpot_p99")} fmt="ms" /> over InfiniBand and{" "}
          <V of={m("eth-25g", "tpot_p99")} fmt="ms" /> over 25 GbE, where the
          hand-offs queue (DistServe&apos;s TPOT includes that wait,{" "}
          <Cite k="distserve" />
          ).
        </p>
        <p>
          Compressing the cache on the prefill GPU before it is sent shortens
          every hand-off by its ratio: FP8 brings 25 GbE back to{" "}
          <V of={m("eth-25g-fp8", "tpot_p99")} fmt="ms" />, and FP4 blocks to{" "}
          <V of={m("eth-25g-fp4-gpu", "tpot_p99")} fmt="ms" />. The simulator
          does not model what compression does to accuracy (eight- and four-bit
          KV are within what <Cite k="kivi" /> and <Cite k="kvquant" /> report
          as tolerable).
        </p>
      </Sec>
      <Sec id="why" title="When the link matters">
        <p>
          The link matters when hand-off bytes times request rate approaches its
          bandwidth: then transfers queue, and the queue grows without bound as
          the load rises. Over NVLink or InfiniBand at these rates the hand-off
          is a rounding error of end-to-end time; over 25 GbE it is the
          bottleneck, and compression is a prerequisite rather than an
          optimisation. Compressing on the GPU costs one elementwise pass after
          each prefill, which shows as a slightly later first token (TTFT p99{" "}
          <V of={m("eth-25g-fp8", "ttft_p99")} fmt="ms" /> with FP8 against{" "}
          <V of={m("eth-25g", "ttft_p99")} fmt="ms" /> uncompressed in the
          animation). Where the bytes are mostly waiting rather than moving,
          compression helps by far more than its ratio: at the highest load
          recorded the best preset (<V of="md|15|3|#2|Best preset" />) makes the
          hand-off p99 <V of="md|15|3|#2|Hand-off gain" /> shorter.
        </p>
      </Sec>
      <Deeper>
        <li>
          LLM Inference Explained:{" "}
          <A href={inferenceCh("12-moving-the-kv-cache")}>
            moving the KV cache
          </A>
          , link by link.
        </li>
        <li>
          Numerics Explained:{" "}
          <A href={numericsCh("09-kv-cache")}>quantising the KV cache</A>, the
          accuracy side of compressing it.
        </li>
        <li>
          The hardware underneath, AI Racks Explained:{" "}
          <A href={racksCh("08-disaggregated-inference")}>
            disaggregated inference on a rack
          </A>
          , the hand-off over NVLink inside a rack against network ports between
          racks.
        </li>
      </Deeper>
    </>
  );
}

export const C06: ChapterContent = {
  Hero,
  Row,
  Body,
  refs: ["distserve", "kivi", "kvquant"],
};
