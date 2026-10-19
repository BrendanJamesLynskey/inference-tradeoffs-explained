/**
 * The learning layer of every chapter (brief 44): three predict-then-reveal
 * self-checks and a "What to remember" box, rendered at the foot of the
 * chapter page. Every number comes from the sweep or the recorded results,
 * through the same paths `<V of>` prints (numeric answers through
 * `numericAnswer`); tests/unit/learn.test.ts checks each against the data,
 * and tests/unit/prose.test.ts that none is typed in by hand. Each check
 * links a section of its own chapter (`#mechanism`, `#why`, …).
 */
import type { ReactNode } from "react";

import { CheckYourself } from "@/components/learn/CheckYourself";
import { Keep, Remember } from "@/components/learn/Remember";
import { Check, type CheckSpec } from "@/components/mdx/Check";
import { V } from "@/components/mdx/V";

export type LearnSpec = {
  checks: readonly CheckSpec[];
  remember: readonly ReactNode[];
  keep: ReactNode;
};

const eff = (w: string, lever: string, metric: string, hw = "h100") =>
  `effect.${w}.${hw}.${lever}.${metric}`;
const pt = (w: string, hw: string, metric: string, lever = "baseline") =>
  `point.${w}.${hw}.${lever}.${metric}`;
const mech = (scenario: string, variant: string, key: string) =>
  `mech|${scenario}|${variant}|${key}`;
const GOODPUT = "goodput_req_s_per_gpu";

export function LearnBlock({ spec }: { spec: LearnSpec }): JSX.Element {
  return (
    <div className="mdx-content max-w-3xl">
      <CheckYourself>
        {spec.checks.map((c) => (
          <Check key={c.id} {...c} />
        ))}
      </CheckYourself>
      <Remember>
        <ul>
          {spec.remember.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <Keep>{spec.keep}</Keep>
      </Remember>
    </div>
  );
}

export const LEARN: Record<string, LearnSpec> = {
  "01-batching-and-chunked-prefill": {
    checks: [
      {
        id: "t01-q1",
        n: 1,
        q: "Which policy keeps the tokens flowing evenly but makes newcomers wait for their first token?",
        choices: ["Prefill-priority", "Decode-priority", "Chunked prefill"],
        answer: 1,
        href: "#mechanism",
        more: "Three ways to fill a forward pass",
        why: (
          <>
            Decode-priority admits prompts only when the running batch drains:
            ITL p99 is{" "}
            <V of={mech("batching", "decode-priority", "itl_p99")} fmt="ms" />,
            but the median first token waits{" "}
            <V of={mech("batching", "decode-priority", "ttft_p50")} fmt="ms" />.
          </>
        ),
      },
      {
        id: "t01-q2",
        n: 2,
        q: "In the animation, what is the ITL p99 with chunked prefill at the smallest token budget, in ms?",
        input: "number",
        of: mech("batching", "chunked-256", "itl_p99"),
        fmt: "ms",
        href: "#mechanism",
        more: "Three ways to fill a forward pass",
        why: (
          <>
            Against{" "}
            <V of={mech("batching", "prefill-priority", "itl_p99")} fmt="ms" />{" "}
            under prefill-priority: no decode waits for a whole prompt, because
            each pass carries only a slice of one.
          </>
        ),
      },
      {
        id: "t01-q3",
        n: 3,
        q: "Why does riding prompt tokens along in a decode pass cost the decodes so little?",
        choices: [
          "Because prompt tokens need no weights",
          "Because a decode pass is memory-bound: the extra rows reuse weights already being read",
          "Because the simulator skips them",
        ],
        answer: 1,
        href: "#why",
        more: "Why chunking is nearly free here",
        why: (
          <>
            A decode pass reads every weight for one token per row, so its
            compute idles; prompt rows use that idle compute until the pass
            turns compute-bound. On chat, a mid-sized budget raises goodput per
            GPU by <V of={eff("chat", "chunked-512", GOODPUT)} fmt="signed" />.
          </>
        ),
      },
    ],
    remember: [
      "Prefill-priority stalls running decodes behind every whole prompt.",
      "Decode-priority keeps tokens smooth but starves newcomers of their first token.",
      "Chunked prefill gives each pass a token budget: decodes first, then a slice of a prompt.",
      "Piggy-backing is nearly free because decode passes are memory-bound.",
    ],
    keep: "A small token budget keeps decode smooth; a large one finishes prompts sooner.",
  },
  "02-paged-kv-and-preemption": {
    checks: [
      {
        id: "t02-q1",
        n: 1,
        q: "What does reserving (the baseline) book for each request at admission?",
        choices: [
          "Only its prompt",
          "Its prompt plus the whole output it might produce",
          "A fixed-size block",
        ],
        answer: 1,
        href: "#mechanism",
        more: "Reserve up front, or hand out blocks",
        why: (
          <>
            The request can never run out, but most of the booking sits empty
            for most of its life, and a new request waits until a whole booking
            fits.
          </>
        ),
      },
      {
        id: "t02-q2",
        n: 2,
        q: "Where memory binds (the vLLM paper's setting), how many times the reserving system's rate does paged KV sustain within the latency target?",
        input: "number",
        of: "md|20|1|Orca (Oracle)|Paged vs this",
        tol: 0.05,
        href: "#why",
        more: "Why it matters only where memory binds",
        why: (
          <>
            Reserved KV holds tokens in only{" "}
            <V of="md|20|0|#6|Allocated KV holding tokens" /> of what it
            allocates, paged in{" "}
            <V of="md|20|0|#7|Allocated KV holding tokens" />, so far more
            requests run at once.
          </>
        ),
      },
      {
        id: "t02-q3",
        n: 3,
        q: "In the sweep, paged KV changes chat's goodput hardly at all. Why?",
        choices: [
          "Paging does not help",
          "Memory does not bind: four H100s per instance leave plenty of room for KV",
          "The sweep turns paging off",
        ],
        answer: 1,
        href: "#workloads",
        more: "Why the sweep shows almost nothing",
        why: (
          <>
            Goodput moves by{" "}
            <V of={eff("chat", "paged", GOODPUT)} fmt="signed" />: read the
            zeros as memory not binding. With smaller GPUs, longer contexts or
            larger batches the lever matters.
          </>
        ),
      },
    ],
    remember: [
      "A KV cache grows with every token, to a length nobody knows in advance.",
      "Reserving books the worst case; paged KV hands out blocks as tokens arrive.",
      "Paging can run out mid-flight: then a request is preempted, recomputed or swapped.",
      "It matters where memory binds; a roomy deployment shows almost nothing.",
    ],
    keep: "Paged memory holds tokens, not promises.",
  },
  "03-prefix-caching": {
    checks: [
      {
        id: "t03-q1",
        n: 1,
        q: "In the animation, what share of all prompt tokens are found in the prefix cache?",
        input: "slider",
        min: 0,
        max: 100,
        step: 1,
        of: mech("prefix", "on", "hit_rate"),
        fmt: "pct",
        abs: 4,
        href: "#mechanism",
        more: "Compute a shared prefix once",
        why: (
          <>
            <V of={mech("prefix", "on", "hit_rate")} fmt="pct" />, and the
            median first token falls from{" "}
            <V of={mech("prefix", "off", "ttft_p50")} fmt="ms" /> to{" "}
            <V of={mech("prefix", "on", "ttft_p50")} fmt="ms" />.
          </>
        ),
      },
      {
        id: "t03-q2",
        n: 2,
        q: "Which workload gains least from prefix caching in the sweep?",
        choices: [
          "The coding agent, with its long shared prefix",
          "Real-time voice",
          "Offline batch, which shares nothing",
        ],
        answer: 2,
        href: "#workloads",
        more: "Which workloads it helps",
        why: (
          <>
            Offline batch moves by{" "}
            <V
              of={eff("offline-batch", "prefix-cache", GOODPUT)}
              fmt="signed"
            />
            ; the coding agent gains{" "}
            <V of={eff("coding-agent", "prefix-cache", GOODPUT)} fmt="signed" />
            .
          </>
        ),
      },
      {
        id: "t03-q3",
        n: 3,
        q: "Why is a cached prompt token worth so much?",
        choices: [
          "It makes the token's decode faster",
          "Prefill is compute-bound: a cached token is a token of work not done at all",
          "It shrinks the KV cache",
        ],
        answer: 1,
        href: "#why",
        more: "Why it saves so much",
        why: (
          <>
            Every prompt token costs its share of the model&apos;s FLOPs, so the
            gain grows with the shared fraction of each prompt. The cost is
            memory: on chat peak KV use rises{" "}
            <V of={eff("chat", "prefix-cache", "kv_peak_frac")} fmt="signed" />.
          </>
        ),
      },
    ],
    remember: [
      "Shared prompt prefixes have the same keys and values every time: compute them once.",
      "A cached token is prefill work not done, and prefill is compute-bound.",
      "The hit rate depends on how soon a prefix comes back and how much KV memory is spare.",
      "It is the largest single lever wherever prompts share prefixes.",
    ],
    keep: "Prefix caching trades spare KV memory for prefill compute.",
  },
  "04-disaggregation": {
    checks: [
      {
        id: "t04-q1",
        n: 1,
        q: "In the animation, what is ITL p99 once prefill and decode run on separate pools, in ms?",
        input: "number",
        of: mech("pools", "1p1d", "itl_p99"),
        fmt: "ms",
        href: "#mechanism",
        more: "Separate the two phases",
        why: (
          <>
            Against <V of={mech("pools", "colocated", "itl_p99")} fmt="ms" />{" "}
            colocated: decode passes never wait behind a prompt.
          </>
        ),
      },
      {
        id: "t04-q2",
        n: 2,
        q: "Disaggregating into one prefill and one decode instance: what happens to chat's TTFT p99?",
        choices: ["It falls", "It rises", "It does not change"],
        answer: 1,
        href: "#workloads",
        more: "Which workloads it helps",
        why: (
          <>
            It rises{" "}
            <V of={eff("chat", "disagg-1p1d", "ttft_p99")} fmt="signed" />:
            prompts now share one prefill instance instead of two, and queue
            when they bunch up, while TPOT p99 falls.
          </>
        ),
      },
      {
        id: "t04-q3",
        n: 3,
        q: "So which workload's goodput does the split raise, and which does it cut?",
        choices: [
          "It raises every workload's",
          "It raises voice's, whose tight TPOT SLO the stalls break, and cuts chat's",
          "It cuts every workload's",
        ],
        answer: 1,
        href: "#workloads",
        more: "Which workloads it helps",
        why: (
          <>
            Voice <V of={eff("voice", "disagg-1p1d", GOODPUT)} fmt="signed" />,
            chat <V of={eff("chat", "disagg-1p1d", GOODPUT)} fmt="signed" />: a
            fixed split is right for only one mix of prompt and output lengths.
          </>
        ),
      },
    ],
    remember: [
      "Disaggregation keeps decode passes from waiting behind prompts: a flat decode tail.",
      "Every request's KV cache must then cross a link.",
      "Fewer prefill instances mean prompts queue: TTFT can rise.",
      "A fixed pool split suits one workload mix; capacity can move either way.",
    ],
    keep: "Split for the decode tail; size the pools for the workload.",
  },
  "05-heterogeneous-and-optical-pools": {
    checks: [
      {
        id: "t05-q1",
        n: 1,
        q: "Put an A100 decode pool behind an H100 prefill pool. What happens to TPOT p99?",
        choices: [
          "It breaks the SLO",
          "It rises but stays inside the TPOT SLO",
          "It falls",
        ],
        answer: 1,
        href: "#mechanism",
        more: "Each phase on the device that suits it",
        why: (
          <>
            From <V of={mech("hetero", "h100-h100", "tpot_p99")} fmt="ms" /> to{" "}
            <V of={mech("hetero", "h100-a100", "tpot_p99")} fmt="ms" />: decode
            is memory-bound, so an older part with good bandwidth can do.
          </>
        ),
      },
      {
        id: "t05-q2",
        n: 2,
        q: "And an A100 prefill pool in front of an H100 decode pool?",
        choices: [
          "It keeps up easily",
          "It cannot keep up with the prompts: TTFT p99 grows far beyond the SLO",
          "It saves energy at no cost",
        ],
        answer: 1,
        href: "#mechanism",
        more: "Each phase on the device that suits it",
        why: (
          <>
            Prefill is compute-bound and wants FLOPs: TTFT p99 goes from{" "}
            <V of={mech("hetero", "h100-h100", "ttft_p99")} fmt="ms" /> to{" "}
            <V of={mech("hetero", "a100-h100", "ttft_p99")} fmt="ms" />.
          </>
        ),
      },
      {
        id: "t05-q3",
        n: 3,
        q: "Why does the hypothetical optical prefill pool mostly lose?",
        choices: [
          "Light is slower than electricity",
          "It speeds up only the FFT part, and pays for conversions, mask rewrites and laser power",
          "It cannot hold the weights",
        ],
        answer: 1,
        href: "#why",
        more: "Why the optical pool mostly loses",
        why: (
          <>
            A GPU already runs FFTs fast, and every optical pass pays for
            analogue-digital conversion and a static laser power the GPU does
            not.
          </>
        ),
      },
    ],
    remember: [
      "Separate pools can use different hardware: FLOPs for prefill, bandwidth for decode.",
      "A cheaper, bandwidth-rich part can serve decode inside the SLO.",
      "An under-powered prefill pool queues prompts without bound.",
      "An optical transform engine helps only FFT mixing, and mostly loses to a GPU.",
    ],
    keep: "Match each pool's hardware to its bound: compute for prefill, memory for decode.",
  },
  "06-kv-handoff-and-compression": {
    checks: [
      {
        id: "t06-q1",
        n: 1,
        q: "In the animation, decode TPOT p99 over a 25 GbE link, in ms?",
        input: "number",
        of: mech("handoff", "eth-25g", "tpot_p99"),
        fmt: "ms",
        href: "#mechanism",
        more: "The hand-off is bytes over a wire",
        why: (
          <>
            Against <V of={mech("handoff", "nvlink4", "tpot_p99")} fmt="ms" />{" "}
            over NVLink: on the slow link the hand-offs queue, and TPOT includes
            the wait.
          </>
        ),
      },
      {
        id: "t06-q2",
        n: 2,
        q: "When does the KV link start to matter?",
        choices: [
          "Always: every hand-off is slow",
          "When hand-off bytes times request rate approaches the link's bandwidth",
          "Only for short prompts",
        ],
        answer: 1,
        href: "#why",
        more: "When the link matters",
        why: (
          <>
            Then transfers queue, and the queue grows without bound as the load
            rises. Over NVLink or InfiniBand at these rates the hand-off is a
            rounding error.
          </>
        ),
      },
      {
        id: "t06-q3",
        n: 3,
        q: "FP8 compression in transit on the same 25 GbE link: what does TPOT p99 become, in ms?",
        input: "number",
        of: mech("handoff", "eth-25g-fp8", "tpot_p99"),
        fmt: "ms",
        href: "#mechanism",
        more: "The hand-off is bytes over a wire",
        why: (
          <>
            Compression shortens every hand-off by its ratio, and where the
            bytes are mostly waiting it helps by far more: on a saturated link
            it is a prerequisite, not an optimisation.
          </>
        ),
      },
    ],
    remember: [
      "Every disaggregated request ships its prompt's KV cache across the link.",
      "The link is a third resource with its own queue.",
      "It matters when bytes times rate nears the bandwidth; then compression is a prerequisite.",
      "Compressing in transit costs the GPU nothing; on the GPU it costs one elementwise pass.",
    ],
    keep: "Link load = hand-off bytes × request rate ÷ bandwidth: keep it well below one.",
  },
  "07-encoder-only-prefill": {
    checks: [
      {
        id: "t07-q1",
        n: 1,
        q: "In the animation, with CED's replay on the prefill pool, what is TTFT p99, in ms?",
        input: "number",
        of: mech("ced", "ced-prefill", "ttft_p99"),
        fmt: "ms",
        href: "#mechanism",
        more: "Most of the prompt never meets the decoder",
        why: (
          <>
            Against <V of={mech("ced", "decoder-only", "ttft_p99")} fmt="ms" />{" "}
            decoder-only: a prompt token runs only the encoder and the
            decoder&apos;s key and value projections.
          </>
        ),
      },
      {
        id: "t07-q2",
        n: 2,
        q: "What does CED do to time per output token?",
        choices: [
          "It halves it",
          "Nothing: decode runs the whole model as before",
          "It doubles it",
        ],
        answer: 1,
        href: "#mechanism",
        more: "Most of the prompt never meets the decoder",
        why: (
          <>
            TPOT p99 is{" "}
            <V of={mech("ced", "ced-prefill", "tpot_p99")} fmt="ms" /> against{" "}
            <V of={mech("ced", "decoder-only", "tpot_p99")} fmt="ms" />: only
            prefill changes.
          </>
        ),
      },
      {
        id: "t07-q3",
        n: 3,
        q: "Why can CED's capacity more than double when it only halves prefill work?",
        choices: [
          "It also speeds up decode",
          "Under a fixed TTFT SLO, halving a queue's service time cuts its waiting by more than half",
          "It uses fewer GPUs",
        ],
        answer: 1,
        href: "#why",
        more: "Why capacity can more than double",
        why: (
          <>
            Queueing, not FLOPs: at one prompt-to-output ratio the best split
            serves <V of="md|17|0|#4|vs decoder-only best" /> the decoder-only
            model&apos;s best.
          </>
        ),
      },
    ],
    remember: [
      "A causal encoder-decoder lets prompt tokens skip the decoder half.",
      "Prefill work about halves; decode is unchanged.",
      "Under a TTFT SLO, queueing turns half the service time into more than twice the capacity.",
      "The model must be trained this way: the cost is outside the simulator.",
    ],
    keep: "Halve the service time of a busy queue and its wait falls by more than half.",
  },
  "08-tp-pp-ep": {
    checks: [
      {
        id: "t08-q1",
        n: 1,
        q: "A batch-one decode step on eight H100s with tensor parallelism: what share of its time goes to all-reduces?",
        input: "slider",
        min: 0,
        max: 100,
        step: 1,
        of: "md|24|0|8|of it all-reduce",
        abs: 4,
        href: "#why",
        more: "Why more GPUs per instance can be slower",
        why: (
          <>
            <V of="md|24|0|8|of it all-reduce" />: every all-reduce costs at
            least its link latency, twice per layer, and that does not shrink
            with the batch. The step is no faster than on four GPUs.
          </>
        ),
      },
      {
        id: "t08-q2",
        n: 2,
        q: "Run the eight GPUs as one TP8 instance instead of two TP4 instances. What happens on chat?",
        choices: [
          "Both TTFT and TPOT fall",
          "TTFT falls and TPOT rises, and capacity falls",
          "Nothing changes",
        ],
        answer: 1,
        href: "#workloads",
        more: "What the sweep measured",
        why: (
          <>
            TTFT p99 <V of={eff("chat", "tp8", "ttft_p99")} fmt="signed" />{" "}
            (twice the FLOPs per prefill), TPOT p99{" "}
            <V of={eff("chat", "tp8", "tpot_p99")} fmt="signed" />, goodput{" "}
            <V of={eff("chat", "tp8", GOODPUT)} fmt="signed" />.
          </>
        ),
      },
      {
        id: "t08-q3",
        n: 3,
        q: "Why do four TP2 instances lose most of their capacity?",
        choices: [
          "Their all-reduces are slower",
          "Two GPUs hold the whole model, leaving almost no room for KV",
          "Pipeline bubbles",
        ],
        answer: 1,
        href: "#workloads",
        more: "What the sweep measured",
        why: (
          <>
            Chat goodput moves by{" "}
            <V of={eff("chat", "tp2x4", GOODPUT)} fmt="signed" />: without KV
            memory the batch cannot grow.
          </>
        ),
      },
    ],
    remember: [
      "Tensor parallelism splits every layer; its all-reduces cost latency twice per layer.",
      "More GPUs per instance divide the bytes but not the latency: decode can get no faster.",
      "Pipeline parallelism pays a bubble unless several batches are in flight.",
      "Expert parallelism trades the all-reduce for an all-to-all; imbalance stretches the busiest GPU.",
    ],
    keep: "Split as little as the memory allows: every split adds communication.",
  },
  "09-quantisation": {
    checks: [
      {
        id: "t09-q1",
        n: 1,
        q: "Which helps a compute-bound prefill: narrower storage of the weights, or narrower matmuls?",
        choices: [
          "Narrower storage alone (weight-only, such as W4A16)",
          "Narrower matmuls (W8A8), on tensor cores built for them",
          "Neither",
        ],
        answer: 1,
        href: "#why",
        more: "Why decode and prefill gain differently",
        why: (
          <>
            On four H100s FP8 weights alone leave a long prefill at{" "}
            <V of="md|24|5|#1|Prefill 8,192" />, while W8A8 cuts it to{" "}
            <V of="md|24|5|#2|Prefill 8,192" />.
          </>
        ),
      },
      {
        id: "t09-q2",
        n: 2,
        q: "FP8 weights and matmuls (W8A8): by how much does goodput per GPU change on chat, in per cent?",
        input: "number",
        of: eff("chat", "w8a8-fp8", GOODPUT),
        fmt: "signed",
        tol: 0.1,
        href: "#workloads",
        more: "What the sweep measured",
        why: (
          <>
            <V of={eff("chat", "w8a8-fp8", GOODPUT)} fmt="signed" />, as much as
            any single lever outside prefix caching, with TTFT and TPOT both
            falling.
          </>
        ),
      },
      {
        id: "t09-q3",
        n: 3,
        q: "INT4 weights with BF16 matmuls on chat: which latency improves?",
        choices: ["TTFT", "TPOT", "Both"],
        answer: 1,
        href: "#workloads",
        more: "What the sweep measured",
        why: (
          <>
            TPOT p99 <V of={eff("chat", "w4-int4", "tpot_p99")} fmt="signed" />,
            TTFT p99 <V of={eff("chat", "w4-int4", "ttft_p99")} fmt="signed" />:
            decode reads fewer bytes, prefill still multiplies in BF16.
          </>
        ),
      },
    ],
    remember: [
      "Narrower storage means fewer bytes per pass: memory-bound decode gets faster.",
      "Narrower compute needs tensor-core units for the format: only then is prefill faster.",
      "Weight-only formats help decode, not prefill, as the roofline predicts.",
      "Accuracy is not simulated: every gain assumes the quantised model is good enough.",
    ],
    keep: "Bytes speed up decode; narrower matmuls speed up prefill.",
  },
  "10-speculative-decoding": {
    checks: [
      {
        id: "t10-q1",
        n: 1,
        q: "In the animation, with three drafts per pass, how many tokens do the requests keep per target pass on average?",
        input: "number",
        of: mech("speculative", "g3a07", "tokens_per_verify"),
        tol: 0.05,
        href: "#mechanism",
        more: "Guess several tokens, check them in one pass",
        why: (
          <>
            <V of={mech("speculative", "g3a07", "tokens_per_verify")} />, and
            TPOT p99 falls from{" "}
            <V of={mech("speculative", "off", "tpot_p99")} fmt="ms" /> to{" "}
            <V of={mech("speculative", "g3a07", "tpot_p99")} fmt="ms" />.
          </>
        ),
      },
      {
        id: "t10-q2",
        n: 2,
        q: "Why does speculation help at low batch and hurt at high batch?",
        choices: [
          "The draft gets worse with the batch",
          "A small-batch pass is memory-bound, so extra positions are nearly free; a large-batch pass is compute-bound, so they cost their FLOPs",
          "Large batches skip the target model",
        ],
        answer: 1,
        href: "#why",
        more: "Why it helps at low batch and hurts at high",
        why: (
          <>
            At saturation the simulator measures throughput falling to{" "}
            <V of="md|25|4|#2|Ratio" /> of plain decoding: rejected drafts are
            wasted work once compute binds.
          </>
        ),
      },
      {
        id: "t10-q3",
        n: 3,
        q: "Which workload gains most from the MTP head in the sweep?",
        choices: [
          "Offline batch",
          "Real-time voice, whose tight TPOT SLO limits it",
          "Long-context RAG",
        ],
        answer: 1,
        href: "#workloads",
        more: "What the sweep measured",
        why: (
          <>
            Voice <V of={eff("voice", "spec-mtp", GOODPUT)} fmt="signed" />,
            offline batch only{" "}
            <V of={eff("offline-batch", "spec-mtp", GOODPUT)} fmt="signed" />.
          </>
        ),
      },
    ],
    remember: [
      "A draft proposes several tokens; the target checks them all in one pass.",
      "It pays while decode is memory-bound: at small batch and under tight TPOT SLOs.",
      "At large batch the verify pass is compute-bound and rejected drafts are waste.",
      "The output distribution is the target's own.",
    ],
    keep: "Speculate when the pass is memory-bound; stop when compute binds.",
  },
  "11-power-and-energy": {
    checks: [
      {
        id: "t11-q1",
        n: 1,
        q: "In the animation, a power cap per GPU: what is the energy per output token, in joules?",
        input: "number",
        of: mech("power", "cap300", "j_per_tok"),
        tol: 0.05,
        href: "#mechanism",
        more: "Where the joules go",
        why: (
          <>
            <V of={mech("power", "cap300", "j_per_tok")} /> J against{" "}
            <V of={mech("power", "default", "j_per_tok")} /> J uncapped, at the
            price of a longer TTFT p99:{" "}
            <V of={mech("power", "cap300", "ttft_p99")} fmt="ms" />.
          </>
        ),
      },
      {
        id: "t11-q2",
        n: 2,
        q: "Why is energy per token lowest when the GPUs are busy?",
        choices: [
          "Busy GPUs run cooler",
          "Static power is paid whether or not tokens flow, so idle time adds joules to every token",
          "The cap turns off at high load",
        ],
        answer: 1,
        href: "#why",
        more: "Why the cheapest joule is the busy one",
        why: (
          <>
            The static share of energy grows as the load falls:{" "}
            <V of="md|6|0|0.5 req/s|Static share of energy" /> at the lowest
            load recorded.
          </>
        ),
      },
      {
        id: "t11-q3",
        n: 3,
        q: "What does DVFS (lower clocks on memory-bound passes) cost?",
        choices: [
          "A large slow-down",
          "Almost nothing in time: compute waits for memory there anyway",
          "More energy",
        ],
        answer: 1,
        href: "#mechanism",
        more: "Where the joules go",
        why: (
          <>
            It saves a little energy at no cost in time:{" "}
            <V of={mech("power", "dvfs", "j_per_tok")} /> J per token.
          </>
        ),
      },
    ],
    remember: [
      "Each pass costs static energy (idling) plus dynamic energy (compute and memory).",
      "A power cap clips compute-bound prefills: fewer joules, longer TTFT.",
      "Static power makes busy GPUs the efficient ones; capacity levers cut joules per token too.",
      "DVFS saves energy on memory-bound passes at no cost in time.",
    ],
    keep: "The cheapest joule is spent on a busy GPU.",
  },
  "12-hardware-and-cost": {
    checks: [
      {
        id: "t12-q1",
        n: 1,
        q: "On chat, how many requests per second per B200 does the baseline serve?",
        input: "number",
        of: pt("chat", "b200", GOODPUT),
        fmt: "metric",
        tol: 0.1,
        href: "#why",
        more: "What the sweep measured",
        why: (
          <>
            Against <V of={pt("chat", "h100", GOODPUT)} fmt="metric" /> per H100
            and <V of={pt("chat", "h200", GOODPUT)} fmt="metric" /> per H200;
            the B200&apos;s BF16 rate and power are assumptions, so treat it as
            a sketch.
          </>
        ),
      },
      {
        id: "t12-q2",
        n: 2,
        q: "On offline batch, how does the H200's cost per token compare with the H100's?",
        choices: [
          "Cheaper: more bandwidth",
          "Dearer: its extra bandwidth does not pay for its price there",
          "The same",
        ],
        answer: 1,
        href: "#why",
        more: "What the sweep measured",
        why: (
          <>
            <V of={pt("offline-batch", "h200", "usd_per_mtok")} fmt="metric" />{" "}
            against{" "}
            <V of={pt("offline-batch", "h100", "usd_per_mtok")} fmt="metric" />{" "}
            per million tokens, at the illustrative prices.
          </>
        ),
      },
      {
        id: "t12-q3",
        n: 3,
        q: "Can the right levers on an H100 beat the B200 baseline on cost per token?",
        choices: [
          "No: newer hardware always wins",
          "Yes: the best lever on an H100 serves chat for less than the B200 baseline",
          "Only on offline batch",
        ],
        answer: 1,
        href: "#why",
        more: "What the sweep measured",
        why: (
          <>
            <V
              of={pt("chat", "h100", "usd_per_mtok", "modern-colocated")}
              fmt="metric"
            />{" "}
            per million tokens against the B200 baseline&apos;s{" "}
            <V of={pt("chat", "b200", "usd_per_mtok")} fmt="metric" />: the
            levers matter as much as the device.
          </>
        ),
      },
    ],
    remember: [
      "Devices differ in bandwidth, capacity and compute; each pass speeds up by its bound.",
      "Cost per token = price per GPU-hour over tokens served at capacity.",
      "A dearer device wins only when its capacity grows by more than its price.",
      "Levers can matter as much as the device.",
    ],
    keep: "Cost per million tokens = price per hour ÷ tokens per hour, at capacity.",
  },
  "13-combining-levers": {
    checks: [
      {
        id: "t13-q1",
        n: 1,
        q: "The modern colocated configuration (chunked prefill, paged KV, prefix caching, FP8): by how much does it raise chat's goodput per GPU, in per cent?",
        input: "number",
        of: eff("chat", "modern-colocated", GOODPUT),
        fmt: "signed",
        tol: 0.1,
        href: "#why",
        more: "Why they multiply",
        why: (
          <>
            <V of={eff("chat", "modern-colocated", GOODPUT)} fmt="signed" />,
            against <V of={eff("chat", "prefix-cache", GOODPUT)} fmt="signed" />{" "}
            for prefix caching and{" "}
            <V of={eff("chat", "w8a8-fp8", GOODPUT)} fmt="signed" /> for FP8
            alone: the gains compound.
          </>
        ),
      },
      {
        id: "t13-q2",
        n: 2,
        q: "Why do the levers compound rather than overlap?",
        choices: [
          "They are all the same lever",
          "They attack different costs: prompt work, memory, bytes per pass, passes per token",
          "The sweep adds them by hand",
        ],
        answer: 1,
        href: "#why",
        more: "Why they multiply",
        why: (
          <>
            Each removes a different cost, so what is left after one is still
            there for the next to cut.
          </>
        ),
      },
      {
        id: "t13-q3",
        n: 3,
        q: "With every lever available to both, what does disaggregation still buy?",
        choices: [
          "The best goodput on every workload",
          "No goodput win, but the flattest decode tail",
          "Nothing at all",
        ],
        answer: 1,
        href: "#why",
        more: "Where they do not",
        why: (
          <>
            ITL p99 on chat{" "}
            <V of={eff("chat", "modern-disagg", "itl_p99")} fmt="signed" />{" "}
            against{" "}
            <V of={eff("chat", "modern-colocated", "itl_p99")} fmt="signed" />{" "}
            colocated: the choice when that tail is the SLO that binds.
          </>
        ),
      },
    ],
    remember: [
      "Real engines combine levers: chunking, paging, prefix caching, narrow formats.",
      "Levers that attack different costs compound.",
      "With every lever on both sides, disaggregation's goodput edge vanishes; its flat tail remains.",
      "Very large percentages sit at the cliff of a tight SLO: read them with the matrix's marks.",
    ],
    keep: "Combine levers that attack different costs; disaggregate only for the tail.",
  },
};
