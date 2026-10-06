"use client";

/**
 * Load a recorded workload and run engine configurations on it in a Web
 * Worker (off the main thread; inline as a fallback). One shared worker runs
 * the simulations in order. From LLM Inference Explained's useRuns.
 */
import {
  runPlain,
  type EngineConfig,
  type PlainRun,
  type Row,
} from "@/lib/tradeoffs/engine";
import type { WorkloadKey } from "@/lib/tradeoffs/metrics";

let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<
  number,
  { resolve: (r: Record<string, PlainRun>) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./sim.worker.ts", import.meta.url));
    worker.onmessage = (
      e: MessageEvent<{
        id: number;
        runs?: Record<string, PlainRun>;
        error?: string;
      }>,
    ) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      if (e.data.runs) w.resolve(e.data.runs);
      else w.reject(new Error(e.data.error ?? "simulation failed"));
    };
  } catch {
    worker = null; // no workers: run on the main thread below
  }
  return worker;
}

export function simulateAll(
  rows: Row[],
  cfgs: Record<string, EngineConfig>,
): Promise<Record<string, PlainRun>> {
  const w = getWorker();
  if (w) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      w.postMessage({ id, rows, cfgs });
    });
  }
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        const out: Record<string, PlainRun> = {};
        for (const k of Object.keys(cfgs)) out[k] = runPlain(cfgs[k]!, rows);
        resolve(out);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    }, 0),
  );
}

const cache = new Map<WorkloadKey, Promise<Row[]>>();

/** The workload exactly as the sweep generated it at its reference load. */
export function loadWorkload(w: WorkloadKey): Promise<Row[]> {
  let p = cache.get(w);
  if (!p) {
    p = fetch(`/tradeoffs/workloads/${w}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`workload ${w}: HTTP ${r.status}`);
        return r.json() as Promise<{ rows: Row[] }>;
      })
      .then((d) => d.rows);
    p.catch(() => cache.delete(w));
    cache.set(w, p);
  }
  return p;
}
