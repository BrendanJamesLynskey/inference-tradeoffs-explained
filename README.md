# Inference Trade-offs Explained

Architectural trade-offs in LLM inference, measured. Serving a language
model is a stack of decisions: how to batch, how to hold the KV cache,
whether to split prefill from decode, how to split the model across GPUs,
which number formats, whether to draft tokens speculatively. Each lever helps
some measures and costs others, and the answer changes with the workload.
This site is organised around those decisions, and **nothing on it is
asserted**: every number comes from a recorded sweep of
[Disaggregated_Inference_Sim](https://github.com/BrendanJamesLynskey/Disaggregated_Inference_Sim)
(23 levers and the baseline × 5 workloads × 3 devices = 350 configurations
of the same 8 GPUs serving Llama-3-70B), and the live what-if runs the
simulator's own JavaScript engine, which reproduces the sweep's recorded
latencies bit for bit.

It is the seventh of a family of companion sites: the
[Transformer Decoder Explainer](https://transformer-decoder-explained.vercel.app/)
shows one forward pass, [LLM Inference Explained](https://llm-inference-explained.vercel.app/)
shows how serving works, [LLM Architectures Explained](https://llm-architectures-explained.vercel.app/)
shows how the models differ, [GPU Kernels Explained](https://gpu-kernels-explained.vercel.app/)
shows how a GPU runs the maths, [Numerics Explained](https://numerics-explained.vercel.app/)
is about the number formats (and accuracy, which this site does not
simulate), [Systolic Arrays Explained](https://systolic-arrays-explained.vercel.app/)
is the silicon underneath, and this site is about the decisions. They share
one design system and link to each other from the header ("Decoder ·
Inference · Architectures · Kernels · Numerics · Silicon · Trade-offs").

**Live:** [inference-tradeoffs-explained.vercel.app](https://inference-tradeoffs-explained.vercel.app/)

![The lever × metric matrix for the coding agent on H100: blue better than the baseline, vermillion worse, outlined cells flipped since chat](docs/screenshots/03-matrix.png)

## Part of

The other companion sites are listed in the
[LLMs](https://github.com/BrendanJamesLynskey/LLMs) hub. The simulator
behind this one is introduced in the
[Inference Simulators](https://brendanjameslynskey.github.io/LLM_Hub_Inference_Simulators/)
slide series.

## The tools

| Page                                                                             | What it does                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Pareto explorer](https://inference-tradeoffs-explained.vercel.app/explore)      | Pick any two metrics, a workload and the devices: every configuration is a point, the front is drawn, and changing the workload or tightening the SLO filter animates the points and the front to their new places. Hover for the configuration; click to re-run it live. |
| [Lever × metric matrix](https://inference-tradeoffs-explained.vercel.app/matrix) | Every lever against every metric: a colour and a glyph for the measured change from the baseline (sign and size), per workload and device. Touring the workloads outlines the cells that flip; every cell links to its lever's chapter.                                   |
| [Live what-if](https://inference-tradeoffs-explained.vercel.app/what-if)         | Start from a sweep configuration, toggle levers, and re-run the vendored engine in a Web Worker on the very requests the sweep used: before/after bars, where the time went, and a timeline animation of the same requests under both configurations.                     |
| [The levers](https://inference-tradeoffs-explained.vercel.app/learn)             | One page per lever family (its rows of the matrix animated across the workloads, its measured effects, its caveats). The chapter text, mechanism animations and papers come in the next part.                                                                             |
| [Method](https://inference-tradeoffs-explained.vercel.app/method)                | How the sweep was run: the cluster, the levers, capacity under SLOs, the workloads and their sources, the devices and illustrative prices, every caveat, and the vendored files' hashes.                                                                                  |

## Animations

Recorded from the site with `pnpm animations` (each frame is a state set
through the animation's scrub bar; WebM versions alongside, in
[`docs/media/`](docs/media/)).

| Pareto explorer, touring the workloads                                     | Matrix, touring the workloads                                           | What-if timeline                                                                                        |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| ![The explorer's points moving between workloads](docs/media/explorer.gif) | ![The matrix's cells changing between workloads](docs/media/matrix.gif) | ![The same requests under two configurations, a clock sweeping simulated time](docs/media/timeline.gif) |

## Where the numbers come from, and how that is checked

- **One number source.** `scripts/vendor-tradeoffs.ts` copies three files
  from the simulator at one commit, byte for byte (`git show`), and records
  their SHA-256 in `src/lib/tradeoffs/vendor/VENDORED.json`:
  `examples/tradeoffs.json` (the sweep), `web/sim_engine.js` (the engine) and
  `examples/results.md`. Prose numbers are looked up from the data at build
  time (`<V of="…">`); a unit test fails if a page spells out a number by hand.
- **Engine parity.** `scripts/tradeoffs_reference.py` runs the simulator's
  Python package at the vendored commit on fourteen sweep configurations
  (every lever family, workload and device) and records a SHA-256 of every
  request's timestamps; the unit tests run the vendored engine on each
  point's recorded configuration and must produce the same digest. It also
  records the workloads exactly as the sweep generated them at each
  workload's reference load (`public/tradeoffs/workloads/`), which the
  what-if replays.
- **The sweep, re-run.** For all 350 points the engine on the recorded
  workload reproduces the point's TTFT, TPOT and ITL p50/p99 exactly, and the
  what-if's toggles produce exactly the point's configuration.
- **Derived views.** The explorer's front equals the sweep's own Pareto flags
  for every pair of metrics and workload; every relative change results.md
  section 26 prints is what the matrix prints, and the levers whose goodput
  changes sign are the same.
- **Animations** are sequences of states computed from the data; a frame is
  a pure function of (state, t), key frames are unit-tested (the timeline's
  against the Python timestamps), and every animation has play/pause, step,
  scrub, speed and reset, keyboard control and an `aria-live` caption. With
  reduced motion nothing plays by itself.
- CI: lint and types, unit tests with coverage thresholds, the data job
  (checks out the simulator at the vendored commit, checks the three files
  and regenerates the fixtures, which must not change), e2e on a production
  build (pages, animations, the tools, axe, light/dark, 1280/390 px) and
  Lighthouse.

## What is illustrative

These are labelled on the site wherever the numbers they affect appear
(a letter beside a matrix cell, the list under each chart, and in full on
the method page):

- **Pipeline parallelism is not overlapped** across steps, so every PP
  configuration loses.
- **The TP all-reduce cost is pessimistic at small batch** (a first-order
  α–β ring model whose per-hop latency dominates; not calibrated against
  nccl-tests).
- **Paged KV shows +0% where memory does not bind** (Llama-3-70B on four GPUs
  per instance never runs out of KV at these loads).
- **Huge percentage gains come from a baseline at its SLO edge** (voice and
  the coding agent especially).
- **Prices per GPU-hour are illustrative**, the speculative **acceptance
  rate α is assumed**, and **B200's BF16 rate and power coefficients are
  illustrative**.
- The roofline efficiencies and power coefficients of the simulator's cost
  model are illustrative, and accuracy is not simulated.

## Develop

```bash
pnpm install
pnpm dev                      # http://localhost:3000
pnpm test                     # unit tests (about a minute: 350 simulations)
pnpm test:e2e                 # e2e on a production build
pnpm smoke [url]              # post-deploy smoke check
```

Updating the data, deploying and checking a deploy: [RUNBOOK.md](RUNBOOK.md).

## Origin

Copied from [systolic-arrays-explained](https://github.com/BrendanJamesLynskey/systolic-arrays-explained)
@ `fe6daab` (layout, animation clock and panel, controls, site switch, CI,
e2e and Lighthouse set-up), with its content removed; the simulator wrapper,
Web Worker and vendoring pattern follow
[llm-inference-explained](https://github.com/BrendanJamesLynskey/llm-inference-explained).

## References

- Zhong et al., DistServe (goodput under SLOs): [arXiv:2401.09670](https://arxiv.org/abs/2401.09670)
- Agrawal et al., Sarathi-Serve (chunked prefill): [arXiv:2403.02310](https://arxiv.org/abs/2403.02310)
- Kwon et al., vLLM / PagedAttention: [arXiv:2309.06180](https://arxiv.org/abs/2309.06180)
- Leviathan et al., speculative decoding: [arXiv:2211.17192](https://arxiv.org/abs/2211.17192)
- Stivers et al., turn-taking in conversation: [doi:10.1073/pnas.0903616106](https://doi.org/10.1073/pnas.0903616106)
- Okabe and Ito, Color Universal Design: [jfly.uni-koeln.de/color](https://jfly.uni-koeln.de/color/)

## Licence

MIT.
