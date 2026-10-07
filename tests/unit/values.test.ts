/**
 * Every <V of="…"> a page uses resolves, and the caveats quote the
 * vendored data's numbers.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SWEEP } from "@/lib/tradeoffs/data";
import { engine } from "@/lib/tradeoffs/engine";
import {
  caveatNumbers,
  caveats,
  formatValue,
  lookup,
} from "@/lib/tradeoffs/values";

export function files(dir: string, ext = ".tsx"): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...files(p, ext));
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

const SOURCES = [
  ...files(join(process.cwd(), "src/app")),
  ...files(join(process.cwd(), "src/components")),
  ...files(join(process.cwd(), "src/content")),
];

describe("values", () => {
  it("every path a page uses resolves", () => {
    let n = 0;
    for (const f of SOURCES) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(
        /<V\s+of="([^"]+)"(?:\s+fmt="([a-z]+)")?/g,
      )) {
        expect(() => lookup(m[1]!), `${f}: ${m[1]}`).not.toThrow();
        n++;
      }
    }
    expect(n).toBeGreaterThan(10);
  });

  it("formats like the simulator's results.md", () => {
    expect(
      formatValue(
        "effect.chat.h100.chunked-512.goodput_req_s_per_gpu",
        lookup("effect.chat.h100.chunked-512.goodput_req_s_per_gpu"),
        "signed",
      ),
    ).toBe("+28%");
    expect(
      formatValue(
        "point.chat.h100.baseline.goodput_req_s_per_gpu",
        lookup("point.chat.h100.baseline.goodput_req_s_per_gpu"),
        "metric",
      ),
    ).toBe("1.420");
    expect(
      formatValue(
        "point.chat.h100.baseline.ttft_p99",
        lookup("point.chat.h100.baseline.ttft_p99"),
        "metric",
      ),
    ).toBe("355.5 ms");
    expect(lookup("meta.points")).toBe(350);
    expect(lookup("meta.levers")).toBe(23);
    expect(lookup("meta.wall_min")).toBe(56);
    expect(() => lookup("effect.chat.h100.nope.ttft_p99")).toThrow();
    expect(() => lookup("nothing")).toThrow();
  });

  it("the caveats quote the vendored sweep and engine", () => {
    const n = caveatNumbers();
    expect(n.usd).toEqual(SWEEP.meta.usd_per_gpu_hour);
    expect(n.alpha).toBe(SWEEP.meta.speculative_alpha);
    expect(n.hopUs).toBe(5);
    expect(n.b200).toEqual({
      tdp: engine.DEVICES.b200!.tdp,
      idle: engine.DEVICES.b200!.idle,
    });
    const c = caveats();
    expect(c.price.long).toContain("H100 $3.00, H200 $3.50, B200 $5.00");
    expect(c.alpha.short).toContain("0.7");
    expect(c.b200.long).toContain("1,000 W board power, 140 W idle");
    // the five the planner's verdict requires, plus prices and B200
    expect(Object.keys(c).sort()).toEqual([
      "alpha",
      "b200",
      "edge",
      "paged",
      "pp",
      "price",
      "tp",
    ]);
  });
});
