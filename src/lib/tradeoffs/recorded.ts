/**
 * The simulator's recorded results outside the sweep: its `results.md`
 * (vendored byte for byte with the sweep), read as tables. The chapters on
 * levers the sweep does not vary (heterogeneous and optical pools, the KV
 * hand-off, CED, power) quote these cells verbatim, through value paths
 *
 *   md|<section>|<table>|<row>|<column>
 *
 * section = the "## N." number, table = its index within the section
 * (0-based), row = the text of its first cell (or #i for the i-th row),
 * column = the header text (or #j for the j-th column). Server-side only (reads the file).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type MdTable = { header: string[]; rows: string[][] };

let cache: Map<number, MdTable[]> | null = null;

const cells = (line: string): string[] =>
  line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());

/** Every table of results.md, by section number. */
export function parseResults(md: string): Map<number, MdTable[]> {
  const out = new Map<number, MdTable[]>();
  let sec = 0;
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    const h = /^## (\d+)\./.exec(l);
    if (h) {
      sec = Number(h[1]);
      continue;
    }
    if (l.startsWith("|") && lines[i + 1]?.startsWith("|---")) {
      const header = cells(l);
      const rows: string[][] = [];
      let j = i + 2;
      for (; j < lines.length && lines[j]!.startsWith("|"); j++)
        rows.push(cells(lines[j]!));
      const list = out.get(sec) ?? [];
      list.push({ header, rows });
      out.set(sec, list);
      i = j - 1;
    }
  }
  return out;
}

export function results(): Map<number, MdTable[]> {
  if (!cache)
    cache = parseResults(
      readFileSync(
        join(process.cwd(), "src/lib/tradeoffs/vendor/results.md"),
        "utf-8",
      ),
    );
  return cache;
}

/** One table (throws if absent). */
export function mdTable(section: number, table: number): MdTable {
  const t = results().get(section)?.[table];
  if (!t)
    throw new Error(`results.md has no table ${table} in section ${section}`);
  return t;
}

/** One cell, verbatim: `md|section|table|row|column`. */
export function mdCell(path: string): string {
  const [, s, t, row, col] = path.split("|");
  const tab = mdTable(Number(s), Number(t));
  const r = row!.startsWith("#")
    ? tab.rows[Number(row!.slice(1))]
    : tab.rows.find((x) => x[0] === row);
  const c = col!.startsWith("#")
    ? Number(col!.slice(1))
    : tab.header.indexOf(col!);
  const v = r?.[c];
  if (v === undefined || c < 0) throw new Error(`no value at "${path}"`);
  return v;
}

/** The leading number of a cell ("51.1 ms" → 51.1, "1,194 ms" → 1194, "3.24x" → 3.24). */
export function cellNumber(cell: string): number {
  const m = /-?[\d,]*\.?\d+/.exec(cell);
  if (!m) throw new Error(`no number in "${cell}"`);
  return Number(m[0].replace(/,/g, ""));
}

/** The relative change of a against b (0 when b is 0). */
export function relChange(a: number, b: number): number {
  return b === 0 ? 0 : (a - b) / Math.abs(b);
}
