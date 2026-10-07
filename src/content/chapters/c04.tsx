/** Chapter 4: disaggregation and the pool split. */
import { PoolWidget } from "@/components/interactive/lazy";
import { TimelineEq } from "@/components/mdx/equations";
import { V } from "@/components/mdx/V";
import { inferenceCh, kernelsCh } from "@/lib/site";

import { A, Cite, Deeper, RecordedTable, Sec } from "../ui";
import type { ChapterContent } from "./types";

const m = (variant: string, key: string) => `mech|pools|${variant}|${key}`;
const e = (w: string, lever: string, metric: string) =>
  `effect.${w}.h100.${lever}.${metric}`;

function Hero(): JSX.Element {
  return (
    <PoolWidget
      scenario="pools"
      initial="colocated"
      testId="mech-pools"
      title="The same eight GPUs, colocated or split"
      summary={
        <>
          Llama-3-70B on eight H100s: two colocated instances of four, or one
          prefill and one decode instance of four, serving the same fourteen
          requests (long prompts, short outputs). Each lane is an instance;
          orange passes are prefills, blue decodes; the KV link carries each
          prompt&apos;s cache from one pool to the other.
        </>
      }
      equation={<TimelineEq />}
      stats={["ttft_p99", "tpot_p99", "itl_p99", "j_per_tok"]}
    />
  );
}

function Body(): JSX.Element {
  return (
    <>
      <Sec id="mechanism" title="Separate the two phases">
        <p>
          Colocated, every instance does both jobs, so each long prefill stalls
          the decodes sharing its GPUs. Disaggregated (<Cite k="distserve" />,{" "}
          <Cite k="splitwise" />
          ), prefill runs on one pool and decode on another: decode passes never
          wait behind a prompt, and in the animation ITL p99 falls from{" "}
          <V of={m("colocated", "itl_p99")} fmt="ms" /> to{" "}
          <V of={m("1p1d", "itl_p99")} fmt="ms" />. What it costs: every
          request&apos;s KV cache crosses a link (
          <A href="/learn/06-kv-handoff-and-compression">chapter 6</A>), and
          prompts now share one prefill instance instead of two, so they queue
          when they bunch up.
        </p>
      </Sec>
      <Sec id="why" title="Why the split helps decode and can hurt capacity">
        <p>
          The two phases want different things from the hardware: a prefill is
          compute-bound, a decode memory-bound (the{" "}
          <A href={kernelsCh("02-roofline")}>roofline</A>). Splitting them lets
          each pool be sized and batched for its own bound, and keeps the decode
          tail flat. But a fixed split is right for only one mix of prompt and
          output lengths: too few prefill GPUs and prompts queue (TTFT rises),
          too few decode GPUs and the batch overflows.
        </p>
        <RecordedTable
          section={3}
          table={0}
          rows={["Colocated, 2 instances", "Disaggregated 1P1D"]}
          cols={["TTFT p99", "TPOT p99", "SLO met", "J / token"]}
          better={["min", "min", "max", "min"]}
          baseline="Colocated, 2 instances"
          caption={
            <>
              Recorded in results.md section 3: Llama-3-70B, four H100s per
              instance, four requests per second. ✓ / ✗ against colocated.
            </>
          }
        />
      </Sec>
      <Sec id="workloads" title="Which workloads it helps">
        <p>
          In the sweep, disaggregating into one prefill and one decode instance
          of four GPUs cuts TPOT p99 on every workload (chat{" "}
          <V of={e("chat", "disagg-1p1d", "tpot_p99")} fmt="signed" />) but
          raises TTFT p99 (chat{" "}
          <V of={e("chat", "disagg-1p1d", "ttft_p99")} fmt="signed" />
          ), and capacity under both SLOs moves both ways: goodput per GPU{" "}
          <V
            of={e("voice", "disagg-1p1d", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          on real-time voice, whose tight TPOT SLO the colocated stalls break,
          but{" "}
          <V
            of={e("chat", "disagg-1p1d", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          on chat and{" "}
          <V
            of={e("offline-batch", "disagg-1p1d", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          on offline batch, which only wants throughput. A different split (two
          smaller prefill instances) does not rescue it: chat{" "}
          <V
            of={e("chat", "disagg-2p1d", "goodput_req_s_per_gpu")}
            fmt="signed"
          />
          , voice{" "}
          <V
            of={e("voice", "disagg-2p1d", "goodput_req_s_per_gpu")}
            fmt="signed"
          />
          .
        </p>
        <p>
          With paged decode KV and a prefix-cached prefill pool the
          disaggregated cluster gains{" "}
          <V
            of={e("voice", "disagg-levers", "goodput_req_s_per_gpu")}
            fmt="signed"
          />{" "}
          on voice: that number is real but sits at an SLO cliff (the baseline
          barely meets voice&apos;s tight SLOs), which is why the matrix marks
          it. The combined colocated configuration (
          <A href="/learn/13-combining-levers">chapter 13</A>), with FP8 as
          well, gains more there.
        </p>
      </Sec>
      <Deeper>
        <li>
          LLM Inference Explained:{" "}
          <A href={inferenceCh("11-why-disaggregate")}>why disaggregate</A> and{" "}
          <A href={inferenceCh("14-tradeoffs")}>the trade-offs</A>, with a load
          sweep.
        </li>
        <li>
          GPU Kernels Explained:{" "}
          <A href={kernelsCh("02-roofline")}>the roofline</A>: why prefill and
          decode want different hardware.
        </li>
      </Deeper>
    </>
  );
}

export const C04: ChapterContent = {
  Hero,
  Body,
  refs: ["distserve", "splitwise", "sarathi"],
};
