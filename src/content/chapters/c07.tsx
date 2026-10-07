/** Chapter 7: encoder-only prefill (CED). */
import { PoolWidget } from "@/components/interactive/lazy";
import { CedEq } from "@/components/mdx/equations";
import { V } from "@/components/mdx/V";
import { architecturesCh, deck, kernelsCh } from "@/lib/site";

import { A, Cite, Deeper, RecordedTable, Sec } from "../ui";
import type { ChapterContent } from "./types";

const m = (variant: string, key: string) => `mech|ced|${variant}|${key}`;

function Hero(): JSX.Element {
  return (
    <PoolWidget
      scenario="ced"
      initial="decoder-only"
      testId="mech-ced"
      title="Prefill through half the model"
      summary={
        <>
          One prefill and one decode instance of four H100s, eight long prompts
          with short outputs, a Llama-3-70B-shaped model: decoder-only, or split
          into a causal encoder and a decoder (CED) so a prompt token runs only
          the encoder. Watch the prefill lane&apos;s passes shrink. The CED
          shape is a proxy (illustrative).
        </>
      }
      equation={<CedEq />}
      stats={["ttft_p99", "tpot_p99", "j_per_tok", "horizon"]}
    />
  );
}

function Row(): JSX.Element {
  return (
    <>
      <p className="mt-3 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
        The sweep does not include CED (the scheduling levers are not modelled
        for it); these are the simulator&apos;s recorded runs (results.md
        sections 16 and 17), in the matrix&apos;s colours against the
        decoder-only model.
      </p>
      <RecordedTable
        section={16}
        table={1}
        rows={["2,048", "8,192", "32,768"]}
        cols={["time", "#4", "#5", "#7", "#8"]}
        headers={[
          "decoder-only",
          "CED, replay on prefill",
          "ratio",
          "CED, encoder only",
          "ratio",
        ]}
        better={[null, null, null, null, null]}
        baseline="2,048"
        caption={
          <>
            One prompt per prefill step, four H100s: the decoder-only time, then
            CED with the replay on the prefill pool, then the encoder alone (the
            replay on the decode pool), with their ratios to decoder-only.
          </>
        }
      />
      <RecordedTable
        section={17}
        table={0}
        rows={["#3", "#4", "#5", "#9", "#10", "#11"]}
        cols={["Model", "Best split", "Best req/s", "vs decoder-only best"]}
        better={[null, null, null, null]}
        baseline="#3"
        caption={
          <>
            Capacity under both SLOs, best split of six instances into prefill
            and decode pools, for two prompt-to-output ratios (results.md
            section 17). Gains above two are queueing, not FLOPs.
          </>
        }
      />
    </>
  );
}

function Body(): JSX.Element {
  return (
    <>
      <Sec id="mechanism" title="Most of the prompt never meets the decoder">
        <p>
          A causal encoder-decoder (<Cite k="ced" />, section 2.2) splits the
          model&apos;s layers in two. A prompt token runs only the encoder and
          the decoder&apos;s key and value projections, which make the
          decoder&apos;s KV cache from the encoder&apos;s last state; only the
          last few prompt tokens are replayed through the decoder. Decode runs
          the whole model as before. For a prompt token that halves the work: it
          touches{" "}
          <V of="md|16|0|CED, prompt token (encoder + decoder K/V projections)|vs a decode token" />{" "}
          of the parameters a decode token does. In the animation TTFT p99 falls
          from <V of={m("decoder-only", "ttft_p99")} fmt="ms" /> to{" "}
          <V of={m("ced-prefill", "ttft_p99")} fmt="ms" /> with the replay on
          the prefill pool, while TPOT is unchanged (
          <V of={m("ced-prefill", "tpot_p99")} fmt="ms" />
          ).
        </p>
        <p>
          The replay can also run on the decode pool, as its first step for a
          new request. Then the prefill pool holds only the encoder, which frees
          memory there and makes its passes slightly shorter, at the cost of a
          heavier first decode step: TTFT p99{" "}
          <V of={m("ced-decode", "ttft_p99")} fmt="ms" /> in the animation.
        </p>
      </Sec>
      <Sec id="why" title="Why capacity can more than double">
        <p>
          A prefill step is compute-bound (the{" "}
          <A href={kernelsCh("02-roofline")}>roofline</A>), so half the FLOPs is
          close to half the time. Under a fixed TTFT SLO the gain in capacity is
          larger than that, because halving the service time of a queue cuts its
          waiting by more than half: at a prompt-to-output ratio of{" "}
          <V of="md|17|0|#4|Prompt : output" /> the best split serves{" "}
          <V of="md|17|0|#4|vs decoder-only best" /> the decoder-only
          model&apos;s best. At some ratios it also moves the best split to
          fewer prefill instances. What it costs is outside this simulator: the
          model must be trained this way, and the paper&apos;s model is a
          mixture of experts with compressed attention, not this dense proxy.
        </p>
      </Sec>
      <Deeper>
        <li>
          LLM Architectures Explained:{" "}
          <A href={architecturesCh("09-encoder-decoder-and-ced")}>
            encoder-decoder and CED
          </A>
          , the architecture itself.
        </li>
        <li>
          Modern Architectures:{" "}
          <A href={deck("Arch_06_Asymmetric_Causal_Encoder_Decoder")}>
            the asymmetric causal encoder-decoder deck
          </A>
          .
        </li>
        <li>
          GPU Kernels Explained:{" "}
          <A href={kernelsCh("02-roofline")}>the roofline</A>: why prefill time
          follows FLOPs.
        </li>
      </Deeper>
    </>
  );
}

export const C07: ChapterContent = {
  Hero,
  Row,
  Body,
  refs: ["ced", "distserve"],
};
