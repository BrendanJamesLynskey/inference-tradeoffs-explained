/**
 * Pareto fronts, the way the sweep computes its flags
 * (examples/tradeoffs.py `pareto`): every metric is turned into "smaller is
 * better" (a maximised metric is negated), a missing value is the worst
 * possible, a point is on the front when no other point is at least as good
 * on every metric and strictly better on one, and a point with a missing
 * value is never on it. With every device shown and no SLO filter, the
 * explorer's front is exactly the sweep's `pareto["<x>|<y>"]` flag
 * (tests/unit/pareto.test.ts).
 */
import { METRICS, type MetricKey } from "./metrics";

export type Valued = { m: Partial<Record<MetricKey, number | null>> };

/** The value with "smaller is better", missing → +∞. */
export function cost(p: Valued, k: MetricKey): number {
  const v = p.m[k];
  if (v === null || v === undefined || Number.isNaN(v)) return Infinity;
  return METRICS[k].better === "min" ? v : -v;
}

/** The indices of the non-dominated points over the given metrics. */
export function frontIndices(
  points: readonly Valued[],
  keys: readonly MetricKey[],
): number[] {
  const vecs = points.map((p) => keys.map((k) => cost(p, k)));
  const out: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const vi = vecs[i]!;
    if (!vi.every((x) => Number.isFinite(x))) continue;
    let dominated = false;
    for (let j = 0; j < points.length && !dominated; j++) {
      if (j === i) continue;
      const vj = vecs[j]!;
      let allLe = true;
      let anyLt = false;
      for (let d = 0; d < vi.length; d++) {
        if (vj[d]! > vi[d]!) {
          allLe = false;
          break;
        }
        if (vj[d]! < vi[d]!) anyLt = true;
      }
      dominated = allLe && anyLt;
    }
    if (!dominated) out.push(i);
  }
  return out;
}

/** The sweep's flag name for a pair (its objectives' order). */
export function pairKey(
  a: MetricKey,
  b: MetricKey,
  order: readonly MetricKey[],
): string {
  return order.indexOf(a) <= order.indexOf(b) ? `${a}|${b}` : `${b}|${a}`;
}
