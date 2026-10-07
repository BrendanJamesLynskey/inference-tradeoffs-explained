/**
 * The papers and sources the chapters cite. Every arXiv id was checked at
 * export.arxiv.org (title and first authors) and every DOI through
 * Crossref when this file was written (2026-10-07); scripts/check_links.py
 * checks every link returns 200.
 */
export type Ref = {
  short: string;
  authors: string;
  title: string;
  href: string;
  venue?: string;
  note?: string;
};

export const REFS = {
  sarathi: {
    short: "Sarathi-Serve",
    authors: "Agrawal, Kedia, Panwar et al.",
    title:
      "Taming Throughput-Latency Tradeoff in LLM Inference with Sarathi-Serve",
    href: "https://arxiv.org/abs/2403.02310",
    venue: "arXiv:2403.02310",
    note: "stall-free batching: chunked prefills piggy-backed on decodes, a token budget per step",
  },
  distserve: {
    short: "DistServe",
    authors: "Zhong, Liu, Chen et al.",
    title:
      "DistServe: Disaggregating Prefill and Decoding for Goodput-optimized Large Language Model Serving",
    href: "https://arxiv.org/abs/2401.09670",
    venue: "arXiv:2401.09670",
    note: "goodput under TTFT and TPOT SLOs, the metric this site measures capacity by",
  },
  vllm: {
    short: "PagedAttention (vLLM)",
    authors: "Kwon, Li, Zhuang et al.",
    title:
      "Efficient Memory Management for Large Language Model Serving with PagedAttention",
    href: "https://arxiv.org/abs/2309.06180",
    venue: "arXiv:2309.06180",
    note: "KV blocks allocated on demand, preemption by recompute or swap",
  },
  sglang: {
    short: "SGLang (RadixAttention)",
    authors: "Zheng, Yin, Xie et al.",
    title: "SGLang: Efficient Execution of Structured Language Model Programs",
    href: "https://arxiv.org/abs/2312.07104",
    venue: "arXiv:2312.07104",
    note: "a radix tree of cached prefixes with LRU eviction",
  },
  splitwise: {
    short: "Splitwise",
    authors: "Patel, Choukse, Zhang et al.",
    title:
      "Splitwise: Efficient generative LLM inference using phase splitting",
    href: "https://arxiv.org/abs/2311.18677",
    venue: "arXiv:2311.18677",
    note: "different hardware for the prompt and token phases",
  },
  leviathan: {
    short: "Leviathan et al.",
    authors: "Leviathan, Kalman, Matias",
    title: "Fast Inference from Transformers via Speculative Decoding",
    href: "https://arxiv.org/abs/2211.17192",
    venue: "arXiv:2211.17192",
    note: "the expected tokens per verify pass and the speed-up theorems the simulator reproduces",
  },
  megatron: {
    short: "Megatron-LM",
    authors: "Shoeybi, Patwary, Puri et al.",
    title:
      "Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism",
    href: "https://arxiv.org/abs/1909.08053",
    venue: "arXiv:1909.08053",
    note: "tensor parallelism with two all-reduces per layer",
  },
  gpipe: {
    short: "GPipe",
    authors: "Huang, Cheng, Bapna et al.",
    title:
      "GPipe: Efficient Training of Giant Neural Networks using Pipeline Parallelism",
    href: "https://arxiv.org/abs/1811.06965",
    venue: "arXiv:1811.06965",
    note: "micro-batches through pipeline stages, and the bubble",
  },
  gshard: {
    short: "GShard",
    authors: "Lepikhin, Lee, Xu et al.",
    title:
      "GShard: Scaling Giant Models with Conditional Computation and Automatic Sharding",
    href: "https://arxiv.org/abs/2006.16668",
    venue: "arXiv:2006.16668",
    note: "experts across devices, with all-to-all dispatch and combine",
  },
  ring: {
    short: "Patarasuk and Yuan",
    authors: "Patarasuk, Yuan",
    title:
      "Bandwidth optimal all-reduce algorithms for clusters of workstations",
    href: "https://doi.org/10.1016/j.jpdc.2008.09.002",
    venue: "Journal of Parallel and Distributed Computing, 2009",
    note: "the ring all-reduce",
  },
  awq: {
    short: "AWQ",
    authors: "Lin, Tang, Tang et al.",
    title:
      "AWQ: Activation-aware Weight Quantization for LLM Compression and Acceleration",
    href: "https://arxiv.org/abs/2306.00978",
    venue: "arXiv:2306.00978",
    note: "INT4 weights in groups of 128 with a scale each (the simulator's INT4 bytes)",
  },
  mx: {
    short: "Microscaling (MX) formats",
    authors: "Rouhani, Zhao, More et al.",
    title: "Microscaling Data Formats for Deep Learning",
    href: "https://arxiv.org/abs/2310.10537",
    venue: "arXiv:2310.10537",
    note: "MXFP4: blocks of values sharing one scale (the simulator's FP4 bytes)",
  },
  deepseekv3: {
    short: "DeepSeek-V3",
    authors: "DeepSeek-AI",
    title: "DeepSeek-V3 Technical Report",
    href: "https://arxiv.org/abs/2412.19437",
    venue: "arXiv:2412.19437",
    note: "multi-token prediction heads, the simulator's MTP draft",
  },
  ced: {
    short: "DeepSeek-V4.1-Flash",
    authors: "DeepSeek-AI",
    title: "DeepSeek-V4.1-Flash: Pushing the Limits of KV Cache Compression",
    href: "https://arxiv.org/abs/2609.19969",
    venue: "arXiv:2609.19969",
    note: "the causal encoder-decoder split the CED option models (section 2.2)",
  },
  kivi: {
    short: "KIVI",
    authors: "Liu, Yuan, Jin et al.",
    title: "KIVI: A Tuning-Free Asymmetric 2bit Quantization for KV Cache",
    href: "https://arxiv.org/abs/2402.02750",
    venue: "arXiv:2402.02750",
  },
  kvquant: {
    short: "KVQuant",
    authors: "Hooper, Kim, Mohammadzadeh et al.",
    title:
      "KVQuant: Towards 10 Million Context Length LLM Inference with KV Cache Quantization",
    href: "https://arxiv.org/abs/2401.18079",
    venue: "arXiv:2401.18079",
  },
  freqkv: {
    short: "FreqKV",
    authors: "Kai, Wang, Zeng et al.",
    title:
      "FreqKV: Key-Value Compression in Frequency Domain for Context Window Extension",
    href: "https://arxiv.org/abs/2505.00570",
    venue: "arXiv:2505.00570",
  },
  dynamollm: {
    short: "DynamoLLM",
    authors: "Stojkovic, Zhang, Goiri et al.",
    title:
      "DynamoLLM: Designing LLM Inference Clusters for Performance and Energy Efficiency",
    href: "https://arxiv.org/abs/2408.00741",
    venue: "arXiv:2408.00741",
    note: "reconfiguring instances and GPU frequency for energy under SLOs",
  },
  h100: {
    short: "NVIDIA H100",
    authors: "NVIDIA",
    title: "H100 Tensor Core GPU",
    href: "https://www.nvidia.com/en-us/data-center/h100/",
    note: "datasheet figures the simulator's H100 preset uses",
  },
  h200: {
    short: "NVIDIA H200",
    authors: "NVIDIA",
    title: "H200 Tensor Core GPU",
    href: "https://www.nvidia.com/en-us/data-center/h200/",
    note: "datasheet figures the simulator's H200 preset uses",
  },
  b200: {
    short: "NVIDIA DGX B200",
    authors: "NVIDIA",
    title: "DGX B200",
    href: "https://www.nvidia.com/en-us/data-center/dgx-b200/",
    note: "per-GPU figures the simulator's B200 preset uses (its power coefficients are illustrative)",
  },
} as const satisfies Record<string, Ref>;

export type RefKey = keyof typeof REFS;
