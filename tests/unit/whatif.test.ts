/** The what-if's toggles mean exactly the sweep's configurations. */
import { describe, expect, it } from "vitest";

import { LEVER_KEYS, SWEEP } from "@/lib/tradeoffs/data";
import { engine } from "@/lib/tradeoffs/engine";
import type { Toggles } from "@/lib/tradeoffs/whatif";

import { workload } from "./helpers/load";
import {
  BASELINE,
  LEVER_TOGGLES,
  configFor,
  leverOf,
  problems,
} from "@/lib/tradeoffs/whatif";

describe("toggles", () => {
  it("every sweep lever is a setting, and every setting is distinct", () => {
    expect(Object.keys(LEVER_TOGGLES).sort()).toEqual([...LEVER_KEYS].sort());
    const seen = new Set(
      Object.values(LEVER_TOGGLES).map((t) => JSON.stringify(t)),
    );
    expect(seen.size).toBe(LEVER_KEYS.length);
    for (const k of LEVER_KEYS) expect(leverOf(LEVER_TOGGLES[k]!)).toBe(k);
    expect(leverOf({ ...BASELINE, spec: "mtp", weights: "int4" })).toBeNull();
  });

  it("configFor gives every one of the 350 points' recorded js_cfg exactly", () => {
    for (const p of SWEEP.points) {
      const w = SWEEP.workloads[p.workload];
      const cfg = configFor(LEVER_TOGGLES[p.lever]!, p.hardware, {
        ttft: w.ttft_slo,
        tpot: w.tpot_slo,
      });
      expect(cfg, `${p.workload}/${p.hardware}/${p.lever}`).toEqual(p.js_cfg);
    }
  });

  it("explains the combinations the simulator does not model", () => {
    expect(problems(BASELINE, "h100")).toEqual([]);
    expect(
      problems({ ...BASELINE, prefix: true, kv: "paged-swap" }, "h100")[0],
    ).toMatch(/swap/);
    expect(problems({ ...BASELINE, weights: "fp4" }, "h100")[0]).toMatch(
      /B200/,
    );
    expect(problems({ ...BASELINE, weights: "fp4" }, "b200")).toEqual([]);
    expect(
      problems({ ...BASELINE, spec: "mtp", parallel: "tp2pp2" }, "h100")[0],
    ).toMatch(/pipeline/);
  });

  it("flags exactly the settings the engine rejects", () => {
    const rows = workload("chat").rows.slice(0, 60);
    const cases: [Partial<Toggles>, "h100" | "b200"][] = [
      [{ prefix: true }, "h100"],
      [{ prefix: true, kv: "paged-swap" }, "h100"],
      [{ weights: "fp4" }, "h100"],
      [{ weights: "fp4" }, "b200"],
      [{ spec: "mtp", parallel: "tp2pp2" }, "h100"],
      [{ spec: "mtp", serving: "disagg-1p1d" }, "h100"],
      [{ batch: "chunked-512", serving: "disagg-2p1d" }, "h100"],
    ];
    for (const [over, hw] of cases) {
      const t = { ...BASELINE, ...over };
      let threw = false;
      try {
        engine.simulate(configFor(t, hw, { ttft: 1, tpot: 0.05 }), rows);
      } catch {
        threw = true;
      }
      expect(problems(t, hw).length > 0, JSON.stringify(over)).toBe(threw);
    }
  });
});
