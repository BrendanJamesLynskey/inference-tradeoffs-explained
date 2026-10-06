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
