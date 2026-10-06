/**
 * The what-if timeline's frames, against the Python reference: the lanes
 * built from the engine's run equal the lanes built from the Python
 * package's timestamps (recorded in the parity fixture), and so do the
 * captions at key frames.
 */
import { describe, expect, it } from "vitest";

import { runPlain } from "@/lib/tradeoffs/engine";
import {
  caption,
  counts,
  lanes,
  phaseAt,
  segments,
  timeAt,
} from "@/lib/tradeoffs/timeline";

import { fromStamps, parity, workload } from "./helpers/load";

const find = (n: string) => parity.cases.find((c) => c.name === n)!;

describe("timeline", () => {
  it("cuts a request at its stamps", () => {
    const r = fromStamps([1, 1.5, 2, 2.1, 2.4, 2.5, 4]);
    expect(segments(r)).toEqual([
      { phase: "queue", t0: 1, t1: 1.5 },
      { phase: "prefill", t0: 1.5, t1: 2 },
      { phase: "handoff", t0: 2, t1: 2.5 },
      { phase: "decode", t0: 2.5, t1: 4 },
    ]);
    const s = segments(r);
    expect([0.5, 1.2, 1.7, 2.2, 3, 5].map((t) => phaseAt(s, 1, t))).toEqual([
      "waiting",
      "queue",
      "prefill",
      "handoff",
      "decode",
      "done",
    ]);
    expect(
      segments(fromStamps([1, null, null, null, null, null, null])),
    ).toEqual([]);
  });

  for (const [before, after] of [
    ["chat / h100 / baseline", "chat / h100 / prefix-cache"],
    ["chat / h100 / baseline", "chat / h100 / disagg-levers"],
  ] as const) {
    it(`${after}: lanes and key-frame captions equal Python's`, () => {
      const b = find(before);
      const a = find(after);
      const rows = workload("chat").rows;
      const js = lanes(runPlain(b.cfg, rows).reqs, runPlain(a.cfg, rows).reqs);
      // the same lanes from the Python stamps (placed at their indices)
      const pad = (c: typeof b) => {
        const out = Array.from({ length: c.requests }, () =>
          fromStamps([0, null, null, null, null, null, null]),
        );
        c.lanes.forEach((s, i) => (out[c.lane_start + i] = fromStamps(s)));
        return out;
      };
      const py = lanes(pad(b), pad(a));
      expect(js.ids).toEqual(py.ids);
      expect(js.before).toEqual(py.before);
      expect(js.after).toEqual(py.after);
      expect([js.t0, js.t1]).toEqual([py.t0, py.t1]);
      for (const step of [0, 15, 30, 59])
        expect(caption(js, step, 60)).toBe(caption(py, step, 60));
      const mid = counts(js.before, js.arrival, timeAt(js, 30, 60));
      expect(Object.values(mid).reduce((x, y) => x + y, 0)).toBe(24);
      if (after.endsWith("disagg-levers"))
        expect(js.after.flat().some((s) => s.phase === "handoff")).toBe(true);
    });
  }
});
