/**
 * The chapters: one per lever (brief 20 §5). Each opens with its mechanism
 * animated from the simulator's recorded states, then its row of the
 * matrix (for the eight lever families the sweep varies) or the simulator's
 * recorded results in the same colours (heterogeneous and optical pools,
 * the KV hand-off, CED, power and hardware draw on its earlier sections),
 * then why it behaves as measured and its papers. The content is in
 * src/content/chapters/.
 */
import type { Family } from "./metrics";

export type Chapter = {
  slug: string;
  title: string;
  /** The sweep family this chapter covers, or null (no sweep lever: recorded results). */
  family: Family | null;
  /** One line: what the lever does (no numbers: those come from the data). */
  summary: string;
};

export const CHAPTERS: readonly Chapter[] = [
  {
    slug: "01-batching-and-chunked-prefill",
    title: "Batching policy and chunked prefill",
    family: "batching",
    summary:
      "Which requests share a forward pass: prompts first, running decodes first, or prompts cut into chunks that ride along with the decodes.",
  },
  {
    slug: "02-paged-kv-and-preemption",
    title: "Paged KV and preemption",
    family: "kv-memory",
    summary:
      "Reserving each request's whole KV cache up front, or handing out blocks as it grows and evicting a request when they run out.",
  },
  {
    slug: "03-prefix-caching",
    title: "Prefix caching",
    family: "prefix-caching",
    summary:
      "Keeping the KV of shared prompt prefixes so the next request with the same prefix skips their prefill.",
  },
  {
    slug: "04-disaggregation",
    title: "Disaggregation and the pool split",
    family: "disaggregation",
    summary:
      "Running prefill and decode on separate GPU pools, handing each request's KV cache across a link.",
  },
  {
    slug: "05-heterogeneous-and-optical-pools",
    title: "Heterogeneous pools and the optical prefill pool",
    family: null,
    summary:
      "Different hardware for prefill and decode, including a hypothetical optical transform engine.",
  },
  {
    slug: "06-kv-handoff-and-compression",
    title: "KV hand-off links and in-transit compression",
    family: null,
    summary:
      "What the link between the pools costs, and compressing the KV cache on its way across.",
  },
  {
    slug: "07-encoder-only-prefill",
    title: "Encoder-only prefill (CED)",
    family: null,
    summary:
      "A causal encoder–decoder split that changes what the prefill pool has to compute.",
  },
  {
    slug: "08-tp-pp-ep",
    title: "Tensor, pipeline and expert parallelism",
    family: "parallelism",
    summary:
      "Splitting one model across GPUs: slicing every layer's matrices, cutting the layers into pipeline stages, or spreading a mixture of experts, and what each costs in communication, memory and idle time.",
  },
  {
    slug: "09-quantisation",
    title: "Quantisation",
    family: "quantisation",
    summary:
      "Fewer bytes per weight and per KV value, and faster matmuls where the hardware has units for the format.",
  },
  {
    slug: "10-speculative-decoding",
    title: "Speculative decoding",
    family: "speculative",
    summary:
      "A cheap draft proposes several tokens and the target model checks them in one pass.",
  },
  {
    slug: "11-power-and-energy",
    title: "Power and energy",
    family: null,
    summary:
      "Where the joules per token go, and what power caps and clock scaling trade.",
  },
  {
    slug: "12-hardware-and-cost",
    title: "Hardware choice and cost",
    family: null,
    summary:
      "H100, H200 or B200: what each buys on each workload, per GPU and per dollar.",
  },
  {
    slug: "13-combining-levers",
    title: "Combining levers",
    family: "combined",
    summary:
      "The levers together, as modern serving engines run them, against each one alone.",
  },
];

/** The chapter for a sweep family. */
export function chapterOf(family: Family): Chapter | undefined {
  return CHAPTERS.find((c) => c.family === family);
}
