/**
 * Runs the vendored simulator engine off the main thread, so the page stays
 * responsive while a few thousand requests are simulated. Receives
 * `{ id, rows, cfgs }`, replies `{ id, runs }` or `{ id, error }`. Only plain
 * data crosses back: the metrics and each request's timestamps.
 */
import "./worker-global";

import { runPlain, type EngineConfig, type Row } from "@/lib/tradeoffs/engine";

type Req = { id: number; rows: Row[]; cfgs: Record<string, EngineConfig> };

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, rows, cfgs } = e.data;
  try {
    const runs: Record<string, ReturnType<typeof runPlain>> = {};
    for (const k of Object.keys(cfgs)) runs[k] = runPlain(cfgs[k]!, rows);
    self.postMessage({ id, runs });
  } catch (err) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
