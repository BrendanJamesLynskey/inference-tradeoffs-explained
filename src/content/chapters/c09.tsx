/** Chapter 9: quantisation. */
import { BytesWidget } from "@/components/interactive/lazy";
import { BytesEq } from "@/components/mdx/equations";
import { V } from "@/components/mdx/V";
import { kernelsCh, numericsCh, siliconCh } from "@/lib/site";

import { A, Cite, Deeper, RecordedTable, Sec } from "../ui";
import type { ChapterContent } from "./types";

const e = (w: string, lever: string, metric: string, hw = "h100") =>
  `effect.${w}.${hw}.${lever}.${metric}`;

function Hero(): JSX.Element {
  return <BytesWidget equation={<BytesEq />} />;
}

function Body(): JSX.Element {
  return (
    <>
      <Sec
        id="mechanism"
        title="Fewer bytes per weight, faster matmuls where the units exist"
      >
        <p>
          Quantisation does two different things, and the simulator keeps them
          apart. A narrower <strong>storage</strong> format means fewer bytes
          per weight or per KV value: every memory-bound pass reads less, and
          the same HBM holds more KV. A narrower <strong>compute</strong> format
          runs the matmuls on tensor-core units for that format, at twice (FP8,
          INT8) or four times (FP4, on B200) the BF16 rate; where a device has
          no such units the weights are dequantised to BF16 first, so
          compute-bound passes are no faster (weight-only, written W8A16 or
          W4A16). INT4 and FP4 bytes include their block scales (
          <Cite k="awq" />, <Cite k="mx" />
          ).
        </p>
      </Sec>
      <Sec id="why" title="Why decode and prefill gain differently">
        <p>
          A decode step reads every weight for a few tokens, so its time is its
          bytes over the HBM bandwidth (the{" "}
          <A href={kernelsCh("02-roofline")}>roofline</A>&apos;s left side), and
          halving the bytes nearly halves it. A prefill step is compute-bound,
          so only a faster matmul format helps it: on four H100s FP8 weights
          alone leave an 8,192-token prefill at{" "}
          <V of="md|24|5|#1|Prefill 8,192" />, while FP8 matmuls (W8A8) cut it
          to <V of="md|24|5|#2|Prefill 8,192" />.
        </p>
        <RecordedTable
          section={24}
          table={5}
          rows={["#0", "#1", "#2", "#4", "#6", "#8", "#9", "#11"]}
          cols={[
            "Format",
            "Weights GB",
            "KV tokens",
            "Decode b=64",
            "Prefill 8,192",
            "J/token at b=64 (incl. idle)",
          ]}
          better={[null, "min", "max", "min", "min", "min"]}
          baseline="#0"
          caption={
            <>
              Llama-3-70B on four GPUs (no all-reduce, to isolate the format),
              recorded in results.md section 24; ✓ / ✗ against BF16 on H100.
              Accuracy is not simulated.
            </>
          }
        />
      </Sec>
      <Sec id="workloads" title="What the sweep measured">
        <p>
          FP8 weights and matmuls (W8A8) help every workload, by as much as any
          single lever outside prefix caching: goodput per GPU{" "}
          <V of={e("chat", "w8a8-fp8", "goodput_req_s_per_gpu")} fmt="signed" />{" "}
          on chat,{" "}
          <V
            of={e("coding-agent", "w8a8-fp8", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          on the coding agent and{" "}
          <V
            of={e("voice", "w8a8-fp8", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          on voice, with TTFT and TPOT both falling. INT4 weights with BF16
          matmuls help decode (TPOT p99 chat{" "}
          <V of={e("chat", "w4-int4", "tpot_p99")} fmt="signed" />) but not
          prefill (TTFT p99{" "}
          <V of={e("chat", "w4-int4", "ttft_p99")} fmt="signed" />
          ), as the roofline predicts. An FP8 KV cache alone does little here
          (chat{" "}
          <V of={e("chat", "kv-fp8", "goodput_req_s_per_gpu")} fmt="signed" />
          ), because the sweep&apos;s KV memory never binds (
          <A href="/learn/02-paged-kv-and-preemption">chapter 2</A>). On B200,
          FP4 weights and matmuls (W4A4) add{" "}
          <V
            of={e("chat", "w4a4-fp4", "goodput_req_s_per_gpu", "b200")}
            fmt="signed"
          />{" "}
          over B200&apos;s own BF16 baseline on chat.
        </p>
        <p>
          <strong>Accuracy is not simulated.</strong> Every one of these numbers
          assumes the quantised model is good enough; whether it is depends on
          the model, the method and the format, which is what{" "}
          <A href={numericsCh("05-quantisation-basics")}>Numerics Explained</A>{" "}
          is about.
        </p>
      </Sec>
      <Deeper>
        <li>
          Numerics Explained:{" "}
          <A href={numericsCh("05-quantisation-basics")}>quantisation</A>,{" "}
          <A href={numericsCh("08-awq-and-nf4")}>AWQ and NF4</A> and{" "}
          <A href={numericsCh("09-kv-cache")}>the KV cache</A>: the accuracy
          side.
        </li>
        <li>
          GPU Kernels Explained:{" "}
          <A href={kernelsCh("11-quantised-kernels")}>quantised kernels</A>,
          where the dequantisation happens.
        </li>
        <li>
          Systolic Arrays Explained:{" "}
          <A href={siliconCh("06-inside-a-pe")}>inside a PE</A>, what an INT8
          multiply-accumulate unit is.
        </li>
      </Deeper>
    </>
  );
}

export const C09: ChapterContent = {
  Hero,
  Body,
  refs: ["awq", "mx", "h100", "b200"],
};
