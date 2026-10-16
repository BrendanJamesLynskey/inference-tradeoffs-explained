/**
 * This site's favicon glyph (src/app/icon.svg) and its card's graphic.
 * Glyph: the hexagon of the Inference track, the letter T, #b45309.
 */
import { slimPoints } from "@/lib/tradeoffs/data";
import { FAMILY_COLOUR } from "@/lib/viz/palette";

export function Glyph({ size }: { size: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <path d="M16 0.5 29.5 8.25v15.5L16 31.5 2.5 23.75V8.25z" fill="#b45309" />
      <path d="M17.48 23H14.52V11.47H10.72V9H21.28V11.47H17.48Z" fill="#fff" />
    </svg>
  );
}

/**
 * The landing hero's explorer, still: every configuration of the sweep for the chat workload on
 * one device, p99 time per output token (left is better) against goodput per GPU (up is better),
 * coloured by lever family; the front (no other point better on both) is dashed. From the recorded
 * sweep at build time.
 */
export function Motif(): JSX.Element {
  const all = slimPoints().filter((p) => p.w === "chat");
  const hw = all[0]!.hw;
  const pts = all
    .filter((p) => p.hw === hw)
    .flatMap((p) => {
      const x = p.m.tpot_p99;
      const y = p.m.goodput_req_s_per_gpu;
      return x != null && y != null && x > 0
        ? [{ x, y, fam: p.fam as string }]
        : [];
    });
  const x0 = 0;
  const x1 = Math.max(...pts.map((p) => p.x)) * 1.05;
  const y1 = Math.max(...pts.map((p) => p.y)) * 1.05;
  const X = (v: number) => 20 + (400 * (v - x0)) / (x1 - x0);
  const Y = (v: number) => 400 - (380 * v) / y1;
  const front = pts
    .filter(
      (p) =>
        !pts.some((q) => q.x <= p.x && q.y >= p.y && (q.x < p.x || q.y > p.y)),
    )
    .sort((a, b) => a.x - b.x);
  return (
    <svg width="440" height="420" viewBox="0 0 440 420">
      <line
        x1={20}
        y1={404}
        x2={420}
        y2={404}
        stroke="#475569"
        strokeWidth={3}
      />
      <line x1={16} y1={20} x2={16} y2={404} stroke="#475569" strokeWidth={3} />
      <polyline
        points={front.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")}
        fill="none"
        stroke="#f8fafc"
        strokeWidth={4}
        strokeDasharray="10 8"
      />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={X(p.x)}
          cy={Y(p.y)}
          r={10}
          fill={
            FAMILY_COLOUR[p.fam] === "currentColor"
              ? "#e2e8f0"
              : (FAMILY_COLOUR[p.fam] ?? "#94a3b8")
          }
          stroke="#0b1020"
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}
