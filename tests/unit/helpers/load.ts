/** Fixture and workload loaders, and the timestamp digest, shared by the tests. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { EngineRequest, Row } from "@/lib/tradeoffs/engine";
import type { WorkloadKey } from "@/lib/tradeoffs/metrics";

export const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(join(process.cwd(), path), "utf-8")) as T;

export type Workload = {
  commit: string;
  workload: WorkloadKey;
  rate: number;
  seed: number;
  n: number;
  rows: Row[];
};

const cache = new Map<string, Workload>();
export function workload(w: WorkloadKey): Workload {
  let x = cache.get(w);
  if (!x) {
    x = readJson<Workload>(`public/tradeoffs/workloads/${w}.json`);
    cache.set(w, x);
  }
  return x;
}

export type Stamps = (number | null)[];
export type ParityCase = {
  name: string;
  workload: WorkloadKey;
  hardware: "h100" | "h200" | "b200";
  lever: string;
  cfg: Record<string, unknown>;
  stamps_sha256: string;
  first: Stamps[];
  lane_start: number;
  lanes: Stamps[];
  requests: number;
  summary: Record<string, number>;
};
export const parity = readJson<{ commit: string; cases: ParityCase[] }>(
  "tests/fixtures/tradeoffs_parity.json",
);

export const STAMP_KEYS = [
  "arrival",
  "prefillStart",
  "firstToken",
  "kvStart",
  "kvReady",
  "decodeStart",
  "finish",
] as const;

export function stampsOf(r: EngineRequest): Stamps {
  return STAMP_KEYS.map((k) => r[k]);
}

/** SHA-256 of every request's seven stamps as little-endian doubles (null as the canonical NaN), as the Python script writes it. */
export function stampDigest(reqs: readonly EngineRequest[]): string {
  const buf = Buffer.alloc(reqs.length * 7 * 8);
  let o = 0;
  for (const r of reqs)
    for (const k of STAMP_KEYS) {
      const v = r[k];
      if (v === null) buf.writeBigUInt64LE(0x7ff8000000000000n, o);
      else buf.writeDoubleLE(v, o);
      o += 8;
    }
  return createHash("sha256").update(buf).digest("hex");
}

/** A request from Python stamps (for the timeline tests). */
export function fromStamps(s: Stamps): EngineRequest {
  return {
    arrival: s[0] as number,
    prompt: 0,
    output: 0,
    prefillStart: s[1] ?? null,
    firstToken: s[2] ?? null,
    kvStart: s[3] ?? null,
    kvReady: s[4] ?? null,
    decodeStart: s[5] ?? null,
    finish: s[6] ?? null,
  };
}
