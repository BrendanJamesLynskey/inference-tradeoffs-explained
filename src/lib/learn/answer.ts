/**
 * A self-check's numeric answer (brief 44), resolved as the pages print
 * their numbers: `of` is a path into the vendored sweep or the recorded
 * results (as `<V of>`), printed by this site's own `formatValue`; the
 * reader answers in the printed unit. A results.md cell is already text
 * ("61.5%", "2.16x"): its number is read from it. Used by the self-check
 * adapter (src/components/mdx/Check.tsx) and by the tests.
 */
import { formatValue, lookup, type Fmt } from "@/lib/tradeoffs/values";

export function numericAnswer(
  of: string,
  fmt: Fmt = "num",
): { raw: number | string; value: number; display: string; unit: string } {
  const raw = lookup(of);
  const text = formatValue(of, raw, fmt).replace(/−/g, "-");
  const m = /^([+-]?[\d,]*\.?\d+)(%|x|\s.+)?$/.exec(text);
  if (!m) throw new Error(`cannot read a number in "${text}" (${of})`);
  const display = m[1]!;
  const unit = m[2] === "x" ? "×" : (m[2] ?? "");
  return { raw, value: Number(display.replace(/[,+]/g, "")), display, unit };
}
