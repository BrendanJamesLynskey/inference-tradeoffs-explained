/** Chapter 13: combining levers. */
import { CombineWidget } from "@/components/interactive/lazy";
import { DeltaEq } from "@/components/mdx/equations";
import { V } from "@/components/mdx/V";
import { combineFrame } from "@/lib/tradeoffs/cases";
import { SWEEP } from "@/lib/tradeoffs/data";
import { WORKLOADS } from "@/lib/tradeoffs/metrics";
import { inferenceCh } from "@/lib/site";

import { A, Deeper, Sec } from "../ui";
import type { ChapterContent } from "./types";

const e = (w: string, lever: string, metric: string) =>
  `effect.${w}.h100.${lever}.${metric}`;

function Hero(): JSX.Element {
  return (
    <CombineWidget
      frames={WORKLOADS.map((w) => combineFrame(w))}
      leverLabels={Object.fromEntries(
        Object.entries(SWEEP.levers).map(([k, v]) => [k, v.label]),
      )}
      equation={<DeltaEq />}
    />
  );
}

function Body(): JSX.Element {
  return (
    <>
      <Sec id="mechanism" title="The levers together">
        <p>
          Serving engines do not pick one lever: they chunk prefills, page the
          KV cache, cache prefixes and run narrow formats at once, and some add
          speculation or split the pools. The sweep measures three such
          combinations against the same baseline: a modern colocated
          configuration (chunked prefill with a 2,048-token budget, paged KV,
          prefix caching, FP8 weights, matmuls and KV), the same levers
          disaggregated into one prefill and one decode instance, and the
          colocated one with an MTP speculative head.
        </p>
      </Sec>
      <Sec id="why" title="Why they multiply, and where they do not">
        <p>
          The levers mostly attack different costs (prompt work, memory, bytes
          per pass, passes per token), so their gains compound: the modern
          colocated configuration raises goodput per GPU{" "}
          <V
            of={e("chat", "modern-colocated", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          on chat, against{" "}
          <V
            of={e("chat", "prefix-cache", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          for prefix caching and{" "}
          <V of={e("chat", "w8a8-fp8", "goodput_req_s_per_gpu")} fmt="signed" />{" "}
          for FP8 alone. Adding speculation helps some workloads and not others:
          on the coding agent{" "}
          <V
            of={e("coding-agent", "modern-spec", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          against{" "}
          <V
            of={e("coding-agent", "modern-colocated", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          without it, on chat{" "}
          <V
            of={e("chat", "modern-spec", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          against{" "}
          <V
            of={e("chat", "modern-colocated", "goodput_req_s_per_gpu")}
            fmt="signed"
          />
          .
        </p>
        <p>
          With every lever available to both, disaggregation no longer wins on
          any workload&apos;s goodput: modern disaggregated gains{" "}
          <V
            of={e("offline-batch", "modern-disagg", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          on offline batch against the colocated one&apos;s{" "}
          <V
            of={e("offline-batch", "modern-colocated", "goodput_req_s_per_gpu")}
            fmt="signed"
          />
          , and less on chat too. It still buys the flattest decode tail (ITL
          p99 on chat{" "}
          <V of={e("chat", "modern-disagg", "itl_p99")} fmt="signed" /> against{" "}
          <V of={e("chat", "modern-colocated", "itl_p99")} fmt="signed" />
          ), so it remains the choice when that tail is the SLO that binds. The
          very large percentages on voice and the coding agent are real
          measurements against a baseline that sits at a cliff of their tight
          SLOs; the matrix marks them.
        </p>
      </Sec>
      <Deeper>
        <li>
          LLM Inference Explained:{" "}
          <A href={inferenceCh("14-tradeoffs")}>the trade-offs</A>, the
          disaggregation decision in detail.
        </li>
        <li>
          The <A href="/workloads">workload case studies</A>: the recommended
          configuration for each workload.
        </li>
      </Deeper>
    </>
  );
}

export const C13: ChapterContent = {
  Hero,
  Body,
  refs: ["sarathi", "vllm", "sglang", "distserve", "leviathan"],
};
