/**
 * The chapters' side of the learning layer (brief 44): `<Check>` resolves a
 * self-check's numeric answer from the sweep or the recorded results (the
 * same paths `<V of>` prints) and hands it to the shared `SelfCheck`
 * (src/components/learn/, byte-identical on every *-explained site). The
 * reader answers in the printed unit. Nothing is typed in by hand.
 * Server Component.
 */
import type { ReactNode } from "react";

import { SelfCheck } from "@/components/learn/SelfCheck";
import { numericAnswer } from "@/lib/learn/answer";
import type { Fmt } from "@/lib/tradeoffs/values";

export type CheckSpec = {
  id: string;
  n: number;
  q: string;
  input?: "choice" | "number" | "slider";
  choices?: string[];
  answer?: number;
  of?: string;
  fmt?: Fmt;
  tol?: number;
  abs?: number;
  min?: number;
  max?: number;
  step?: number;
  /** a section id on the chapter page, e.g. "#why" */
  href: string;
  more: string;
  why: ReactNode;
};

export function Check(c: CheckSpec): JSX.Element {
  const input = c.input ?? "choice";
  let value: number | undefined;
  let display: string | undefined;
  let unit: string | undefined;
  if (input !== "choice") {
    if (!c.of) throw new Error(`self-check ${c.id}: a number needs \`of\``);
    const a = numericAnswer(c.of, c.fmt);
    value = a.value;
    display = a.display;
    unit = a.unit || undefined;
  } else if (
    !c.choices ||
    c.answer === undefined ||
    c.answer < 0 ||
    c.answer >= c.choices.length
  ) {
    throw new Error(`self-check ${c.id}: a choice needs choices and an answer`);
  }
  return (
    <SelfCheck
      id={c.id}
      n={c.n}
      question={c.q}
      input={input}
      choices={c.choices}
      answer={c.answer}
      value={value}
      display={display}
      unit={unit}
      tol={c.tol}
      abs={c.abs}
      min={c.min}
      max={c.max}
      step={c.step}
      why={c.why}
      href={c.href}
      hrefLabel={c.more}
    />
  );
}
