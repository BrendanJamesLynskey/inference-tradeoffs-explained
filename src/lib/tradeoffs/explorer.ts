/**
 * The Pareto explorer, as pure functions (unit-tested): where each swept
 * configuration sits for a pair of metrics and a workload, which points are
 * on the front, and every in-between frame of the animation when the
 * workload or the SLO filter changes. A frame is a function of
 * (from-layout, to-layout, t) only, so any frame can be reproduced.
 *
 * Axes are logarithmic (the metrics span orders of magnitude, and a log
 * axis shows tails) and fixed across workloads for a pair of metrics, so
 * the points visibly move when the workload changes and the axes do not.
 */
import { frontIndices } from "./pareto";
import {
  HW_LABEL,
  METRICS,
  type HwKey,
  type MetricKey,
  type WorkloadKey,
} from "./metrics";

export type ExplorerPoint = {
  id: string;
  w: WorkloadKey;
  hw: HwKey;
  lever: string;
  fam: string;
  label: string;
  m: Partial<Record<MetricKey, number | null>>;
};

export type SloInfo = {
  key: WorkloadKey;
  label: string;
  ttftSlo: number;
  tpotSlo: number;
};

/** The SLO filter: keep points whose reference-load p99s are within s × the workload's SLOs. */
export const SLO_SCALES = [Infinity, 4, 2, 1, 0.5] as const;
export type SloScale = (typeof SLO_SCALES)[number];

export function sloLabel(s: number): string {
  if (!Number.isFinite(s)) return "Any";
  return s === 0.5 ? "½ × SLO" : `${s} × SLO`;
}

export type Dims = {
  w: number;
  h: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type Domain = { lo: number; hi: number };

const ok = (v: number | null | undefined): v is number =>
  v !== null && v !== undefined && Number.isFinite(v) && v > 0;

/** The log-axis domain of a metric over every point of every workload, padded by 6% of the span. */
export function domainOf(
  points: readonly ExplorerPoint[],
  k: MetricKey,
): Domain {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of points) {
    const v = p.m[k];
    if (!ok(v)) continue;
    const l = Math.log10(v);
    if (l < lo) lo = l;
    if (l > hi) hi = l;
  }
  if (!Number.isFinite(lo)) return { lo: 0, hi: 1 };
  if (hi - lo < 1e-9) {
    lo -= 0.5;
    hi += 0.5;
  }
  const pad = 0.06 * (hi - lo);
  return { lo: lo - pad, hi: hi + pad };
}

/** Screen coordinate of a value on a log axis. */
export function project(v: number, d: Domain, r0: number, r1: number): number {
  return r0 + ((Math.log10(v) - d.lo) / (d.hi - d.lo)) * (r1 - r0);
}

/** Tick values: 1, 2, 5 × 10^k inside the domain (just the decades when there would be too many). */
export function ticks(d: Domain, max = 7): number[] {
  const out: number[] = [];
  for (let e = Math.floor(d.lo); e <= Math.ceil(d.hi); e++)
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      const l = Math.log10(v);
      if (l >= d.lo && l <= d.hi) out.push(v);
    }
  if (out.length <= max) return out;
  const decades = out.filter(
    (v) => Math.abs(Math.log10(v) - Math.round(Math.log10(v))) < 1e-9,
  );
  if (decades.length >= 2 && decades.length <= max) return decades;
  const step = Math.ceil(decades.length / max);
  return decades.filter((_, i) => i % step === 0);
}

export type Placed = {
  id: string;
  px: number;
  py: number;
  /** Drawn at all (this workload, a device shown, both values present). */
  shown: boolean;
  /** Within the SLO filter. */
  pass: boolean;
  /** On the front of the points that pass. */
  front: boolean;
};

export type Layout = {
  workload: WorkloadKey;
  pts: Map<string, Placed>;
  /** Front points in screen space, sorted by x. */
  frontLine: [number, number][];
  /** Points of this workload with a missing value (no capacity at the SLO): not drawn. */
  missing: number;
  /** Front point ids, sorted by x. */
  frontIds: string[];
};

export type ExplorerState = {
  workload: WorkloadKey;
  x: MetricKey;
  y: MetricKey;
  hw: readonly HwKey[];
  slo: number;
};

/** Does a point's reference-load p99 latency fit within s × the workload's SLOs? */
export function passes(p: ExplorerPoint, slo: SloInfo, s: number): boolean {
  if (!Number.isFinite(s)) return true;
  const t = p.m.ttft_p99;
  const o = p.m.tpot_p99;
  return ok(t) && ok(o) && t <= s * slo.ttftSlo && o <= s * slo.tpotSlo;
}

/** Where every point of the chosen workload goes, and the front. */
export function layout(
  all: readonly ExplorerPoint[],
  slos: readonly SloInfo[],
  st: ExplorerState,
  dims: Dims,
  domains: { x: Domain; y: Domain },
): Layout {
  const slo = slos.find((s) => s.key === st.workload)!;
  const pts = new Map<string, Placed>();
  const candidates: ExplorerPoint[] = [];
  let missing = 0;
  const x0 = dims.left;
  const x1 = dims.w - dims.right;
  const y0 = dims.h - dims.bottom;
  const y1 = dims.top;
  for (const p of all) {
    if (p.w !== st.workload || !st.hw.includes(p.hw)) continue;
    const xv = p.m[st.x];
    const yv = p.m[st.y];
    if (!ok(xv) || !ok(yv)) {
      missing += 1;
      continue;
    }
    const pass = passes(p, slo, st.slo);
    pts.set(p.id, {
      id: p.id,
      px: project(xv, domains.x, x0, x1),
      py: project(yv, domains.y, y0, y1),
      shown: true,
      pass,
      front: false,
    });
    if (pass) candidates.push(p);
  }
  const idx = frontIndices(candidates, [st.x, st.y]);
  const frontIds = idx
    .map((i) => candidates[i]!.id)
    .sort(
      (a, b) =>
        pts.get(a)!.px - pts.get(b)!.px || pts.get(a)!.py - pts.get(b)!.py,
    );
  for (const id of frontIds) pts.get(id)!.front = true;
  return {
    workload: st.workload,
    pts,
    frontLine: frontIds.map((id) => [pts.get(id)!.px, pts.get(id)!.py]),
    missing,
    frontIds,
  };
}

/** Smoothstep easing. */
export function ease(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

export type FramePoint = {
  id: string;
  px: number;
  py: number;
  /** 0 .. 1: fading in or out when a point appears or disappears. */
  opacity: number;
  /** 0 .. 1: how far into "passes the SLO filter". */
  pass: number;
  /** 0 .. 1: how far into "on the front". */
  front: number;
};

export type Frame = {
  pts: FramePoint[];
  /** The old front fades out while the new one fades in. */
  fromLine: [number, number][];
  toLine: [number, number][];
  t: number;
};

/** The frame a fraction `t` of the way from one layout to the next (eased). */
export function frame(from: Layout | null, to: Layout, t: number): Frame {
  const e = from ? ease(t) : 1;
  const ids = new Set<string>([
    ...(from ? from.pts.keys() : []),
    ...to.pts.keys(),
  ]);
  const pts: FramePoint[] = [];
  for (const id of ids) {
    const a = from?.pts.get(id);
    const b = to.pts.get(id);
    const lerp = (u: number, v: number) => u + (v - u) * e;
    if (a && b)
      pts.push({
        id,
        px: lerp(a.px, b.px),
        py: lerp(a.py, b.py),
        opacity: 1,
        pass: lerp(+a.pass, +b.pass),
        front: lerp(+a.front, +b.front),
      });
    else if (b)
      pts.push({
        id,
        px: b.px,
        py: b.py,
        opacity: e,
        pass: +b.pass,
        front: +b.front,
      });
    else if (a)
      pts.push({
        id,
        px: a.px,
        py: a.py,
        opacity: 1 - e,
        pass: +a.pass,
        front: +a.front,
      });
  }
  // front points last, so they are drawn on top (and get the pointer)
  pts.sort(
    (p, q) => p.front - q.front || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0),
  );
  return {
    pts,
    fromLine: from ? from.frontLine : [],
    toLine: to.frontLine,
    t: e,
  };
}

/** The caption for a layout (and what changed since the previous one). */
export function caption(
  l: Layout,
  prev: Layout | null,
  points: readonly ExplorerPoint[],
  st: ExplorerState,
  workloadLabel: string,
): string {
  const n = l.pts.size;
  const pass = [...l.pts.values()].filter((p) => p.pass).length;
  const byId = new Map(
    points.filter((p) => p.w === st.workload).map((p) => [p.id, p]),
  );
  const best = (k: MetricKey) => {
    let b: ExplorerPoint | null = null;
    for (const id of l.frontIds) {
      const p = byId.get(id)!;
      const v = p.m[k]!;
      if (!b || (METRICS[k].better === "max" ? v > b.m[k]! : v < b.m[k]!))
        b = p;
    }
    return b;
  };
  const bx = best(st.x);
  const by = best(st.y);
  let s = `${workloadLabel}: ${l.frontIds.length} of ${n} configurations on the ${METRICS[st.x].label} / ${METRICS[st.y].label} front`;
  if (pass < n) s += ` (${pass} within the SLO filter)`;
  if (bx && by && bx.id !== by.id)
    s += `; best ${METRICS[st.x].label}: ${bx.label} on ${HW_LABEL[bx.hw]}; best ${METRICS[st.y].label}: ${by.label} on ${HW_LABEL[by.hw]}`;
  else if (bx) s += `; ${bx.label} on ${HW_LABEL[bx.hw]} is best on both`;
  if (prev && prev.workload !== l.workload) {
    const was = new Set(prev.frontIds);
    const now = new Set(l.frontIds);
    const joined = l.frontIds.filter((id) => !was.has(id)).length;
    const left = prev.frontIds.filter((id) => !now.has(id)).length;
    s += `. Since the last workload, ${joined} joined the front and ${left} left it`;
  }
  return s + ".";
}
