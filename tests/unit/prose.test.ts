/**
 * No page spells out a number by hand: every digit in the pages' running
 * text (JSX text and string literals of prose) is part of a name (H100,
 * Llama-3-70B, p99, TP4, FP8, arXiv ids…) or a structural label; numbers
 * come from <V of="…">, from the data, or from the format functions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { files } from "./values.test";

// names and labels that contain digits
const NAMES =
  /\b(?:chapters? \d+|Mistral-7B|Llama-3-8B|A100(?:-40GB)?|NF4|Hyena-2|25 GbE|[HB][12]00s?|Llama-3(?:\.2)?-(?:70|1)B|p(?:50|99)|TP[248]|PP2|FP[48]|INT[48]|BF16|W[48]A(?:8|4|16)|[12]P(?:\(TP2\))?\+?1D|1P1D|2P1D|α–β|γ[34]|1B|4xx|404|0 s|2,048|512|[0-9]+(?:px|rem)|\d{4}\.\d{5}|Okabe|99th|50th|SHA-256|OPT-13B|section \d+)\b|\+0%/g;

function prose(src: string): string[] {
  const out: string[] = [];
  // JSX text between tags, outside {expressions}
  for (const m of src.matchAll(/>([^<>{}]*[0-9][^<>{}]*)</g))
    if (!/[;=]|&&|\|\|/.test(m[1]!)) out.push(m[1]!);
  // long string literals (sentences)
  for (const m of src.matchAll(/"([^"\n]{40,})"/g))
    if (
      // value paths into results.md and the recorded scenarios are data, not prose
      !/^(?:md|mech)\|/.test(m[1]!) &&
      / [a-z]+ [a-z]+ /.test(m[1]!) &&
      !/focus-ring|px-|text-|decoration-/.test(m[1]!)
    )
      out.push(m[1]!);
  return out;
}

describe("prose numbers", () => {
  const pages = [
    ...files(join(process.cwd(), "src/app")),
    ...files(join(process.cwd(), "src/content")),
    join(process.cwd(), "src/lib/tradeoffs/chapters.ts"),
    join(process.cwd(), "src/lib/tradeoffs/caveats.ts"),
    join(process.cwd(), "src/lib/tradeoffs/metrics.ts"),
  ];
  for (const f of pages) {
    it(f.replace(process.cwd() + "/", ""), () => {
      const src = readFileSync(f, "utf8");
      for (const t of prose(src)) {
        const left = t.replace(NAMES, "").replace(/\$\{[^}]*\}/g, "");
        expect(
          /[0-9]/.test(left) ? JSON.stringify(t) : "",
          "hand-written number",
        ).toBe("");
      }
    });
  }
});
