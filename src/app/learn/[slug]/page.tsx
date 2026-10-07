/**
 * /learn/[slug]: one chapter per lever (brief 20 §5). Each opens with its
 * mechanism, animated from states the simulator recorded; then its row of
 * the matrix (the sweep's measured effects, animated across the
 * workloads), or for the levers the sweep does not vary the simulator's
 * recorded results in the same colours; then why it behaves as measured,
 * with links to the family's Kernels, Numerics and Silicon visuals; the
 * sweep's numbers lever by lever; and the papers. Server Component,
 * statically generated for all thirteen chapters.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { LeverMatrix } from "@/components/interactive/lazy";
import { DeltaEq } from "@/components/mdx/equations";
import { CONTENT } from "@/content/chapters";
import { LeverTables } from "@/content/LeverTables";
import { References } from "@/content/ui";
import { CHAPTERS } from "@/lib/tradeoffs/chapters";
import { FAMILY_LABEL } from "@/lib/tradeoffs/metrics";
import { matrixProps } from "@/lib/tradeoffs/props";

export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return CHAPTERS.filter((c) => CONTENT[c.slug]).map((c) => ({
    slug: c.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const c = CHAPTERS.find((x) => x.slug === params.slug);
  return c ? { title: c.title, description: c.summary } : {};
}

const NAV =
  "focus-ring rounded text-sm text-accent underline underline-offset-2 dark:text-indigo-300";

export default function ChapterPage({
  params,
}: {
  params: { slug: string };
}): JSX.Element {
  const i = CHAPTERS.findIndex((c) => c.slug === params.slug);
  const ch = CHAPTERS[i];
  const content = ch ? CONTENT[ch.slug] : undefined;
  if (!ch || !content) notFound();
  const fam = ch.family;
  const prev = CHAPTERS[i - 1];
  const next = CHAPTERS[i + 1];
  const { Hero, Row, Body, refs } = content;
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent dark:text-indigo-300">
        Chapter {String(i + 1).padStart(2, "0")}
        {fam ? ` · ${FAMILY_LABEL[fam]}` : ""}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{ch.title}</h1>
      <p className="mt-3 max-w-3xl text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
        {ch.summary} Below, the mechanism as the simulator ran it, step by step;
        then what it measured, why it behaves that way, and the papers.
      </p>
      <Hero />
      <section id="matrix-row" className="mt-12 scroll-mt-6">
        <h2 className="text-xl font-semibold tracking-tight">
          {fam ? "Its row of the matrix" : "What the simulator recorded"}
        </h2>
        {fam ? (
          <LeverMatrix
            {...matrixProps(fam)}
            title={`${FAMILY_LABEL[fam]}: the measured effects`}
            testId="lever-matrix"
            equation={<DeltaEq />}
          />
        ) : (
          Row && <Row />
        )}
      </section>
      <Body />
      {fam && <LeverTables fam={fam} />}
      <References keys={refs} />
      <nav
        aria-label="Chapters"
        className="mt-12 flex flex-wrap justify-between gap-4 border-t border-neutral-200 pt-6 dark:border-neutral-800"
      >
        {prev && CONTENT[prev.slug] ? (
          <Link href={`/learn/${prev.slug}`} className={NAV}>
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        <Link href="/learn" className={NAV}>
          All chapters
        </Link>
        {next && CONTENT[next.slug] ? (
          <Link href={`/learn/${next.slug}`} className={NAV}>
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
