/** Chapter 1: batching policy and chunked prefill. */
import { BatchingWidget } from "@/components/interactive/lazy";
import { BatchEq } from "@/components/mdx/equations";
import { V } from "@/components/mdx/V";
import { inferenceCh, kernelsCh, siliconCh } from "@/lib/site";

import { A, Cite, Deeper, RecordedTable, Sec } from "../ui";
import type { ChapterContent } from "./types";

const m = (variant: string, key: string) => `mech|batching|${variant}|${key}`;
const e = (w: string, lever: string, metric: string) =>
  `effect.${w}.h100.${lever}.${metric}`;

function Hero(): JSX.Element {
  return <BatchingWidget equation={<BatchEq />} />;
}

function Body(): JSX.Element {
  return (
    <>
      <Sec id="mechanism" title="Three ways to fill a forward pass">
        <p>
          Every step of a serving engine is one forward pass of the model over a
          batch of rows. A row is either part of a prompt being prefilled or one
          decoding request asking for its next token. The policy decides which
          rows share a pass, and the animation shows the three the simulator
          implements, on the same six requests.
        </p>
        <p>
          <strong>Prefill-priority</strong> (the baseline, the original vLLM
          scheduler) runs a waiting prompt as soon as it can, whole, in a pass
          of its own. Every decoding request waits for that pass: in the
          animation the longest gap between two tokens of a request (ITL p99) is{" "}
          <V of={m("prefill-priority", "itl_p99")} fmt="ms" />.{" "}
          <strong>Decode-priority</strong> admits new prompts only when the
          running batch has drained, so the tokens flow evenly (ITL p99{" "}
          <V of={m("decode-priority", "itl_p99")} fmt="ms" />) and the newcomers
          wait instead: their median time to first token is{" "}
          <V of={m("decode-priority", "ttft_p50")} fmt="ms" />, against{" "}
          <V of={m("prefill-priority", "ttft_p50")} fmt="ms" />.{" "}
          <strong>Chunked prefill</strong> (<Cite k="sarathi" />) cuts each
          prompt into pieces that fit what is left of the step&apos;s token
          budget τ after every decode row has its token: with the smallest
          budget ITL p99 falls to{" "}
          <V of={m("chunked-256", "itl_p99")} fmt="ms" /> while TTFT p99 stays
          close to prefill-priority&apos;s (
          <V of={m("chunked-256", "ttft_p99")} fmt="ms" /> against{" "}
          <V of={m("prefill-priority", "ttft_p99")} fmt="ms" />
          ). The larger the budget, the more prompt each pass carries and the
          more it stalls the decodes.
        </p>
      </Sec>
      <Sec id="why" title="Why chunking is nearly free here">
        <p>
          A decode pass reads every weight of the model to produce one token per
          row, so it is memory-bound: its arithmetic intensity sits far below
          the ridge point of the <A href={kernelsCh("02-roofline")}>roofline</A>
          . Prompt tokens that ride along in the same pass reuse the weights
          already being read, and use compute that would otherwise idle, until
          the pass becomes compute-bound. That is why piggy-backing costs the
          decodes little, and why the same weights can feed many rows at once
          (the reuse a <A href={siliconCh("01-why-systolic")}>systolic array</A>{" "}
          is built for).
        </p>
        <p>
          The simulator&apos;s roofline makes chunking almost free: splitting
          one long prompt into chunks of 512 costs at most{" "}
          <V of="md|19|2|16,384|Chunks of 512" /> more time than one pass. The
          paper measured far more (
          <V of="md|22|0|#4|Paper's figure" />
          ), because real kernels pay for every extra launch and for partly
          filled tiles; the simulator has neither, so it understates the cost of
          small budgets (results.md section 22 records the gap).
        </p>
        <RecordedTable
          section={19}
          table={0}
          rows={[
            "prefill-priority",
            "decode-priority",
            "chunked 256",
            "chunked 512",
            "chunked 2048",
          ]}
          cols={["TTFT p50", "TTFT p99", "ITL p99", "TPOT p99", "J/token"]}
          better={["min", "min", "min", "min", "min"]}
          baseline="prefill-priority"
          caption={
            <>
              Recorded in results.md section 19: Mistral-7B on one A100,
              ShareGPT-like lengths, at a fixed load. ✓ / ✗: better or worse
              than prefill-priority.
            </>
          }
        />
      </Sec>
      <Sec id="workloads" title="Which workloads it helps">
        <p>
          In the sweep (Llama-3-70B, eight H100s, at each configuration&apos;s
          own capacity under its workload&apos;s SLOs) a 512-token budget raises
          goodput per GPU by{" "}
          <V
            of={e("long-rag", "chunked-512", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          on long-context RAG,{" "}
          <V
            of={e("voice", "chunked-512", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          on real-time voice and{" "}
          <V
            of={e("chat", "chunked-512", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          on chat: there the decode stalls behind long prompts were what broke
          the TPOT SLO. It costs{" "}
          <V
            of={e("offline-batch", "chunked-512", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          on offline batch, which has no latency to protect, and{" "}
          <V
            of={e("coding-agent", "chunked-512", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          on the coding agent, whose prompts open with a{" "}
          <V of="workload.coding-agent.system_len" fmt="int" />
          -token shared prefix: without prefix caching every prompt is prefilled
          in full, a small budget spreads it over many passes that each re-read
          the weights, and its TTFT p99 rises{" "}
          <V
            of={e("coding-agent", "chunked-512", "ttft_p99")}
            fmt="signed"
          />{" "}
          under the agent&apos;s tighter TTFT SLO. Prefix caching (
          <A href="/learn/03-prefix-caching">chapter 3</A>) removes most of that
          work, which is why the combined configurations (
          <A href="/learn/13-combining-levers">chapter 13</A>) chunk with a
          larger budget.
        </p>
        <p>
          Decode-priority loses on every workload (goodput{" "}
          <V
            of={e("chat", "decode-priority", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          on chat): smooth tokens are worth nothing when the requests behind
          them miss their TTFT SLO.
        </p>
      </Sec>
      <Sec id="validation" title="Against the paper">
        <p>
          Under the paper&apos;s strict SLO the simulator&apos;s capacity gain
          from chunking is <V of="md|22|0|#0|This simulator" /> against the
          paper&apos;s <V of="md|22|0|#0|Paper's figure" /> (
          <V of="md|22|0|#0|Verdict" />
          ); the qualitative picture (prefill-priority stalls decodes,
          decode-priority starves prompts, chunking keeps ITL low at a small
          TTFT cost) reproduces too.
        </p>
      </Sec>
      <Deeper>
        <li>
          LLM Inference Explained:{" "}
          <A href={inferenceCh("04-batching")}>batching</A>, step by step.
        </li>
        <li>
          GPU Kernels Explained:{" "}
          <A href={kernelsCh("02-roofline")}>the roofline</A>, why a decode pass
          is memory-bound.
        </li>
        <li>
          Systolic Arrays Explained:{" "}
          <A href={siliconCh("01-why-systolic")}>why systolic</A>, reuse of one
          weight across many rows.
        </li>
      </Deeper>
    </>
  );
}

export const C01: ChapterContent = {
  Hero,
  Body,
  refs: ["sarathi", "distserve", "vllm"],
};
