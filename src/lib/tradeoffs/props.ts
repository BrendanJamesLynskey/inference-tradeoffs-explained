/**
 * The props the server pages hand the client widgets: slim views of the
 * vendored sweep (only what each widget draws), the caveats with their
 * numbers filled in, and the chapter each lever links to. Server-side only.
 */
import type { Caveat, CaveatKey } from "./caveats";
import { CAVEAT_ORDER } from "./caveats";
import { chapterOf } from "./chapters";
import {
  LEVER_KEYS,
  SWEEP,
  slimLevers,
  slimPoints,
  slimWorkloads,
} from "./data";
import type { ExplorerPoint, SloInfo } from "./explorer";
import type { EffectsTable, MatrixLever } from "./matrix";
import { WORKLOADS, type WorkloadKey } from "./metrics";
import { caveats } from "./values";

export function explorerProps(): {
  points: ExplorerPoint[];
  workloads: SloInfo[];
  caveats: Caveat[];
} {
  const c = caveats();
  return {
    points: slimPoints(),
    workloads: slimWorkloads(),
    caveats: CAVEAT_ORDER.map((k) => c[k]),
  };
}

/** The chapter page each lever's cells link to. */
export function chapterHrefs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of LEVER_KEYS) {
    const ch = chapterOf(SWEEP.levers[k]!.family);
    out[k] = ch ? `/learn/${ch.slug}#${k}` : "/learn";
  }
  return out;
}

export function matrixProps(family?: string): {
  effects: EffectsTable;
  levers: MatrixLever[];
  caveats: Record<CaveatKey, Caveat>;
  chapterHref: Record<string, string>;
} {
  return {
    effects: SWEEP.effects as unknown as EffectsTable,
    levers: slimLevers()
      .filter((l) => !family || l.fam === family)
      .map((l) => ({ key: l.key, fam: l.fam, label: l.label, only: l.only })),
    caveats: caveats(),
    chapterHref: chapterHrefs(),
  };
}

export function whatIfProps() {
  const slos = {} as Record<WorkloadKey, { ttft: number; tpot: number }>;
  for (const w of WORKLOADS)
    slos[w] = {
      ttft: SWEEP.workloads[w].ttft_slo,
      tpot: SWEEP.workloads[w].tpot_slo,
    };
  return {
    points: slimPoints().map((p) => ({
      w: p.w,
      hw: p.hw,
      lever: p.lever,
      label: p.label,
      m: p.m,
    })),
    leverLabels: Object.fromEntries(
      LEVER_KEYS.map((k) => [k, SWEEP.levers[k]!.label]),
    ),
    slos,
    caveats: caveats(),
  };
}
