/**
 * The equations shown beside the widgets (visual standard §1: the maths next
 * to the picture). Server Components (KaTeX on the server).
 */
import { NEUTRAL } from "@/lib/tradeoffs/effects";

import { Eq } from "./Eq";

/** What "on the front" means. */
export function FrontEq(): JSX.Element {
  return (
    <Eq
      label="A configuration p beats q when it is at least as good on every metric and strictly better on one; the front is every configuration nothing beats."
      tex={String.raw`p \succ q \iff \forall k:\ c_k(p) \le c_k(q)\ \wedge\ \exists k:\ c_k(p) < c_k(q), \qquad \text{front} = \{\, p : \nexists\, q \succ p \,\}`}
    />
  );
}

/** What a matrix cell is. */
export function DeltaEq(): JSX.Element {
  const band = String(Math.round(100 * NEUTRAL));
  return (
    <Eq
      label="Each cell is the lever's metric minus the baseline's, over the baseline's, on the same workload and device."
      tex={String.raw`\Delta = \frac{m_{\text{lever}} - m_{\text{baseline}}}{m_{\text{baseline}}}, \qquad |\Delta| \le ${band}\% \Rightarrow \approx`}
    />
  );
}

/** How a request's time splits along the timeline. */
export function TimelineEq(): JSX.Element {
  return (
    <Eq
      label="End-to-end time is queueing plus prefill (together the time to first token), plus the KV hand-off, plus decode."
      tex={String.raw`t_{\text{finish}} - t_{\text{arrive}} = \underbrace{t_{\text{queue}} + t_{\text{prefill}}}_{\text{TTFT}} + t_{\text{hand-off}} + t_{\text{decode}}`}
    />
  );
}

/** Chapter 1: what one step may hold, and what a decode row waits. */
export function BatchEq(): JSX.Element {
  return (
    <Eq
      label="A step holds b decode rows plus prompt chunks c_i, within the token budget tau; a decode row's inter-token latency is the time of every step since its last token."
      tex={String.raw`\htmlClass{hl-a}{b} + \htmlClass{hl-p}{\textstyle\sum_i c_i} \le \htmlClass{hl-u}{\tau}, \qquad \text{ITL}_{\text{row}} = \sum_{\text{steps since its last token}} t_{\text{step}}\big(\htmlClass{hl-a}{b}, \htmlClass{hl-p}{\textstyle\sum_i c_i}\big)`}
    />
  );
}

/** Chapter 2: reserved against paged KV. */
export function KvEq(): JSX.Element {
  return (
    <Eq
      label="Reserved: each request holds prompt plus output tokens from admission. Paged: it holds the blocks its tokens so far fill. Admission and growth must fit the capacity C."
      tex={String.raw`\text{reserved: } \htmlClass{hl-w}{p + o} \qquad \text{paged: } \htmlClass{hl-p}{B\,\Big\lceil \tfrac{p + t}{B} \Big\rceil} \qquad \sum_{\text{requests}} \le \htmlClass{hl-c}{C}`}
    />
  );
}

/** Chapter 3: what a cache hit saves. */
export function PrefixEq(): JSX.Element {
  return (
    <Eq
      label="A prompt of p tokens with h of them cached computes only p minus h; the hit rate is cached prompt tokens over prompt tokens."
      tex={String.raw`\text{prefill work} \propto p - \htmlClass{hl-acc}{h}, \qquad \text{hit rate} = \frac{\sum \htmlClass{hl-acc}{h}}{\sum p}`}
    />
  );
}

/** Chapter 6: the hand-off time. */
export function HandoffEq(): JSX.Element {
  return (
    <Eq
      label="A hand-off of S bytes compressed by ratio r over a link of bandwidth B and latency l takes l plus S over r B, plus any wait for the link."
      tex={String.raw`t_{\text{hand-off}} = t_{\text{wait}} + \htmlClass{hl-t}{\ell} + \frac{\htmlClass{hl-b}{S} / \htmlClass{hl-c}{r}}{\htmlClass{hl-bw}{B}}`}
    />
  );
}

/** Chapter 7: what a CED prompt token costs. */
export function CedEq(): JSX.Element {
  return (
    <Eq
      label="A decoder-only prompt token runs every layer; a CED prompt token runs the encoder layers and the decoder's key and value projections only, except the last w tokens, which are replayed through the decoder."
      tex={String.raw`\text{FLOPs}_{\text{prompt}} \approx 2\,p\,\big(\htmlClass{hl-p}{N_{\text{enc}}} + N_{KV}\big) + 2\,\htmlClass{hl-w}{w}\,N_{\text{dec}} \quad \text{vs} \quad 2\,p\,N`}
    />
  );
}

/** Chapter 8: the ring all-reduce. */
export function RingEq(): JSX.Element {
  return (
    <Eq
      label="A ring all-reduce of S bytes over n GPUs takes 2 times n minus 1 steps, each moving S over n bytes at bandwidth B plus the link latency."
      tex={String.raw`t_{\text{AR}} = \htmlClass{hl-n}{2(n-1)} \left( \frac{\htmlClass{hl-b}{S}}{n\,\htmlClass{hl-bw}{B}} + \htmlClass{hl-t}{\ell} \right)`}
    />
  );
}

/** Chapter 8: the pipeline bubble. */
export function GpipeEq(): JSX.Element {
  return (
    <Eq
      label="With p stages and m micro-batches a step takes m plus p minus 1 slots, of which p minus 1 per stage are idle: the bubble."
      tex={String.raw`\text{slots} = \htmlClass{hl-a}{m} + \htmlClass{hl-p}{p} - 1, \qquad \text{bubble} = \frac{\htmlClass{hl-p}{p} - 1}{\htmlClass{hl-a}{m} + \htmlClass{hl-p}{p} - 1}`}
    />
  );
}

/** Chapter 9: a memory-bound decode step. */
export function BytesEq(): JSX.Element {
  return (
    <Eq
      label="A memory-bound decode step takes the bytes it reads, weights times bytes per weight plus the KV cache, over the memory bandwidth."
      tex={String.raw`t_{\text{decode}} \approx \frac{\htmlClass{hl-w}{N\,b_w} + \htmlClass{hl-c}{\textstyle\sum \text{ctx}\; b_{kv}}}{\htmlClass{hl-bw}{B_{\text{HBM}}}}`}
    />
  );
}

/** Chapter 10: Leviathan et al.'s equation (1). */
export function SpecEq(): JSX.Element {
  return (
    <Eq
      label="With acceptance rate alpha and gamma drafts, a verify pass yields one minus alpha to the gamma plus one, over one minus alpha, tokens on average."
      tex={String.raw`\mathbb{E}[\text{tokens per pass}] = \frac{1 - \htmlClass{hl-a}{\alpha}^{\htmlClass{hl-n}{\gamma} + 1}}{1 - \htmlClass{hl-a}{\alpha}}`}
    />
  );
}

/** Chapter 11: power per step. */
export function PowerEq(): JSX.Element {
  return (
    <Eq
      label="A step's power is idle power plus its compute and memory energy over its time, held under the cap."
      tex={String.raw`P = \htmlClass{hl-t}{P_{\text{idle}}} + \frac{\htmlClass{hl-c}{E_{\text{compute}}} + \htmlClass{hl-w}{E_{\text{memory}}}}{t_{\text{step}}} \;\le\; \htmlClass{hl-u}{P_{\text{cap}}}`}
    />
  );
}

/** Chapter 12: cost per million output tokens. */
export function CostEq(): JSX.Element {
  return (
    <Eq
      label="Dollars per million output tokens are a million times the price per GPU-hour over 3,600 times the output tokens per second per GPU, at capacity."
      tex={String.raw`\$/\text{M tok} = \frac{10^6 \cdot \htmlClass{hl-c}{\$_{\text{GPU-h}}}}{3600 \cdot \htmlClass{hl-t}{\text{tok/s per GPU}}}`}
    />
  );
}
