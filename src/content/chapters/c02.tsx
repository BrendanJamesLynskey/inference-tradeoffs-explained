/** Chapter 2: paged KV and preemption. */
import { KvWidget } from "@/components/interactive/lazy";
import { KvEq } from "@/components/mdx/equations";
import { V } from "@/components/mdx/V";
import { inferenceCh, kernelsCh, numericsCh } from "@/lib/site";

import { A, Cite, Deeper, RecordedTable, Sec } from "../ui";
import type { ChapterContent } from "./types";

const m = (variant: string, key: string) => `mech|paged|${variant}|${key}`;
const e = (w: string, lever: string, metric: string) =>
  `effect.${w}.h100.${lever}.${metric}`;

function Hero(): JSX.Element {
  return <KvWidget equation={<KvEq />} />;
}

function Body(): JSX.Element {
  return (
    <>
      <Sec id="mechanism" title="Reserve up front, or hand out blocks">
        <p>
          A request&apos;s KV cache grows by one token&apos;s keys and values
          per layer with every token it produces, and nobody knows in advance
          how long its output will be. <strong>Reserving</strong> (the baseline)
          books the prompt plus the whole output at admission: the request can
          never run out, but most of the booking sits empty for most of its life
          (the hatched cells), and a new request waits until a whole booking
          fits. In the animation the slowest first token takes{" "}
          <V of={m("oracle", "ttft_p99")} fmt="ms" />.
        </p>
        <p>
          <strong>Paged</strong> KV (<Cite k="vllm" />) hands out fixed-size
          blocks as tokens arrive, so memory holds tokens rather than promises
          and more requests run at once: the slowest first token takes{" "}
          <V of={m("paged", "ttft_p99")} fmt="ms" />. The price is that the
          blocks can run out mid-flight. Then the scheduler preempts the latest
          arrival: it either frees its blocks and recomputes its prompt and
          tokens later (<V of={m("paged", "preemptions")} fmt="int" />{" "}
          preemptions here), or copies them to host memory over PCIe and back (
          <V of={m("paged-swap", "preemptions")} fmt="int" />
          ). Only the last block of each request is partly empty (the light
          cells).
        </p>
      </Sec>
      <Sec id="why" title="Why it matters only where memory binds">
        <p>
          KV memory is HBM left over after the weights, and HBM is the scarce,
          fast level of the{" "}
          <A href={kernelsCh("01-memory-hierarchy")}>memory hierarchy</A>. When
          the weights leave little room (OPT-13B on a 40 GB A100, the
          paper&apos;s setting) reservation wastes most of it: results.md
          records reserved KV holding tokens in{" "}
          <V of="md|20|0|#6|Allocated KV holding tokens" /> of what it allocated
          at six requests per second, paged in{" "}
          <V of="md|20|0|#7|Allocated KV holding tokens" />, and the highest
          rate meeting the paper&apos;s latency target rises{" "}
          <V of="md|20|1|Orca (Oracle)|Paged vs this" /> (
          <V of="md|20|1|Orca (Oracle)|Rate req/s" /> to{" "}
          <V of="md|20|1|paged, 16-token blocks|Rate req/s" /> req/s).
        </p>
        <RecordedTable
          section={20}
          table={2}
          rows={["1", "16", "64", "256"]}
          cols={[
            "KV holding tokens",
            "Recompute: norm. latency",
            "Swap: norm. latency",
            "swap seconds",
          ]}
          better={["max", "min", "min", "min"]}
          baseline="16"
          caption={
            <>
              Block size and preemption mode, recorded in results.md section 20
              (OPT-13B, one A100-40GB, six requests per second). Bigger blocks
              waste more of their last block; the swap path here is PCIe at five
              microseconds per block. ✓ / ✗ against 16-token blocks.
            </>
          }
        />
      </Sec>
      <Sec id="workloads" title="Why the sweep shows almost nothing">
        <p>
          The sweep serves Llama-3-70B on four H100s per instance, which leaves
          room for hundreds of thousands of tokens of KV: no workload ever fills
          it at its reference load. Paged KV changes goodput by{" "}
          <V of={e("chat", "paged", "goodput_req_s_per_gpu")} fmt="signed" /> on
          chat and lowers peak KV use by{" "}
          <V of={e("chat", "paged", "kv_peak_frac")} fmt="signed" />; its one
          visible effect is offline batch&apos;s ITL p99 (
          <V of={e("offline-batch", "paged", "itl_p99")} fmt="signed" />
          ), from a saturated run where every request arrives at once; that tail
          is fragile (an FP8 KV cache moves it by{" "}
          <V of={e("offline-batch", "kv-fp8", "itl_p99")} fmt="signed" />
          ), so do not read it as a paging effect. Read the zeros as
          &quot;memory does not bind here&quot;, not &quot;paging does not
          help&quot;: the lever matters with smaller GPUs, longer contexts or
          larger batches, as above. Halving the KV format (
          <A href="/learn/09-quantisation">chapter 9</A>) and paging are the two
          ways to fit more requests in the same memory.
        </p>
      </Sec>
      <Sec id="validation" title="Against the paper">
        <p>
          vLLM&apos;s measured fraction of KV memory holding tokens (
          <V of="md|22|0|#6|Paper's figure" />) against the simulator&apos;s{" "}
          <V of="md|22|0|#6|This simulator" />: <V of="md|22|0|#6|Verdict" />.
        </p>
      </Sec>
      <Deeper>
        <li>
          LLM Inference Explained:{" "}
          <A href={inferenceCh("05-memory-management")}>memory management</A>,
          paging step by step.
        </li>
        <li>
          GPU Kernels Explained:{" "}
          <A href={kernelsCh("01-memory-hierarchy")}>the memory hierarchy</A>,
          what HBM holds and how fast.
        </li>
        <li>
          Numerics Explained:{" "}
          <A href={numericsCh("09-kv-cache")}>quantising the KV cache</A>, the
          other way to fit more tokens, and what it costs in accuracy.
        </li>
      </Deeper>
    </>
  );
}

export const C02: ChapterContent = { Hero, Body, refs: ["vllm", "sarathi"] };
