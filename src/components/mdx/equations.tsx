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
