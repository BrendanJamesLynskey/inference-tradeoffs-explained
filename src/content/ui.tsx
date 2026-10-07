/**
 * Building blocks of the chapter pages' prose: a section, an external link,
 * a "deeper" box, the references list and a recorded-results table (cells
 * of the simulator's results.md, verbatim, coloured better / worse against
 * a baseline row like the matrix). Server Components.
 */
import type { ReactNode } from "react";

import { MdxTable } from "@/components/ui/MdxTable";
import { cellNumber, mdTable, relChange } from "@/lib/tradeoffs/recorded";
import { VERDICT_COLOUR } from "@/lib/viz/palette";
import { NEUTRAL } from "@/lib/tradeoffs/effects";

import { REFS, type Ref, type RefKey } from "./refs";

export const A_CLASS =
  "focus-ring rounded text-accent underline underline-offset-2 dark:text-indigo-300";

export function A({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <a href={href} className={A_CLASS}>
      {children}
    </a>
  );
}

export function Sec({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section id={id} className="mt-12 scroll-mt-6">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mdx-content mt-3 max-w-3xl space-y-4 text-neutral-700 dark:text-neutral-300">
        {children}
      </div>
    </section>
  );
}

/** A box of links to the family's other sites and the author's decks. */
export function Deeper({ children }: { children: ReactNode }): JSX.Element {
  return (
    <aside className="mt-6 max-w-3xl rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
        Why, underneath
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>
    </aside>
  );
}

/** A citation in running text: the paper's short name, linked. */
export function Cite({ k }: { k: RefKey }): JSX.Element {
  const r = REFS[k];
  return <A href={r.href}>{r.short}</A>;
}

export function References({ keys }: { keys: readonly RefKey[] }): JSX.Element {
  return (
    <section id="references" className="mt-12 scroll-mt-6">
      <h2 className="text-xl font-semibold tracking-tight">
        Papers and sources
      </h2>
      <ul className="mt-3 max-w-3xl space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
        {keys.map((k) => {
          const r: Ref = REFS[k];
          return (
            <li key={k}>
              {r.authors}, <A href={r.href}>{r.title}</A>
              {r.venue ? ` (${r.venue})` : ""}
              {r.note ? `: ${r.note}` : "."}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Columns of one results.md table for some rows, each cell verbatim and
 * marked better (blue, ✓) or worse (vermillion, ✗) than the baseline row
 * when it differs by more than the matrix's neutral band.
 */
export function RecordedTable({
  section,
  table,
  rows,
  cols,
  better,
  baseline,
  caption,
  headers,
}: {
  section: number;
  table: number;
  /** Row selectors: first-cell text, or #i. */
  rows: string[];
  cols: string[];
  /** For each column: which way is better (null: not judged). */
  better: ("min" | "max" | null)[];
  /** The row the others are judged against. */
  baseline: string;
  caption: ReactNode;
  /** Column heads to show instead of the table's (when its heads repeat). */
  headers?: string[];
}): JSX.Element {
  const t = mdTable(section, table);
  const pick = (sel: string) =>
    sel.startsWith("#")
      ? t.rows[Number(sel.slice(1))]!
      : t.rows.find((r) => r[0] === sel)!;
  const colIdx = cols.map((c) =>
    c.startsWith("#") ? Number(c.slice(1)) : t.header.indexOf(c),
  );
  const base = pick(baseline);
  return (
    <figure className="my-6" data-testid="recorded-table">
      <MdxTable>
        <thead>
          <tr>
            <th className="p-2 text-left">{t.header[0]}</th>
            {colIdx.map((c, j) => (
              <th key={c} className="p-2 text-right">
                {headers?.[j] ?? t.header[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((sel) => {
            const r = pick(sel);
            return (
              <tr
                key={sel}
                className="border-t border-neutral-200 dark:border-neutral-800"
              >
                <td className="p-2">{r[0]}</td>
                {colIdx.map((c, j) => {
                  const dir = better[j];
                  let mark = "";
                  let colour: string | undefined;
                  if (dir && r !== base) {
                    const a = cellNumber(r[c]!);
                    const b = cellNumber(base[c]!);
                    const rel = relChange(a, b);
                    if (Math.abs(rel) > NEUTRAL) {
                      const good = Math.sign(rel) === (dir === "max" ? 1 : -1);
                      mark = good ? "✓" : "✗";
                      colour = good
                        ? VERDICT_COLOUR.better
                        : VERDICT_COLOUR.worse;
                    }
                  }
                  return (
                    <td
                      key={c}
                      className="whitespace-nowrap p-2 text-right font-mono"
                      style={
                        colour
                          ? { boxShadow: `inset 3px 0 0 ${colour}` }
                          : undefined
                      }
                    >
                      {r[c]} <span aria-hidden>{mark}</span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </MdxTable>
      <figcaption className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
        {caption}
      </figcaption>
    </figure>
  );
}
