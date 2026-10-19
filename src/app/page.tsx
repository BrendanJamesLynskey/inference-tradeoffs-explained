import type { Route } from "next";
import Link from "next/link";

import { CheckedStrip, StartButton } from "@/components/ui/Landing";
import { ParetoExplorer } from "@/components/interactive/lazy";
import { V } from "@/components/mdx/V";
import { explorerProps } from "@/lib/tradeoffs/props";
import { SIM_REPO } from "@/lib/site";
import { CHAPTERS } from "@/lib/tradeoffs/chapters";

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
      <div className="mt-6 grid items-start gap-8 md:grid-cols-[1fr_minmax(0,26rem)]">
        <div>
          <p className="max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
            An interactive map of the serving levers (batching, KV memory,
            disaggregation, parallelism, quantisation, speculation) and what
            each one does to each metric.
          </p>
          <div className="mt-6">
            <StartButton href={`/learn/${CHAPTERS[0]!.slug}` as Route} />
          </div>
        </div>
        <div data-hero-figure className="min-w-0">
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
      <CheckedStrip href="/about#checks">
        For every one of the <V of="meta.points" fmt="int" /> sweep points, the
        simulator&apos;s JavaScript engine (the one the what-if runs in your
        browser) reproduces the recorded TTFT, TPOT and ITL percentiles of the
        Python run exactly.
      </CheckedStrip>
      <section aria-labelledby="learn-heading" className="mt-12">
        <h2 id="learn-heading" className="text-xl font-semibold tracking-tight">
          What you&apos;ll learn
        </h2>
        <p className="mt-4 max-w-2xl text-neutral-600 dark:text-neutral-300">
          Serving a language model is a stack of decisions: how to batch, how to
          hold the KV cache, whether to split prefill from decode, how to split
          the model across GPUs, which number formats, whether to draft tokens
          speculatively. Each lever helps some measures and costs others, and
          the answer changes with the workload. This site is organised around
          those decisions.
        </p>
        <p className="mt-4 max-w-2xl text-neutral-600 dark:text-neutral-300">
          Nothing here is asserted. Every number comes from a recorded sweep of
          a discrete-event simulator: <V of="meta.levers" fmt="int" /> levers
          and the baseline, <V of="meta.workloads" fmt="int" /> workloads and{" "}
          <V of="meta.devices" fmt="int" /> devices,{" "}
          <V of="meta.points" fmt="int" /> configurations of the same{" "}
          <V of="meta.gpus" fmt="int" /> GPUs serving <V of="meta.model" />. For
          example, chunked prefill with a small budget changes goodput per GPU
          on H100 by{" "}
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
          reproduces the sweep&apos;s recorded latencies exactly. How the sweep
          was run, and what is illustrative:{" "}
          <Link href="/method" className={A}>
            the method
          </Link>
          .
        </p>
      </section>
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
      <p
        data-track-start
        className="mt-12 text-sm text-neutral-600 dark:text-neutral-400"
      >
        New to the Inference track?{" "}
        <a
          href="https://llm-inference-explained.vercel.app/inference"
          className="focus-ring rounded underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
        >
          Start here
        </a>
        : the four sites in reading order, what you need first, and a glossary
        of the terms they define.
      </p>
      <p className="mt-12 text-sm text-neutral-600 dark:text-neutral-400">
        Part of a family of sixteen companion sites in four tracks, all in the
        site menu above: Foundations (
        <a
          href="https://transformer-decoder-explained.vercel.app"
          className={A}
        >
          Decoder
        </a>
        ,{" "}
        <a
          href="https://transformer-training-explained.vercel.app"
          className={A}
        >
          Training
        </a>
        ), Hardware (
        <a href="https://gpu-kernels-explained.vercel.app" className={A}>
          Kernels
        </a>
        ,{" "}
        <a href="https://systolic-arrays-explained.vercel.app" className={A}>
          Systolic
        </a>
        ,{" "}
        <a href="https://ai-accelerators-explained.vercel.app" className={A}>
          Accelerators
        </a>
        ,{" "}
        <a href="https://ai-racks-explained.vercel.app" className={A}>
          Racks
        </a>
        ), Inference (
        <a href="https://llm-inference-explained.vercel.app" className={A}>
          Serving
        </a>
        ,{" "}
        <a href="https://llm-architectures-explained.vercel.app" className={A}>
          Architectures
        </a>
        ,{" "}
        <a href="https://numerics-explained.vercel.app" className={A}>
          Numerics
        </a>
        , <strong className="font-medium">Trade-offs</strong>) and Agents (
        <a href="https://agent-harnesses-explained.vercel.app" className={A}>
          Harnesses
        </a>
        ,{" "}
        <a href="https://agent-protocols-explained.vercel.app" className={A}>
          Protocols
        </a>
        ,{" "}
        <a href="https://agent-context-explained.vercel.app" className={A}>
          Context
        </a>
        ,{" "}
        <a
          href="https://agent-orchestration-explained.vercel.app"
          className={A}
        >
          Orchestration
        </a>
        ,{" "}
        <a href="https://agent-evals-explained.vercel.app" className={A}>
          Evals
        </a>
        ,{" "}
        <a href="https://agent-security-explained.vercel.app" className={A}>
          Security
        </a>
        ). This one is about the decisions. How it was built:{" "}
        <Link href="/about" className={A}>
          about
        </Link>
        .
      </p>
    </main>
  );
}
