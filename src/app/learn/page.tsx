/**
 * /learn: the levers, one chapter each, and the workload case studies.
 * Server Component, statically rendered.
 */
import Link from "next/link";

import { CHAPTERS } from "@/lib/tradeoffs/chapters";
import { INFERENCE_URL } from "@/lib/site";

export const metadata = {
  title: "The levers",
  description:
    "One page per serving lever: what it changes, and what the sweep measured it doing to every metric.",
};

export default function LearnIndex(): JSX.Element {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent dark:text-indigo-300">
        /learn
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">The levers</h1>
      <p className="mt-4 text-neutral-600 dark:text-neutral-300">
        One chapter per lever. Each opens with its mechanism, animated from
        states the simulator recorded, then its row of the matrix (or, for the
        levers the sweep does not vary, the simulator&apos;s recorded results in
        the same colours), then why it behaves as measured, with links to the
        family&apos;s Kernels, Numerics and Silicon visuals, and its papers. How
        each mechanism works is explained step by step on{" "}
        <a
          href={INFERENCE_URL}
          className="focus-ring rounded text-accent underline underline-offset-2 dark:text-indigo-300"
        >
          LLM Inference Explained
        </a>
        ; the chapters here are about the trade-off. For one workload at a time,
        see the{" "}
        <Link
          href="/workloads"
          className="focus-ring rounded text-accent underline underline-offset-2 dark:text-indigo-300"
        >
          case studies
        </Link>
        .
      </p>
      <ol className="mt-10 divide-y divide-neutral-200 dark:divide-neutral-800">
        {CHAPTERS.map((c, i) => (
          <li key={c.slug} className="py-5">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                {String(i + 1).padStart(2, "0")}
              </span>
              <Link
                href={`/learn/${c.slug}`}
                className="focus-ring rounded text-lg font-medium text-neutral-900 hover:text-accent dark:text-neutral-100"
              >
                {c.title}
              </Link>
            </div>
            <p className="mt-1 pl-9 text-sm text-neutral-600 dark:text-neutral-400">
              {c.summary}
            </p>
          </li>
        ))}
      </ol>
    </main>
  );
}
