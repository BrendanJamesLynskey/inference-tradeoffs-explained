/** The matrix's frames: cells, flips, colours in between, captions. */
import { describe, expect, it } from "vitest";

import { SWEEP, slimLevers } from "@/lib/tradeoffs/data";
import { cell, flipped } from "@/lib/tradeoffs/effects";
import {
  ALPHA_BY_SIZE,
  caption,
  fillAt,
  grid,
  mcell,
  rgbaOf,
  type EffectsTable,
} from "@/lib/tradeoffs/matrix";
import { MATRIX_METRICS, WORKLOAD_LABEL } from "@/lib/tradeoffs/metrics";

const effects = SWEEP.effects as unknown as EffectsTable;
const levers = slimLevers();

describe("matrix", () => {
  it("cells are the sweep's effects for the workload and device", () => {
    for (const w of ["chat", "offline-batch", "voice"] as const) {
      const g = grid(effects, levers, MATRIX_METRICS, w, "h100", null);
      g.forEach((row, i) =>
        row.forEach((c, j) => {
          const l = levers[i]!;
          if (l.only) expect(c.na).toBe(true);
          else
            expect(c.cell).toEqual(
              cell(
                SWEEP.effects[w].h100[l.key]![MATRIX_METRICS[j]!],
                MATRIX_METRICS[j]!,
              ),
            );
        }),
      );
    }
  });

  it("flips are cells better in one workload and worse in the next", () => {
    const g = grid(
      effects,
      levers,
      MATRIX_METRICS,
      "coding-agent",
      "h100",
      "chat",
    );
    const chunk = g[levers.findIndex((l) => l.key === "chunked-512")]![0]!;
    expect(chunk.flip).toBe(true); // goodput +28% on chat, -24% on the coding agent
    let n = 0;
    for (const row of g)
      for (const c of row) {
        const was = mcell(
          effects,
          levers.find((l) => l.key === c.lever)!,
          c.metric,
          "chat",
          "h100",
        ).cell;
        expect(c.flip).toBe(flipped(was, c.cell));
        n += +c.flip;
      }
    expect(
      caption(g, levers, "coding-agent", "chat", WORKLOAD_LABEL, "H100"),
    ).toContain(`${n} flip compared with Chat`);
  });

  it("colours fade between workloads", () => {
    const a = cell(0.6, "goodput_req_s_per_gpu");
    const b = cell(-0.6, "goodput_req_s_per_gpu");
    expect(rgbaOf(a)).toEqual([0, 114, 178, ALPHA_BY_SIZE[3]]);
    expect(fillAt(a, b, 0)).toBe("rgba(0, 114, 178, 0.580)");
    expect(fillAt(a, b, 1)).toBe("rgba(213, 94, 0, 0.580)");
    expect(fillAt(a, b, 0.5)).toBe("rgba(107, 104, 89, 0.580)");
    expect(fillAt(null, b, 0.3)).toBe("rgba(213, 94, 0, 0.580)");
  });

  it("caveats are attached from the data", () => {
    const g = grid(effects, levers, MATRIX_METRICS, "voice", "b200", null);
    const at = (lever: string, metric: string) =>
      g[levers.findIndex((l) => l.key === lever)]![
        MATRIX_METRICS.indexOf(metric as never)
      ]!.caveats;
    expect(at("tp2pp2", "ttft_p99")).toEqual(
      expect.arrayContaining(["pp", "tp", "b200"]),
    );
    expect(at("paged", "ttft_p99")).toContain("paged");
    expect(at("modern-spec", "goodput_req_s_per_gpu")).toEqual(
      expect.arrayContaining(["edge", "alpha"]),
    );
    expect(at("w8a8-fp8", "usd_per_mtok")).toContain("price");
  });
});
