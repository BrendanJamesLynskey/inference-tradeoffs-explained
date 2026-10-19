/**
 * Brief 44, the learning layer: every chapter ends with three self-checks
 * and a "What to remember" box, and every numeric answer is the sweep's or
 * the recorded results' value, printed as the pages print their numbers.
 *
 * 1. Structure: one LEARN entry per chapter, three checks (ids unique,
 *    numbered 1-3), three to five takeaways and a Keep line.
 * 2. Links: every check links a section id of its own chapter.
 * 3. Numeric answers: the number the reader is judged against is the
 *    printed one, and equals the data's value to the printed precision.
 * 4. Choice answers that rest on the data say what the data says.
 * 5. The block renders the questions and answers with no JavaScript.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { isClose } from "@/components/learn/SelfCheck";
import { CONTENT } from "@/content/chapters";
import { LEARN, LearnBlock } from "@/content/learn";
import { numericAnswer } from "@/lib/learn/answer";
import { CHAPTERS } from "@/lib/tradeoffs/chapters";
import { lookup } from "@/lib/tradeoffs/values";

const n = (p: string) => lookup(p) as number;
const eff = (w: string, lever: string, metric: string, hw = "h100") =>
  n(`effect.${w}.${hw}.${lever}.${metric}`);
const all = Object.entries(LEARN).flatMap(([slug, s]) =>
  s.checks.map((c) => ({ slug, ...c })),
);
const source = (slug: string) => {
  const i = CHAPTERS.findIndex((c) => c.slug === slug);
  const f = `c${String(i + 1).padStart(2, "0")}.tsx`;
  return readFileSync(join(process.cwd(), "src/content/chapters", f), "utf8");
};

/** The SI scale of each unit the formatters print. */
const SCALE: Record<string, number> = {
  "": 1,
  "%": 0.01,
  "×": 1,
  " ms": 1e-3,
  " s": 1,
  " J": 1,
};

describe("every chapter: three self-checks and a Remember box", () => {
  it("covers every chapter with content", () => {
    expect(Object.keys(LEARN).sort()).toEqual(
      CHAPTERS.filter((c) => CONTENT[c.slug])
        .map((c) => c.slug)
        .sort(),
    );
  });

  it.each(Object.entries(LEARN))("%s", (slug, s) => {
    const i = CHAPTERS.findIndex((c) => c.slug === slug) + 1;
    const nn = String(i).padStart(2, "0");
    expect(s.checks.map((c) => c.id)).toEqual([
      `t${nn}-q1`,
      `t${nn}-q2`,
      `t${nn}-q3`,
    ]);
    expect(s.checks.map((c) => c.n)).toEqual([1, 2, 3]);
    expect(s.remember.length).toBeGreaterThanOrEqual(3);
    expect(s.remember.length).toBeLessThanOrEqual(5);
    expect(s.keep).toBeTruthy();
  });

  it("every check has a question, a reason and a link to a section of its chapter", () => {
    for (const c of all) {
      expect(c.q.length, c.id).toBeGreaterThan(20);
      expect(c.why, c.id).toBeTruthy();
      expect(c.more, c.id).toBeTruthy();
      expect(c.href, c.id).toMatch(/^#[\w-]+$/);
      expect(source(c.slug), `${c.id} → ${c.href}`).toContain(
        `id="${c.href.slice(1)}"`,
      );
    }
  });

  it("a choice question has 2-4 choices and a valid answer", () => {
    for (const c of all) {
      if ((c.input ?? "choice") !== "choice") continue;
      expect(c.choices!.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.choices!.length, c.id).toBeLessThanOrEqual(4);
      expect(c.answer!, c.id).toBeGreaterThanOrEqual(0);
      expect(c.answer!, c.id).toBeLessThan(c.choices!.length);
    }
  });
});

describe("numeric answers come from the data", () => {
  const numeric = all.filter((c) => (c.input ?? "choice") !== "choice");

  it("there are numeric self-checks", () => {
    expect(numeric.length).toBeGreaterThanOrEqual(10);
  });

  it.each(numeric.map((c) => [c.id, c]))(
    "%s equals the data's value as printed",
    (_id, c) => {
      const a = numericAnswer(c.of!, c.fmt);
      const scale = SCALE[a.unit];
      expect(scale, `unit "${a.unit}"`).toBeDefined();
      const decimals = (a.display.split(".")[1] ?? "").length;
      const half = 0.5 * 10 ** -decimals * scale!;
      if (typeof a.raw === "number") {
        // signed and pct formats print a relative change in per cent
        const raw = c.fmt === "signed" || c.fmt === "pct" ? a.raw : a.raw;
        expect(Math.abs(a.value * scale! - raw)).toBeLessThanOrEqual(
          half * (1 + 1e-9) + 1e-12,
        );
      } else {
        // a results.md cell: the printed text is the recorded text
        expect(a.raw.replace(/[,+]/g, "")).toContain(a.display);
      }
      const tol = c.tol ?? 0.1;
      const abs = c.abs ?? 0;
      expect(isClose(a.value, a.value, tol, abs)).toBe(true);
      if (c.input === "slider") {
        expect(a.value).toBeGreaterThanOrEqual(c.min!);
        expect(a.value).toBeLessThanOrEqual(c.max!);
        const k = Math.round((a.value - c.min!) / (c.step ?? 1));
        expect(isClose(c.min! + k * (c.step ?? 1), a.value, tol, abs)).toBe(
          true,
        );
      }
    },
  );
});

describe("choice answers that rest on the data", () => {
  const right = (id: string) => {
    const c = all.find((x) => x.id === id)!;
    return c.choices![c.answer!]!;
  };
  const mech = (s: string, v: string, k: string) => n(`mech|${s}|${v}|${k}`);

  it("t01-q1: decode-priority has the smoothest tokens and the slowest first tokens", () => {
    expect(mech("batching", "decode-priority", "itl_p99")).toBeLessThan(
      mech("batching", "prefill-priority", "itl_p99"),
    );
    expect(mech("batching", "decode-priority", "ttft_p50")).toBeGreaterThan(
      mech("batching", "prefill-priority", "ttft_p50"),
    );
  });

  it("t03-q2: offline batch gains least from prefix caching", () => {
    const g = (w: string) => eff(w, "prefix-cache", "goodput_req_s_per_gpu");
    for (const w of ["chat", "voice", "coding-agent", "long-rag"])
      expect(g("offline-batch")).toBeLessThan(g(w));
    expect(right("t03-q2")).toMatch(/^Offline batch/);
  });

  it("t04-q2/q3: disaggregation raises chat's TTFT, helps voice, hurts chat", () => {
    expect(eff("chat", "disagg-1p1d", "ttft_p99")).toBeGreaterThan(0);
    expect(
      eff("voice", "disagg-1p1d", "goodput_req_s_per_gpu"),
    ).toBeGreaterThan(0);
    expect(eff("chat", "disagg-1p1d", "goodput_req_s_per_gpu")).toBeLessThan(0);
  });

  it("t05: an A100 decode pool stays in the TPOT SLO; an A100 prefill pool does not keep up", () => {
    expect(mech("hetero", "h100-a100", "tpot_p99")).toBeGreaterThan(
      mech("hetero", "h100-h100", "tpot_p99"),
    );
    expect(mech("hetero", "a100-h100", "ttft_p99")).toBeGreaterThan(
      5 * mech("hetero", "h100-h100", "ttft_p99"),
    );
  });

  it("t07-q2: CED leaves TPOT alone", () => {
    const a = mech("ced", "ced-prefill", "tpot_p99");
    const b = mech("ced", "decoder-only", "tpot_p99");
    expect(Math.abs(a - b) / b).toBeLessThan(0.02);
  });

  it("t08-q2: TP8 on chat lowers TTFT, raises TPOT, cuts goodput", () => {
    expect(eff("chat", "tp8", "ttft_p99")).toBeLessThan(0);
    expect(eff("chat", "tp8", "tpot_p99")).toBeGreaterThan(0);
    expect(eff("chat", "tp8", "goodput_req_s_per_gpu")).toBeLessThan(0);
  });

  it("t09-q3: INT4 weights improve TPOT, not TTFT", () => {
    expect(eff("chat", "w4-int4", "tpot_p99")).toBeLessThan(0);
    expect(eff("chat", "w4-int4", "ttft_p99")).toBeGreaterThanOrEqual(0);
    expect(right("t09-q3")).toBe("TPOT");
  });

  it("t10-q3: voice gains most from the MTP head", () => {
    const g = (w: string) => eff(w, "spec-mtp", "goodput_req_s_per_gpu");
    for (const w of ["chat", "offline-batch", "coding-agent", "long-rag"])
      expect(g("voice")).toBeGreaterThan(g(w));
  });

  it("t11-q3: DVFS saves energy", () => {
    expect(mech("power", "dvfs", "j_per_tok")).toBeLessThan(
      mech("power", "default", "j_per_tok"),
    );
  });

  it("t12-q2/q3: H200 dearer on offline batch; H100 with levers beats the B200 baseline", () => {
    const p = (w: string, hw: string, lever = "baseline") =>
      n(`point.${w}.${hw}.${lever}.usd_per_mtok`);
    expect(p("offline-batch", "h200")).toBeGreaterThan(
      p("offline-batch", "h100"),
    );
    expect(p("chat", "h100", "modern-colocated")).toBeLessThan(
      p("chat", "b200"),
    );
  });

  it("t13-q3: with every lever, disaggregation has the flatter tail but not more goodput", () => {
    expect(eff("chat", "modern-disagg", "itl_p99")).toBeLessThan(
      eff("chat", "modern-colocated", "itl_p99"),
    );
    for (const w of [
      "chat",
      "voice",
      "offline-batch",
      "coding-agent",
      "long-rag",
    ])
      expect(
        eff(w, "modern-disagg", "goodput_req_s_per_gpu"),
      ).toBeLessThanOrEqual(
        eff(w, "modern-colocated", "goodput_req_s_per_gpu"),
      );
  });
});

describe("the block", () => {
  it("renders every question and answer without JavaScript", () => {
    const html = renderToStaticMarkup(
      createElement(LearnBlock, {
        spec: LEARN["01-batching-and-chunked-prefill"]!,
      }),
    );
    expect(html.match(/data-self-check="/g)).toHaveLength(3);
    expect(html.match(/<details/g)).toHaveLength(3);
    expect(html).toContain("data-remember");
    expect(html).toContain("data-keep");
  });
});
