/** Read the tables of the simulator's results.md section 26 (vendored). */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const RESULTS_MD = readFileSync(
  join(process.cwd(), "src/lib/tradeoffs/vendor/results.md"),
  "utf-8",
);

const SECTION = RESULTS_MD.slice(RESULTS_MD.indexOf("## 26."));

function tableAfter(marker: string): string[][] {
  const i = SECTION.indexOf(marker);
  if (i < 0) throw new Error(`no "${marker}" in results.md section 26`);
  const lines = SECTION.slice(i).split("\n");
  const start = lines.findIndex((l) => l.startsWith("|"));
  const rows: string[][] = [];
  for (const l of lines.slice(start + 2)) {
    if (!l.startsWith("|")) break;
    rows.push(
      l
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim()),
    );
  }
  return rows;
}

/** A workload's per-lever table on H100: label → [goodput, $/M, J/tok, TTFT p99, TPOT p99, ITL p99]. */
export function leverTable(workloadLabel: string): Map<string, string[]> {
  const rows = tableAfter(`**${workloadLabel}** on H100.`);
  return new Map(rows.map((r) => [r[0]!.replace(/\*$/, ""), r.slice(1)]));
}

/** The sign-change table: lever label → signs per workload. */
export function signTable(): Map<string, string[]> {
  const rows = tableAfter(
    "**Levers whose effect on goodput per GPU changes sign",
  );
  return new Map(rows.map((r) => [r[0]!, r.slice(1)]));
}
