"use client";

/**
 * Code-split client widgets: each loads its own chunk after the page shell,
 * so pages stay light (the pattern of the companion sites' lazy.tsx). Each
 * widget takes its data as props from the server page.
 */
import dynamic from "next/dynamic";

function Placeholder({ what }: { what: string }): JSX.Element {
  return (
    <p
      data-pending-widget
      className="my-8 min-h-96 text-sm text-neutral-600 dark:text-neutral-400"
    >
      Loading the {what}…
    </p>
  );
}

const loading = (what: string) =>
  function Loading(): JSX.Element {
    return <Placeholder what={what} />;
  };

export const ParetoExplorer = dynamic(() => import("./ParetoExplorer"), {
  ssr: false,
  loading: loading("Pareto explorer"),
});
export const LeverMatrix = dynamic(() => import("./LeverMatrix"), {
  ssr: false,
  loading: loading("matrix"),
});
export const WhatIf = dynamic(() => import("./WhatIf"), {
  ssr: false,
  loading: loading("live simulator"),
});

// the chapters' mechanism animations (src/components/mech/)
export const BatchingWidget = dynamic(() => import("../mech/BatchingWidget"), {
  ssr: false,
  loading: loading("batching animation"),
});
export const KvWidget = dynamic(() => import("../mech/KvWidget"), {
  ssr: false,
  loading: loading("KV memory animation"),
});
export const PrefixWidget = dynamic(() => import("../mech/PrefixWidget"), {
  ssr: false,
  loading: loading("prefix-cache animation"),
});
export const PoolWidget = dynamic(() => import("../mech/PoolWidget"), {
  ssr: false,
  loading: loading("pool animation"),
});
export const DraftWidget = dynamic(() => import("../mech/DraftWidget"), {
  ssr: false,
  loading: loading("speculative decoding animation"),
});
export const PowerWidget = dynamic(() => import("../mech/PowerWidget"), {
  ssr: false,
  loading: loading("power animation"),
});
export const RingWidget = dynamic(() => import("../mech/RingWidget"), {
  ssr: false,
  loading: loading("all-reduce animation"),
});
export const GpipeWidget = dynamic(() => import("../mech/GpipeWidget"), {
  ssr: false,
  loading: loading("pipeline animation"),
});
export const BytesWidget = dynamic(() => import("../mech/BytesWidget"), {
  ssr: false,
  loading: loading("bytes-per-step animation"),
});
export const CostWidget = dynamic(() => import("../mech/CostWidget"), {
  ssr: false,
  loading: loading("hardware animation"),
});
export const CombineWidget = dynamic(() => import("../mech/CombineWidget"), {
  ssr: false,
  loading: loading("combining animation"),
});
