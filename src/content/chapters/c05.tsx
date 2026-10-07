/** Chapter 5: heterogeneous pools and the optical prefill pool. */
import { PoolWidget } from "@/components/interactive/lazy";
import { TimelineEq } from "@/components/mdx/equations";
import { V } from "@/components/mdx/V";
import { kernelsCh, siliconCh } from "@/lib/site";

import { A, Cite, Deeper, RecordedTable, Sec } from "../ui";
import type { ChapterContent } from "./types";

const m = (variant: string, key: string) => `mech|hetero|${variant}|${key}`;
const FOPT =
  "https://brendanjameslynskey.github.io/LLM_Hub_Fourier_Optics_Inference/";

function Hero(): JSX.Element {
  return (
    <PoolWidget
      scenario="hetero"
      initial="h100-h100"
      testId="mech-hetero"
      title="A different device in each pool"
      summary={
        <>
          One prefill and one decode instance (Llama-3-8B, one device each),
          fourteen requests at eight per second. Swap the device of either pool,
          or serve an FFT-mixing model whose prefill runs on a hypothetical
          optical transform engine (illustrative coefficients).
        </>
      }
      equation={<TimelineEq />}
      stats={["ttft_p99", "tpot_p99", "j_per_tok", "horizon"]}
    />
  );
}

function Row(): JSX.Element {
  return (
    <>
      <p className="mt-3 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
        The sweep does not vary pool hardware; these are the simulator&apos;s
        recorded runs (results.md sections 10 and 11), in the matrix&apos;s
        colours against the all-H100 pools.
      </p>
      <RecordedTable
        section={10}
        table={0}
        rows={[
          "H100 prefill + H100 decode (--device h100)",
          "H100 prefill + A100 decode",
          "A100 prefill + H100 decode",
          "2x A100 prefill + H100 decode",
        ]}
        cols={[
          "TTFT p99",
          "TPOT p99",
          "Goodput (req/s)",
          "J / token",
          "tok/s per $1000",
        ]}
        better={["min", "min", "max", "min", "max"]}
        baseline="H100 prefill + H100 decode (--device h100)"
        caption={
          <>
            Heterogeneous pools, Llama-3-8B shape, eight requests per second.
            Silicon dollars are illustrative (die area and yield, not prices).
          </>
        }
      />
      <RecordedTable
        section={11}
        table={5}
        rows={[
          "1P1D H100",
          "1P1D H100, GPU FFT at 1/16",
          "optical-fft prefill (defaults) + H100 decode",
          "optical-fft prefill (optimistic) + H100 decode",
        ]}
        cols={["TTFT p99", "Goodput (req/s)", "J / token", "tok/s per $1000"]}
        better={["min", "max", "min", "max"]}
        baseline="1P1D H100"
        caption={
          <>
            An FFT-mixing model (Hyena-2 with circulant mixing, last-token head:
            the most transform-heavy variant) with a hypothetical optical
            prefill pool. Every optical coefficient is illustrative.
          </>
        }
      />
    </>
  );
}

function Body(): JSX.Element {
  return (
    <>
      <Sec id="mechanism" title="Put each phase on the device that suits it">
        <p>
          Once prefill and decode run on separate pools, they need not run on
          the same hardware (<Cite k="splitwise" />
          ). Decode is memory-bound, so an older or cheaper part with good
          bandwidth may do; prefill is compute-bound, so it wants FLOPs. In the
          animation an A100 decode pool behind an H100 prefill pool raises TPOT
          p99 from <V of={m("h100-h100", "tpot_p99")} fmt="ms" /> to{" "}
          <V of={m("h100-a100", "tpot_p99")} fmt="ms" />, still inside the TPOT
          SLO, while an A100 prefill pool cannot keep up with the prompts: TTFT
          p99 goes from <V of={m("h100-h100", "ttft_p99")} fmt="ms" /> to{" "}
          <V of={m("a100-h100", "ttft_p99")} fmt="ms" />.
        </p>
        <p>
          The optical prefill pool asks the same question of a device that does
          not exist: a Fourier-optical transform engine co-packaged with an
          H100-class part, which could only help models whose mixing is an FFT
          (not attention). With optimistic coefficients its TTFT p99 is{" "}
          <V of={m("circ-optical", "ttft_p99")} fmt="ms" />, against{" "}
          <V of={m("circ-gpu", "ttft_p99")} fmt="ms" /> on an H100 that runs the
          FFT itself; with the default coefficients prompts queue without bound
          (<V of={m("circ-optical-default", "ttft_p99")} fmt="ms" />
          ).
        </p>
      </Sec>
      <Sec id="why" title="Why the optical pool mostly loses">
        <p>
          A transform engine speeds up only the FFT part of a prefill, and in a
          GPU that part is already fast unless the GPU runs FFTs far below its
          matmul rate. Each optical pass also pays for conversions between the
          analogue and digital worlds and for rewriting the optical mask, and a
          static power for lasers that the GPU does not. The recorded
          break-even: against a GPU running FFTs at full rate the optical pool
          never matches its TTFT at any ENOB or mask rate tried (results.md
          section 13:{" "}
          <V of="md|13|0|GPU FFT at 1x|Lowest ENOB with TTFT p99 <= GPU" />
          ), and it matches its energy only below{" "}
          <V of="md|13|0|GPU FFT at 1x|Static power at equal J/token" /> of
          static power. The Fourier Optics for Inference series (
          <A href={FOPT}>its hub</A>) works through why, and reaches the same
          mostly negative verdict.
        </p>
        <p>
          Hardware choice inside one pool is{" "}
          <A href="/learn/12-hardware-and-cost">chapter 12</A>; where the FLOPs
          and bytes of each device come from, the{" "}
          <A href={kernelsCh("02-roofline")}>roofline</A> and{" "}
          <A href={siliconCh("08-other-ways")}>
            other ways to build a matrix engine
          </A>
          .
        </p>
      </Sec>
      <Deeper>
        <li>
          Fourier Optics for Inference: <A href={FOPT}>the series hub</A>, the
          optical prefill pool and its break-even in full.
        </li>
        <li>
          GPU Kernels Explained:{" "}
          <A href={kernelsCh("02-roofline")}>the roofline</A>.
        </li>
        <li>
          Systolic Arrays Explained:{" "}
          <A href={siliconCh("08-other-ways")}>other ways</A>, other matrix
          hardware.
        </li>
      </Deeper>
    </>
  );
}

export const C05: ChapterContent = {
  Hero,
  Row,
  Body,
  refs: ["splitwise", "distserve"],
};
