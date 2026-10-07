/** Chapter 11: power and energy. */
import { PowerWidget } from "@/components/interactive/lazy";
import { PowerEq } from "@/components/mdx/equations";
import { V } from "@/components/mdx/V";
import { inferenceCh, kernelsCh, numericsCh } from "@/lib/site";

import { A, Cite, Deeper, RecordedTable, Sec } from "../ui";
import type { ChapterContent } from "./types";

const m = (variant: string, key: string) => `mech|power|${variant}|${key}`;
const e = (w: string, lever: string, metric: string) =>
  `effect.${w}.h100.${lever}.${metric}`;

function Hero(): JSX.Element {
  return <PowerWidget equation={<PowerEq />} />;
}

function Row(): JSX.Element {
  return (
    <>
      <p className="mt-3 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
        The sweep reports energy per token for every lever (the matrix&apos;s
        J/token column); power caps and clock scaling are recorded separately
        (results.md sections 3 and 6), in the matrix&apos;s colours against the
        uncapped disaggregated cluster.
      </p>
      <RecordedTable
        section={3}
        table={0}
        rows={[
          "Disaggregated 1P1D",
          "... --dvfs",
          "... --dvfs --decode-power-cap 250",
          "... --dvfs --decode-power-cap 200",
          "1P1D --power-cap 400 --dvfs",
          "1P1D --power-cap 300 --dvfs",
        ]}
        cols={["TTFT p99", "TPOT p99", "SLO met", "Avg power", "J / token"]}
        better={["min", "min", "max", "min", "min"]}
        baseline="Disaggregated 1P1D"
        caption={
          <>
            Llama-3-70B, four H100s per instance, four requests per second: DVFS
            and power caps on one pool or both. Power coefficients are
            illustrative.
          </>
        }
      />
      <RecordedTable
        section={6}
        table={0}
        rows={["0.5 req/s", "1 req/s", "2 req/s", "4 req/s", "6 req/s"]}
        cols={["Avg power", "J / output token", "Static share of energy"]}
        better={[null, "min", null]}
        baseline="4 req/s"
        caption={
          <>Energy proportionality of the 1P1D cluster as the load falls.</>
        }
      />
    </>
  );
}

function Body(): JSX.Element {
  return (
    <>
      <Sec id="mechanism" title="Where the joules go">
        <p>
          The simulator&apos;s power model gives each pass a static part (the
          GPU idling) and a dynamic part, its compute and memory energy over its
          time. A compute-bound prefill draws far more than a memory-bound
          decode, so a cap clips the prefills: in the animation a cap of{" "}
          <V of={m("cap300", "cfg.powerCap")} fmt="int" /> W per GPU cuts energy
          per output token from <V of={m("default", "j_per_tok")} fmt="num" /> J
          to <V of={m("cap300", "j_per_tok")} fmt="num" /> J, and stretches TTFT
          p99 from <V of={m("default", "ttft_p99")} fmt="ms" /> to{" "}
          <V of={m("cap300", "ttft_p99")} fmt="ms" />. DVFS lowers the clock on
          memory-bound passes, where compute waits for memory anyway, and saves
          a little energy at no cost in time (
          <V of={m("dvfs", "j_per_tok")} fmt="num" /> J).
        </p>
      </Sec>
      <Sec id="why" title="Why the cheapest joule is the busy one">
        <p>
          Static power is paid whether or not tokens flow, so energy per token
          is lowest when the GPUs are busy: as the load falls the static share
          grows (results.md section 6, from{" "}
          <V of="md|6|0|4 req/s|Static share of energy" /> at four requests per
          second to <V of="md|6|0|0.5 req/s|Static share of energy" /> at one
          every two seconds). That is why the levers that raise capacity also
          cut joules per token in the sweep: FP8 weights and matmuls{" "}
          <V of={e("chat", "w8a8-fp8", "j_per_tok")} fmt="signed" /> on chat,
          prefix caching{" "}
          <V of={e("chat", "prefix-cache", "j_per_tok")} fmt="signed" />
          , while disaggregating at the same eight GPUs costs energy there (
          <V of={e("chat", "disagg-1p1d", "j_per_tok")} fmt="signed" />
          ). Narrower formats also move fewer bytes and do cheaper arithmetic
          per operation; what each format costs in silicon and energy per
          operation is{" "}
          <A href={numericsCh("10-hardware")}>
            Numerics Explained&apos;s hardware chapter
          </A>
          . Energy-aware cluster managers (
          <Cite k="dynamollm" />) reconfigure instances and clocks as the load
          moves.
        </p>
      </Sec>
      <Deeper>
        <li>
          Numerics Explained: <A href={numericsCh("10-hardware")}>hardware</A>,
          energy per operation by format.
        </li>
        <li>
          GPU Kernels Explained:{" "}
          <A href={kernelsCh("02-roofline")}>the roofline</A>: compute-bound
          passes draw the most power.
        </li>
        <li>
          LLM Inference Explained:{" "}
          <A href={inferenceCh("13-live-simulator")}>the live simulator</A>,
          with its power and energy readout.
        </li>
      </Deeper>
    </>
  );
}

export const C11: ChapterContent = {
  Hero,
  Row,
  Body,
  refs: ["dynamollm", "splitwise"],
};
