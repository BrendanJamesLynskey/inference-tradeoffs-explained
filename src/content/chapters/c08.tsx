/** Chapter 8: tensor, pipeline and expert parallelism. */
import { GpipeWidget, RingWidget } from "@/components/interactive/lazy";
import { GpipeEq, RingEq } from "@/components/mdx/equations";
import { V } from "@/components/mdx/V";
import { inferenceCh, kernelsCh, siliconCh } from "@/lib/site";

import { A, Cite, Deeper, RecordedTable, Sec } from "../ui";
import type { ChapterContent } from "./types";

const e = (w: string, lever: string, metric: string) =>
  `effect.${w}.h100.${lever}.${metric}`;

function Hero(): JSX.Element {
  return (
    <>
      <RingWidget equation={<RingEq />} />
      <GpipeWidget equation={<GpipeEq />} />
    </>
  );
}

function Body(): JSX.Element {
  return (
    <>
      <Sec id="mechanism" title="Three ways to split one model">
        <p>
          <strong>Tensor parallelism</strong> (<Cite k="megatron" />) splits
          every layer&apos;s matrices across GPUs, so each GPU reads a slice of
          the weights and the partial results are summed by an all-reduce, twice
          per layer: the first animation, a ring all-reduce (
          <Cite k="ring" />
          ). <strong>Pipeline parallelism</strong> (<Cite k="gpipe" />) gives
          each group of GPUs a run of whole layers and passes activations along:
          the second, with its bubble. <strong>Expert parallelism</strong> (
          <Cite k="gshard" />) puts whole experts of a mixture-of-experts model
          on different GPUs and sends each token to its experts and back (an
          all-to-all).
        </p>
      </Sec>
      <Sec id="why" title="Why more GPUs per instance can be slower">
        <p>
          Splitting a decode step over more GPUs divides its bytes, but every
          all-reduce costs at least its link latency, twice per layer, and that
          cost does not shrink with the batch. In the simulator&apos;s
          first-order model (link latency per hop, not overlapped with compute)
          a batch-1 decode step on eight H100s spends{" "}
          <V of="md|24|0|8|of it all-reduce" /> of its time in all-reduces, and
          is no faster than on four (
          <V of="md|24|0|8|Decode b=1" /> against{" "}
          <V of="md|24|0|4|Decode b=1" />
          ). That model is pessimistic for small batches on NVSwitch systems, so
          read the TP8 cells with the matrix&apos;s caveat.
        </p>
        <RecordedTable
          section={24}
          table={1}
          rows={[
            "TP4",
            "TP2 x PP2, 1 micro-batch",
            "TP2 x PP2, 2 micro-batches",
            "TP2 x PP2, 4 micro-batches",
            "PP4, 4 micro-batches",
          ]}
          cols={["Prefill step", "Decode step", "GPipe bubble (p-1)/(m+p-1)"]}
          better={["min", "min", null]}
          baseline="TP4"
          caption={
            <>
              Pipeline against tensor parallelism on four H100s, recorded in
              results.md section 24. Micro-batches shrink the bubble of a
              compute-bound prefill but re-read every stage&apos;s weights, so
              they lengthen a memory-bound decode.
            </>
          }
        />
        <p>
          Pipeline parallelism shows only its cost here, because the simulator
          does not keep several batches in flight across stages (as serving
          engines do), so a step waits for its own pipeline to drain. Expert
          parallelism trades the all-reduce for an all-to-all and is as fast as
          tensor parallelism when the experts are balanced; an imbalance
          stretches the busiest GPU (a prefill step goes from{" "}
          <V of="md|24|4|EP2|Prefill 4 x 2,048" /> to{" "}
          <V of="md|24|4|EP2, imbalance 1.5|Prefill 4 x 2,048" /> when one GPU
          carries half as much again as the mean).
        </p>
      </Sec>
      <Sec id="workloads" title="What the sweep measured">
        <p>
          With the eight GPUs as one TP8 instance instead of two of TP4, TTFT
          p99 falls (chat <V of={e("chat", "tp8", "ttft_p99")} fmt="signed" />:
          each prefill has twice the FLOPs) but TPOT p99 rises (
          <V of={e("chat", "tp8", "tpot_p99")} fmt="signed" />
          ), and with one instance instead of two the capacity falls on most
          workloads (goodput chat{" "}
          <V of={e("chat", "tp8", "goodput_req_s_per_gpu")} fmt="signed" />,
          voice{" "}
          <V of={e("voice", "tp8", "goodput_req_s_per_gpu")} fmt="signed" />
          ), except the coding agent (
          <V
            of={e("coding-agent", "tp8", "goodput_req_s_per_gpu")}
            fmt="signed"
          />
          ), whose long shared prompts need the prefill FLOPs. Four TP2
          instances leave almost no room for KV once two GPUs hold the whole
          model, and lose most of their capacity (chat{" "}
          <V of={e("chat", "tp2x4", "goodput_req_s_per_gpu")} fmt="signed" />
          ).
        </p>
      </Sec>
      <Deeper>
        <li>
          LLM Inference Explained:{" "}
          <A href={inferenceCh("09-parallelism")}>parallelism</A>, step by step.
        </li>
        <li>
          Systolic Arrays Explained:{" "}
          <A href={siliconCh("07-the-tpu")}>the TPU</A>, an all-reduce on a
          torus of chips.
        </li>
        <li>
          GPU Kernels Explained:{" "}
          <A href={kernelsCh("10-split-k-and-overlap")}>split-K and overlap</A>,
          hiding communication behind compute (which this model does not do).
        </li>
      </Deeper>
    </>
  );
}

export const C08: ChapterContent = {
  Hero,
  Body,
  refs: ["megatron", "gpipe", "gshard", "ring"],
};
