/** Chapter 10: speculative decoding. */
import { DraftWidget } from "@/components/interactive/lazy";
import { SpecEq } from "@/components/mdx/equations";
import { V } from "@/components/mdx/V";
import { architecturesCh, inferenceCh, kernelsCh } from "@/lib/site";

import { A, Cite, Deeper, RecordedTable, Sec } from "../ui";
import type { ChapterContent } from "./types";

const m = (variant: string, key: string) =>
  `mech|speculative|${variant}|${key}`;
const e = (w: string, lever: string, metric: string) =>
  `effect.${w}.h100.${lever}.${metric}`;

function Hero(): JSX.Element {
  return <DraftWidget equation={<SpecEq />} />;
}

function Body(): JSX.Element {
  return (
    <>
      <Sec id="mechanism" title="Guess several tokens, check them in one pass">
        <p>
          A small draft (here an extra layer of the target that shares its
          embedding and output head: a multi-token prediction head,{" "}
          <Cite k="deepseekv3" />) proposes γ tokens; the target model checks
          all of them in one forward pass and keeps the run it agrees with, plus
          one token of its own (<Cite k="leviathan" />
          ). If each drafted token is accepted with probability α, a pass yields
          the expected number of tokens in the equation. In the animation, with
          three drafts per pass and α ={" "}
          <V of={m("g3a07", "cfg.speculative.alpha")} fmt="raw" />, the two
          requests kept <V of={m("g3a07", "tokens_per_verify")} fmt="num" />{" "}
          tokens per pass on average, and TPOT p99 fell from{" "}
          <V of={m("off", "tpot_p99")} fmt="ms" /> to{" "}
          <V of={m("g3a07", "tpot_p99")} fmt="ms" />.
        </p>
      </Sec>
      <Sec id="why" title="Why it helps at low batch and hurts at high">
        <p>
          A decode pass at small batch is memory-bound: it reads every weight
          for a handful of tokens, and checking γ + 1 positions per row costs
          almost the same bytes as checking one (the{" "}
          <A href={kernelsCh("02-roofline")}>roofline</A>&apos;s left side). At
          large batch the pass is already compute-bound, the extra positions
          cost their full FLOPs, and rejected drafts are wasted work:
        </p>
        <RecordedTable
          section={25}
          table={3}
          rows={["#0", "#1", "#2", "#3", "#8", "#10"]}
          cols={[
            "Context",
            "Batch",
            "ms/token plain",
            "ms/token speculative",
            "verify bound",
            "Speed-up",
          ]}
          better={[null, null, null, null, null, null]}
          baseline="#0"
          caption={
            <>
              Time per output token from the cost model, Llama-3-8B with an MTP
              draft, three drafts per pass and the same α, recorded in
              results.md section 25. Below a speed-up of one, speculation loses.
            </>
          }
        />
        <p>
          The simulator reproduces Leviathan et al.&apos;s closed forms: the
          paper&apos;s Table 1 speeds to the printed digits (for example{" "}
          <V of="md|25|0|#1|Speed (paper)" /> against{" "}
          <V of="md|25|0|#1|Speed (Theorem 3.8 here)" />
          ), and at saturation, where the verify pass is compute-bound, it
          measures throughput falling to <V of="md|25|4|#2|Ratio" /> of plain
          decoding.
        </p>
      </Sec>
      <Sec id="workloads" title="What the sweep measured">
        <p>
          With α fixed at the sweep&apos;s parameter (not a measurement), the
          MTP head cuts TPOT p99 on chat by{" "}
          <V of={e("chat", "spec-mtp", "tpot_p99")} fmt="signed" /> and raises
          goodput per GPU on every workload, most on real-time voice (
          <V
            of={e("voice", "spec-mtp", "goodput_req_s_per_gpu")}
            fmt="signed"
          />
          ), whose tight TPOT SLO is what limits it, and least on offline batch
          (
          <V
            of={e("offline-batch", "spec-mtp", "goodput_req_s_per_gpu")}
            fmt="signed"
          />
          ), whose large batches leave the least idle compute; there its ITL p99
          even rises (
          <V of={e("offline-batch", "spec-mtp", "itl_p99")} fmt="signed" />
          ). A separate small draft model (Llama-3.2-1B) does about as well, at
          the cost of its own weights and KV in memory.
        </p>
      </Sec>
      <Deeper>
        <li>
          LLM Architectures Explained:{" "}
          <A href={architecturesCh("07-multi-token-prediction")}>
            multi-token prediction
          </A>
          , the draft heads themselves.
        </li>
        <li>
          LLM Inference Explained:{" "}
          <A href={inferenceCh("07-speculative-decoding")}>
            speculative decoding
          </A>
          , step by step.
        </li>
        <li>
          GPU Kernels Explained:{" "}
          <A href={kernelsCh("02-roofline")}>the roofline</A>: why extra
          positions are free until the pass is compute-bound.
        </li>
      </Deeper>
    </>
  );
}

export const C10: ChapterContent = {
  Hero,
  Body,
  refs: ["leviathan", "deepseekv3"],
};
