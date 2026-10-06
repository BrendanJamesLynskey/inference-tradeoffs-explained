/**
 * /about: what the site is, where its numbers come from and how that is
 * checked, how the animations are driven, and the family. Server
 * Component, static.
 */
import Link from "next/link";

import { V } from "@/components/mdx/V";
import { VENDORED } from "@/lib/tradeoffs/data";
import {
  ARCHITECTURES_URL,
  DECODER_URL,
  GITHUB_URL,
  INFERENCE_URL,
  INFSIM_HUB,
  KERNELS_URL,
  NUMERICS_URL,
  SILICON_URL,
  SIM_REPO,
  repoFile,
} from "@/lib/site";

export const metadata = {
  title: "About",
  description:
    "How Inference Trade-offs Explained is built: a vendored simulator sweep as the single number source, the simulator's own engine running live, and the checks that tie them together.",
};

const A =
  "focus-ring rounded text-accent underline underline-offset-2 dark:text-indigo-300";

export default function AboutPage(): JSX.Element {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent dark:text-indigo-300">
        /about
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        About this site
      </h1>
      <div className="mdx-content mt-6">
        <p>
          Inference Trade-offs Explained is about the decisions in serving a
          language model: for each lever, what it improves, what it costs, and
          under which workload. It is the seventh of a family of companion
          sites, with the{" "}
          <a href={DECODER_URL} className={A}>
            Transformer Decoder Explainer
          </a>
          ,{" "}
          <a href={INFERENCE_URL} className={A}>
            LLM Inference Explained
          </a>
          ,{" "}
          <a href={ARCHITECTURES_URL} className={A}>
            LLM Architectures Explained
          </a>
          ,{" "}
          <a href={KERNELS_URL} className={A}>
            GPU Kernels Explained
          </a>
          ,{" "}
          <a href={NUMERICS_URL} className={A}>
            Numerics Explained
          </a>{" "}
          and{" "}
          <a href={SILICON_URL} className={A}>
            Systolic Arrays Explained
          </a>
          . The simulator behind it is introduced in the{" "}
          <a href={INFSIM_HUB} className={A}>
            Inference Simulators
          </a>{" "}
          slide series.
        </p>

        <h2>One number source</h2>
        <p>
          Every number is read from the trade-off sweep of{" "}
          <a href={SIM_REPO} className={A}>
            Disaggregated_Inference_Sim
          </a>
          , vendored byte for byte with the simulator&apos;s JavaScript engine
          and its results.md at commit{" "}
          <code>{VENDORED.commit.slice(0, 7)}</code> (
          <a href={repoFile("scripts/vendor-tradeoffs.ts")} className={A}>
            scripts/vendor-tradeoffs.ts
          </a>{" "}
          records each file&apos;s SHA-256). Prose numbers are looked up from
          the data when the page is built, and a unit test fails if a page
          spells out a number by hand. The{" "}
          <Link href="/method" className={A}>
            method
          </Link>{" "}
          page says how the sweep was run and lists every caveat.
        </p>

        <h2>The checks</h2>
        <ul>
          <li>
            <strong>Engine parity.</strong>{" "}
            <a href={repoFile("scripts/tradeoffs_reference.py")} className={A}>
              scripts/tradeoffs_reference.py
            </a>{" "}
            runs the simulator&apos;s Python package at the vendored commit on
            fourteen sweep configurations (every lever family, workload and
            device) and records a SHA-256 of every request&apos;s timestamps;
            the unit tests run the vendored engine on each point&apos;s recorded
            configuration and must produce the same digest.
          </li>
          <li>
            <strong>The sweep, re-run live.</strong> For every one of the{" "}
            <V of="meta.points" fmt="int" /> points, the vendored engine on the
            recorded workload reproduces the point&apos;s TTFT, TPOT and ITL
            percentiles exactly, and the what-if&apos;s toggles produce exactly
            the point&apos;s configuration.
          </li>
          <li>
            <strong>Derived views.</strong> The explorer&apos;s front equals the
            sweep&apos;s own Pareto flags for every pair of metrics and
            workload; the matrix&apos;s sign changes equal the table in the
            simulator&apos;s results.md.
          </li>
          <li>
            <strong>Animations.</strong> Each is a sequence of states computed
            from the data; a frame is a pure function of (state, t), and key
            frames are unit-tested. Every animation has play and pause, step, a
            scrub bar, speed and reset; with reduced motion nothing plays by
            itself.
          </li>
        </ul>

        <h2>Built with</h2>
        <p>
          Next.js and React, plain SVG and HTML for the charts, the
          simulator&apos;s engine in a Web Worker. Copied from the newest site
          of the family (Systolic Arrays Explained) and adapted. The source is
          on{" "}
          <a href={GITHUB_URL} className={A}>
            GitHub
          </a>
          .
        </p>
      </div>
    </main>
  );
}
