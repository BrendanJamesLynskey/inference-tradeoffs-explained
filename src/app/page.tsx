import Link from "next/link";

import { ParetoExplorer } from "@/components/interactive/lazy";
import { V } from "@/components/mdx/V";
import { explorerProps } from "@/lib/tradeoffs/props";
import {
  ARCHITECTURES_URL,
  DECODER_URL,
  INFERENCE_URL,
  KERNELS_URL,
  NUMERICS_URL,
  SILICON_URL,
  SIM_REPO,
} from "@/lib/site";

const A =
  "focus-ring rounded underline decoration-accent/40 underline-offset-4 hover:decoration-accent";

const TOOLS = [
  {
    href: "/explore",
    title: "Pareto explorer",
    text: "Pick two metrics and a workload: every configuration as a point, the front drawn, and watch it move as the workload or the SLO changes.",
  },
  {
    href: "/matrix",
    title: "Lever × metric matrix",
    text: "Every lever against every metric, better or worse than the baseline and by how much, for each workload: see which cells flip.",
  },
  {
    href: "/what-if",
    title: "Live what-if",
    text: "Start from a measured configuration, toggle levers and re-run the simulator in your browser on the very requests the sweep used.",
  },
] as const;

/**
 * Landing page: what the site is, the hero (the explorer touring the
 * workloads), the three tools and the family. Server Component; the hero is
 * a code-split client widget fed a slim view of the sweep.
 */
export default function HomePage(): JSX.Element {
  const ex = explorerProps();
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-20">
      <p className="font-mono text-xs uppercase tracking-widest text-accent dark:text-indigo-300">
        Inference Trade-offs Explained
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
        Which lever helps which metric, for which workload
      </h1>
      <div className="mt-8 grid items-start gap-8 md:grid-cols-[1fr_minmax(0,26rem)]">
        <div>
          <p className="max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
            Serving a language model is a stack of decisions: how to batch, how
            to hold the KV cache, whether to split prefill from decode, how to
            split the model across GPUs, which number formats, whether to draft
            tokens speculatively. Each lever helps some measures and costs
            others, and the answer changes with the workload. This site is
            organised around those decisions.
          </p>
          <p className="mt-4 max-w-2xl text-neutral-600 dark:text-neutral-300">
            Nothing here is asserted. Every number comes from a recorded sweep
            of a discrete-event simulator: <V of="meta.levers" fmt="int" />{" "}
            levers and the baseline, <V of="meta.workloads" fmt="int" />{" "}
            workloads and <V of="meta.devices" fmt="int" /> devices,{" "}
            <V of="meta.points" fmt="int" /> configurations of the same{" "}
            <V of="meta.gpus" fmt="int" /> GPUs serving <V of="meta.model" />.
            For example, chunked prefill with a small budget changes goodput per
            GPU on H100 by{" "}
            <V
              of="effect.chat.h100.chunked-512.goodput_req_s_per_gpu"
              fmt="signed"
            />{" "}
            for chat but by{" "}
            <V
              of="effect.coding-agent.h100.chunked-512.goodput_req_s_per_gpu"
              fmt="signed"
            />{" "}
            for a coding agent.
          </p>
          <p className="mt-4 max-w-2xl text-neutral-600 dark:text-neutral-300">
            The simulator is{" "}
            <a href={SIM_REPO} className={A}>
              Disaggregated_Inference_Sim
            </a>
            . Its JavaScript engine runs in your browser for the what-if, and
            reproduces the sweep&apos;s recorded latencies exactly. How the
            sweep was run, and what is illustrative:{" "}
            <Link href="/method" className={A}>
              the method
            </Link>
            .
          </p>
        </div>
        <div className="min-w-0">
          <ParetoExplorer
            points={ex.points}
            workloads={ex.workloads}
            caveats={ex.caveats}
            initial={{ x: "ttft_p99", y: "goodput_req_s_per_gpu" }}
            compact
            testId="hero-home"
          />
        </div>
      </div>
      <nav aria-label="Tools" className="mt-12 grid gap-4 sm:grid-cols-3">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="focus-ring group rounded-lg border border-neutral-200 p-5 hover:border-accent dark:border-neutral-800 dark:hover:border-indigo-400"
          >
            <h2 className="font-semibold">{t.title}</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {t.text}
            </p>
          </Link>
        ))}
      </nav>
      <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">
        One chapter per lever, each opening with its mechanism animated from the
        simulator&apos;s own records, then its row of the matrix and why it
        behaves as measured:{" "}
        <Link href="/learn" className={A}>
          the levers
        </Link>
        . One workload at a time, with the configuration that serves it best:{" "}
        <Link href="/workloads" className={A}>
          the case studies
        </Link>
        .
      </p>
      <p className="mt-12 text-sm text-neutral-600 dark:text-neutral-400">
        Part of a family of companion sites: the{" "}
        <a href={DECODER_URL} className={A}>
          Transformer Decoder Explainer
        </a>{" "}
        (one forward pass),{" "}
        <a href={INFERENCE_URL} className={A}>
          LLM Inference Explained
        </a>{" "}
        (how serving works),{" "}
        <a href={ARCHITECTURES_URL} className={A}>
          LLM Architectures Explained
        </a>{" "}
        (how the models differ),{" "}
        <a href={KERNELS_URL} className={A}>
          GPU Kernels Explained
        </a>{" "}
        (how a GPU runs the maths),{" "}
        <a href={NUMERICS_URL} className={A}>
          Numerics Explained
        </a>{" "}
        (the number formats, and what they do to accuracy) and{" "}
        <a href={SILICON_URL} className={A}>
          Systolic Arrays Explained
        </a>{" "}
        (the silicon underneath). This one is about the decisions. How it was
        built:{" "}
        <Link href="/about" className={A}>
          about
        </Link>
        .
      </p>
    </main>
  );
}
