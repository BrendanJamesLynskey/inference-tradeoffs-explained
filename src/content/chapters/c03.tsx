/** Chapter 3: prefix caching. */
import { PrefixWidget } from "@/components/interactive/lazy";
import { PrefixEq } from "@/components/mdx/equations";
import { V } from "@/components/mdx/V";
import { inferenceCh, kernelsCh } from "@/lib/site";

import { A, Cite, Deeper, RecordedTable, Sec } from "../ui";
import type { ChapterContent } from "./types";

const m = (variant: string, key: string) => `mech|prefix|${variant}|${key}`;
const e = (w: string, metric: string) =>
  `effect.${w}.h100.prefix-cache.${metric}`;

function Hero(): JSX.Element {
  return <PrefixWidget equation={<PrefixEq />} />;
}

function Body(): JSX.Element {
  return (
    <>
      <Sec id="mechanism" title="Compute a shared prefix once">
        <p>
          Many prompts start the same way: a system prompt, a tool list, the
          earlier turns of a conversation. Their keys and values are the same
          every time, so an engine can keep them and let the next request with
          that prefix start its prefill after it (<Cite k="sglang" />: a radix
          tree of segments, least recently used evicted first). In the animation{" "}
          <V of={m("on", "hit_rate")} fmt="pct" /> of all prompt tokens are
          found in the cache, and the median time to first token falls from{" "}
          <V of={m("off", "ttft_p50")} fmt="ms" /> to{" "}
          <V of={m("on", "ttft_p50")} fmt="ms" />.
        </p>
        <p>
          A cached segment is memory that holds no running request&apos;s
          private tokens. While a request uses it, it is pinned; afterwards it
          stays only until something needs the room, so the hit rate depends on
          how soon the same prefix comes back (its reuse distance) and how much
          KV memory is spare.
        </p>
      </Sec>
      <Sec id="why" title="Why it saves so much">
        <p>
          Prefill is compute-bound: every prompt token costs its share of the
          model&apos;s FLOPs (the{" "}
          <A href={kernelsCh("02-roofline")}>roofline</A>&apos;s right-hand
          side), so a cached token is a token of work not done, not merely a
          faster one. The gain grows with the shared fraction of each prompt:
        </p>
        <RecordedTable
          section={21}
          table={1}
          rows={["0", "256", "1,024", "4,096", "8,192"]}
          cols={["Hit rate", "TTFT p50 off", "TTFT p50 on", "Throughput gain"]}
          better={[null, null, null, null]}
          baseline="0"
          caption={
            <>
              Recorded in results.md section 21: four shared system prompts of
              the length shown, Mistral-7B on one A100. Latency at half the
              cache-off throughput; throughput saturated.
            </>
          }
        />
        <p>
          It also depends on memory. With little spare KV, a longer think time
          between two turns of a session lets other sessions evict its segments:
          the hit rate falls from <V of="md|21|2|1 s|Hit rate" /> at one second
          to <V of="md|21|2|300 s|Hit rate" /> at five minutes (results.md
          section 21, OPT-13B on one A100-40GB).
        </p>
      </Sec>
      <Sec id="workloads" title="Which workloads it helps">
        <p>
          In the sweep it is the largest single lever wherever prompts share
          prefixes: goodput per GPU rises{" "}
          <V of={e("coding-agent", "goodput_req_s_per_gpu")} fmt="signed" /> on
          the coding agent (a{" "}
          <V of="workload.coding-agent.system_len" fmt="int" />
          -token shared prefix and eight turns),{" "}
          <V of={e("voice", "goodput_req_s_per_gpu")} fmt="signed" /> on
          real-time voice (six turns) and{" "}
          <V of={e("chat", "goodput_req_s_per_gpu")} fmt="signed" /> on chat;
          only <V of={e("long-rag", "goodput_req_s_per_gpu")} fmt="signed" /> on
          long-context RAG, where the shared system prompt is a small part of
          each long prompt, and{" "}
          <V of={e("offline-batch", "goodput_req_s_per_gpu")} fmt="signed" /> on
          offline batch, which shares nothing. The cost is memory: peak KV use
          rises <V of={e("chat", "kv_peak_frac")} fmt="signed" /> on chat,
          because the cache keeps segments nobody is using right now. That is a
          trade worth making only while the memory is spare (
          <A href="/learn/02-paged-kv-and-preemption">chapter 2</A>).
        </p>
      </Sec>
      <Sec id="validation" title="Against the paper">
        <p>
          SGLang reports a large speed-up for multi-turn chat with short outputs
          and almost none with long ones; the simulator measures{" "}
          <V of="md|21|0|short (4-8 tokens)|Gain" /> and{" "}
          <V of="md|21|0|long (256-512 tokens)|Gain" /> (
          <V of="md|22|0|#10|Verdict" />
          ).
        </p>
      </Sec>
      <Deeper>
        <li>
          LLM Inference Explained:{" "}
          <A href={inferenceCh("05-memory-management")}>memory management</A>,
          including prefix sharing.
        </li>
        <li>
          GPU Kernels Explained:{" "}
          <A href={kernelsCh("02-roofline")}>the roofline</A>, why prefill time
          is FLOPs and a cached token is work saved.
        </li>
      </Deeper>
    </>
  );
}

export const C03: ChapterContent = { Hero, Body, refs: ["sglang", "vllm"] };
