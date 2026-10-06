/**
 * The matrix's cells against the simulator's own text: every relative
 * change results.md section 26 prints for H100 is what the matrix prints,
 * and the levers whose goodput changes sign are the same, with the same
 * signs.
 */
import { describe, expect, it } from "vitest";

import { signedPct } from "@/lib/format";
import { SWEEP, slimLevers } from "@/lib/tradeoffs/data";
import {
  NEUTRAL,
  cell,
  flipped,
  sign,
  signChanges,
} from "@/lib/tradeoffs/effects";
import { WORKLOADS, type MetricKey } from "@/lib/tradeoffs/metrics";

import { leverTable, signTable } from "./helpers/results";

const COLS: MetricKey[] = [
  "goodput_req_s_per_gpu",
  "usd_per_mtok",
  "j_per_tok",
  "ttft_p99",
  "tpot_p99",
  "itl_p99",
];

describe("cells", () => {
  it("judge by the metric's direction, with a ±2% neutral band", () => {
    expect(NEUTRAL).toBe(0.02);
    expect(cell(0.28, "goodput_req_s_per_gpu")).toMatchObject({
      verdict: "better",
      size: 2,
      glyph: "▲▲",
    });
    expect(cell(0.28, "ttft_p99")).toMatchObject({
      verdict: "worse",
      size: 2,
      glyph: "▲▲",
    });
    expect(cell(-0.6, "usd_per_mtok")).toMatchObject({
      verdict: "better",
      size: 3,
      glyph: "▼▼▼",
    });
    expect(cell(0.05, "j_per_tok")).toMatchObject({
      verdict: "worse",
      size: 1,
    });
    expect(cell(0.02, "ttft_p99")).toMatchObject({
      verdict: "same",
      size: 0,
      glyph: "≈",
    });
    expect(cell(null, "usd_per_mtok")).toMatchObject({
      verdict: "none",
      glyph: "–",
    });
    expect(flipped(cell(0.3, "ttft_p99"), cell(-0.3, "ttft_p99"))).toBe(true);
    expect(flipped(cell(0.01, "ttft_p99"), cell(-0.3, "ttft_p99"))).toBe(false);
    expect([sign(0.03), sign(-0.03), sign(0.01), sign(null)]).toEqual([
      "+",
      "-",
      "0",
      "0",
    ]);
  });
});

describe("results.md section 26", () => {
  for (const w of WORKLOADS) {
    const label = SWEEP.workloads[w].label;
    it(`${label}: every printed change equals the matrix's`, () => {
      const table = leverTable(label);
      const levers = slimLevers().filter((l) => !l.only);
      expect(table.size).toBe(levers.length);
      for (const l of levers) {
        const row = table.get(l.label);
        expect(row, l.label).toBeDefined();
        const e = SWEEP.effects[w].h100[l.key]!;
        const ours = COLS.map((m) =>
          e[m] === null || e[m] === undefined ? "-" : signedPct(e[m]!),
        );
        expect(ours, l.label).toEqual(row);
      }
    });
  }

  it("the levers whose goodput changes sign, and their signs, are the same", () => {
    const levers = slimLevers();
    const ours = signChanges(
      Object.fromEntries(
        WORKLOADS.map((w) => [w, SWEEP.effects[w].h100]),
      ) as never,
      WORKLOADS,
      levers.map((l) => l.key),
      "goodput_req_s_per_gpu",
    );
    const theirs = signTable();
    expect(
      ours.map((x) => levers.find((l) => l.key === x.lever)!.label),
    ).toEqual([...theirs.keys()]);
    for (const x of ours)
      expect(x.signs).toEqual(
        theirs.get(levers.find((l) => l.key === x.lever)!.label),
      );
  });
});
