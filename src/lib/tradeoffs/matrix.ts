/**
 * The knob × metric matrix as pure functions (unit-tested): the cells for a
 * workload and device, which cells flip (better ↔ worse) when the workload
 * changes, the colour of a cell a fraction of the way through that change,
 * and the caption. A frame is a function of (from, to, t) only.
 */
import { caveatsFor, type CaveatKey } from "./caveats";
import { cell, flipped, type Cell, type Verdict } from "./effects";
import {
  METRICS,
  type Family,
  type HwKey,
  type MetricKey,
  type WorkloadKey,
} from "./metrics";
import { OKABE_ITO } from "@/lib/viz/palette";

export type MatrixLever = {
  key: string;
  fam: Family;
  label: string;
  only: HwKey[] | null;
};

/** effects[workload][hw][lever][metric] (the sweep's `effects`). */
export type EffectsTable = Record<
  string,
  Record<string, Record<string, Record<string, number | null>>>
>;

export type MCell = {
  lever: string;
  metric: MetricKey;
  cell: Cell;
  caveats: CaveatKey[];
  /** Better in the previous workload and worse in this one, or the reverse. */
  flip: boolean;
  /** The lever does not run on this device (FP4 needs B200). */
  na: boolean;
};

const NA: Cell = { rel: null, verdict: "none", size: 0, glyph: "" };

/** One lever's cell for a workload and device. */
export function mcell(
  effects: EffectsTable,
  lever: MatrixLever,
  metric: MetricKey,
  w: WorkloadKey,
  hw: HwKey,
): MCell {
  const na = lever.only !== null && !lever.only.includes(hw);
  const e = effects[w]?.[hw]?.[lever.key];
  const c = na ? NA : cell(e?.[metric], metric);
  const caveats = na
    ? []
    : caveatsFor({
        lever: lever.key,
        family: lever.fam,
        metric,
        workload: w,
        hw,
        rel: c.rel,
        goodputRel: e?.goodput_req_s_per_gpu ?? null,
      });
  return { lever: lever.key, metric, cell: c, caveats, flip: false, na };
}

/** The whole matrix, flips marked against `prev` (the previous workload) when given. */
export function grid(
  effects: EffectsTable,
  levers: readonly MatrixLever[],
  metrics: readonly MetricKey[],
  w: WorkloadKey,
  hw: HwKey,
  prev: WorkloadKey | null,
): MCell[][] {
  return levers.map((l) =>
    metrics.map((m) => {
      const c = mcell(effects, l, m, w, hw);
      if (prev && prev !== w)
        c.flip = flipped(mcell(effects, l, m, prev, hw).cell, c.cell);
      return c;
    }),
  );
}

/** The fill opacity for each size of change. */
export const ALPHA_BY_SIZE = [0, 0.2, 0.38, 0.58] as const;

const HEX: Record<Verdict, string> = {
  better: OKABE_ITO.blue,
  worse: OKABE_ITO.vermillion,
  same: "#a3a3a3",
  none: "#a3a3a3",
};

export type Rgba = [number, number, number, number];

export function rgbaOf(c: Cell): Rgba {
  const h = HEX[c.verdict];
  const a =
    c.verdict === "same"
      ? 0.12
      : c.verdict === "none"
        ? 0
        : ALPHA_BY_SIZE[c.size];
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
    a,
  ];
}

/** A cell's colour a fraction t (0..1) of the way from one workload's value to the next. */
export function fillAt(from: Cell | null, to: Cell, t: number): string {
  const b = rgbaOf(to);
  if (!from) return css(b);
  const a = rgbaOf(from);
  const u = Math.max(0, Math.min(1, t));
  // a cell fading from or to "no value" keeps the other side's hue
  const src: Rgba = a[3] === 0 ? [b[0], b[1], b[2], 0] : a;
  const dst: Rgba = b[3] === 0 ? [a[0], a[1], a[2], 0] : b;
  return css(
    [0, 1, 2, 3].map((i) => src[i]! + (dst[i]! - src[i]!) * u) as Rgba,
  );
}

function css(c: Rgba): string {
  return `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${c[3].toFixed(3)})`;
}

/** The caption: how many cells flip, and the first few of them. */
export function caption(
  g: MCell[][],
  levers: readonly MatrixLever[],
  w: WorkloadKey,
  prev: WorkloadKey | null,
  labels: Record<WorkloadKey, string>,
  hwLabel: string,
): string {
  const cells = g.flat();
  const better = cells.filter((c) => c.cell.verdict === "better").length;
  const worse = cells.filter((c) => c.cell.verdict === "worse").length;
  let s = `${labels[w]} on ${hwLabel}: ${better} cells better than the baseline, ${worse} worse`;
  if (prev && prev !== w) {
    const flips = cells.filter((c) => c.flip);
    s += `; ${flips.length} flip compared with ${labels[prev]}`;
    const named = flips.slice(0, 3).map((c) => {
      const l = levers.find((x) => x.key === c.lever)!;
      return `${l.label}, ${METRICS[c.metric].label}`;
    });
    if (named.length)
      s += ` (${named.join("; ")}${flips.length > 3 ? "; …" : ""})`;
  }
  return s + ".";
}
