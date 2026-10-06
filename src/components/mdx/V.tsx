/**
 * <V of="effect.chat.h100.chunked-512.goodput_req_s_per_gpu" fmt="signed" />:
 * a number from the vendored sweep, formatted, in running prose. Server
 * Component.
 */
import { formatValue, lookup, type Fmt } from "@/lib/tradeoffs/values";

export function V({ of, fmt = "num" }: { of: string; fmt?: Fmt }): JSX.Element {
  return <span data-v={of}>{formatValue(of, lookup(of), fmt)}</span>;
}
