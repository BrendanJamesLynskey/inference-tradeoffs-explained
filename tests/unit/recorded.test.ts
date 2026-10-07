/**
 * The results.md reader the chapters quote through md| paths: tables by
 * section, rows by first cell or index, columns by head or index, cells
 * verbatim.
 */
import { describe, expect, it } from "vitest";

import {
  cellNumber,
  mdCell,
  mdTable,
  parseResults,
  relChange,
  results,
} from "@/lib/tradeoffs/recorded";
import { formatValue, lookup } from "@/lib/tradeoffs/values";

describe("results.md tables", () => {
  it("every section with tables is read", () => {
    const r = results();
    expect(r.get(19)).toHaveLength(3);
    expect(r.get(24)).toHaveLength(6);
    expect(mdTable(26, 0).header[0]).toBe("Workload");
    expect(() => mdTable(99, 0)).toThrow();
  });
  it("cells verbatim", () => {
    expect(mdCell("md|19|0|chunked 512|ITL p99")).toBe("51.1 ms");
    expect(mdCell("md|20|0|#7|Allocated KV holding tokens")).toBe("97.3%");
    expect(mdCell("md|20|2|16|#4")).toBe("1077");
    expect(mdCell("md|24|0|8|of it all-reduce")).toBe("61.5%");
    expect(() => mdCell("md|19|0|nope|ITL p99")).toThrow();
    expect(() => mdCell("md|19|0|chunked 512|nope")).toThrow();
    expect(lookup("md|25|0|#1|Speed (paper)")).toBe("2.53x");
    expect(formatValue("md|x", "3.24x", "num")).toBe("3.24x");
  });
  it("numbers out of cells", () => {
    expect(cellNumber("51.1 ms")).toBe(51.1);
    expect(cellNumber("1,194 ms")).toBe(1194);
    expect(cellNumber("3.24x")).toBe(3.24);
    expect(cellNumber("-24%")).toBe(-24);
    expect(() => cellNumber("never")).toThrow();
    expect(relChange(15, 10)).toBe(0.5);
    expect(relChange(5, -10)).toBe(1.5);
    expect(relChange(3, 0)).toBe(0);
  });
  it("a minimal document", () => {
    const t = parseResults(
      "## 1. A\n\n| a | b |\n|---|---|\n| x | 1 |\n| y | 2 |\n\ntext\n",
    );
    expect(t.get(1)![0]!.rows).toEqual([
      ["x", "1"],
      ["y", "2"],
    ]);
  });
});

describe("mech| values", () => {
  it("summary keys, horizon and configuration", () => {
    expect(typeof lookup("mech|batching|prefill-priority|itl_p99")).toBe(
      "number",
    );
    expect(lookup("mech|speculative|g3a07|cfg.speculative.alpha")).toBe(0.7);
    expect(lookup("mech|power|cap300|cfg.powerCap")).toBe(300);
    expect(lookup("mech|pools|1p1d|horizon")).toBeGreaterThan(0);
    expect(() => lookup("mech|pools|nope|horizon")).toThrow();
    expect(() => lookup("mech|pools|1p1d|cfg.nope.deeper")).toThrow();
  });
});
