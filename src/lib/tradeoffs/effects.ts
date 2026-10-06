/**
 * The knob × metric matrix: each cell is one lever's measured relative
 * change of one metric from the baseline on the same workload and device
 * (the sweep's `effects`), drawn as a colour plus a glyph, never colour
 * alone:
 *
 * - better / worse / about the same, judged by the metric's direction (more
 *   goodput is better, more latency is worse); "about the same" is within
 *   ±2%, the threshold results.md section 26 uses for its sign-change table;
 * - the size as one, two or three arrows (2–10%, 10–50%, 50% and over);
 * - no value (the configuration had no capacity at the SLO, so it has no
 *   cost or energy per token) as a hatched cell and a dash.
 */
import { METRICS, type MetricKey, type WorkloadKey } from "./metrics";

/** Within this relative change a cell counts as "about the same". */
export const NEUTRAL = 0.02;

/** Where one arrow becomes two, and two three. */
export const SIZE_EDGES = [0.1, 0.5] as const;

/** "±2%", "2–10%" …: the bands as the legends print them. */
export const pctOf = (x: number): string => `${Math.round(100 * x)}%`;

export type Verdict = "better" | "worse" | "same" | "none";

export type Cell = {
  rel: number | null;
  verdict: Verdict;
  /** 0 (same or none), 1, 2 or 3. */
  size: 0 | 1 | 2 | 3;
  /** ▲ / ▼ repeated `size` times (the metric's own direction), ≈ or –. */
  glyph: string;
};

export function cell(rel: number | null | undefined, metric: MetricKey): Cell {
  if (rel === null || rel === undefined || Number.isNaN(rel))
    return { rel: null, verdict: "none", size: 0, glyph: "–" };
  const a = Math.abs(rel);
  if (a <= NEUTRAL) return { rel, verdict: "same", size: 0, glyph: "≈" };
  const size: 1 | 2 | 3 = a < SIZE_EDGES[0] ? 1 : a < SIZE_EDGES[1] ? 2 : 3;
  const up = rel > 0;
  const good = METRICS[metric].better === "max" ? up : !up;
  return {
    rel,
    verdict: good ? "better" : "worse",
    size,
    glyph: (up ? "▲" : "▼").repeat(size),
  };
}

/** The sign of a change as results.md's sign-change table writes it. */
export function sign(rel: number | null | undefined): "+" | "-" | "0" {
  if (rel === null || rel === undefined || Math.abs(rel) <= NEUTRAL) return "0";
  return rel > 0 ? "+" : "-";
}

/**
 * Do two cells disagree on direction? (A strict flip: better in one
 * workload, worse in the other; "about the same" never flips.)
 */
export function flipped(a: Cell, b: Cell): boolean {
  return (
    (a.verdict === "better" && b.verdict === "worse") ||
    (a.verdict === "worse" && b.verdict === "better")
  );
}

type EffectsFor = Record<string, Record<string, number | null>>;

/**
 * The levers whose effect on `metric` changes sign across the workloads
 * (results.md section 26 lists them for goodput per GPU on H100): each with
 * its sign in every workload, in the given order.
 */
export function signChanges(
  effects: Record<WorkloadKey, EffectsFor>,
  workloads: readonly WorkloadKey[],
  levers: readonly string[],
  metric: MetricKey,
): { lever: string; signs: ("+" | "-" | "0")[] }[] {
  const out: { lever: string; signs: ("+" | "-" | "0")[] }[] = [];
  for (const lever of levers) {
    const signs = workloads.map((w) => sign(effects[w]?.[lever]?.[metric]));
    if (signs.includes("+") && signs.includes("-")) out.push({ lever, signs });
  }
  return out;
}
