/** Number formats, matching the simulator's results.py. */
import { describe, expect, it } from "vitest";

import { fixed, ms, signedPct } from "@/lib/format";

describe("formats", () => {
  it("fixed: separators and Python's round-half-even on exact ties", () => {
    expect(fixed(1234567.891, 1)).toBe("1,234,567.9");
    expect(fixed(-1234.5, 0)).toBe("-1,234");
    expect(fixed(1235.5, 0)).toBe("1,236");
    expect(fixed(0.125, 2)).toBe("0.12");
    expect(fixed(-0.001, 0)).toBe("-0");
  });
  it("ms and signed percentages", () => {
    expect(ms(0.3555)).toBe("355.5 ms");
    expect(ms(1.61)).toBe("1,610 ms");
    expect(signedPct(0.28)).toBe("+28%");
    expect(signedPct(-0.004)).toBe("-0%");
    expect(signedPct(25.77)).toBe("+2577%");
  });
});
