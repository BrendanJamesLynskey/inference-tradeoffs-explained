/**
 * /method: how the sweep was run (the cluster, the grid, capacity and the
 * reference load), the workloads with their sources, the devices with their
 * illustrative prices, every caveat in full, and the provenance of the
 * vendored files. Server Component; every number from the vendored data.
 */
import { MdxTable } from "@/components/ui/MdxTable";
import { V } from "@/components/mdx/V";
import { fixed } from "@/lib/format";
import { CAVEAT_ORDER } from "@/lib/tradeoffs/caveats";
import { LEVER_KEYS, SWEEP, VENDORED } from "@/lib/tradeoffs/data";
import {
  FAMILY_LABEL,
  HARDWARE,
  METRICS,
  WORKLOADS,
} from "@/lib/tradeoffs/metrics";
import { caveats } from "@/lib/tradeoffs/values";
import { simFile, SIM_REPO } from "@/lib/site";

export const metadata = {
  title: "Method",
  description:
    "How the trade-off sweep was run: the cluster, the levers, the workloads and their sources, capacity under SLOs, illustrative prices, and every modelling caveat.",
};

const A =
  "focus-ring rounded text-accent underline underline-offset-2 dark:text-indigo-300";

/** Plain URLs and arXiv ids in the workloads' rationales become links. */
function linkify(s: string): (string | JSX.Element)[] {
  const out: (string | JSX.Element)[] = [];
  const re = /arXiv:(\d{4}\.\d{5})|doi:(10\.\d{4,}\/[^\s),;]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    out.push(s.slice(last, m.index));
    const href = m[1]
      ? `https://arxiv.org/abs/${m[1]}`
      : `https://doi.org/${m[2]}`;
    out.push(
      <a key={m.index} href={href} className={A}>
        {m[0]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  out.push(s.slice(last));
  return out;
}

export default function MethodPage(): JSX.Element {
  const cav = caveats();
  const commit = VENDORED.commit;
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-accent dark:text-indigo-300">
        /method
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        How the sweep was run
      </h1>
      <div className="mdx-content mt-6">
        <p>
          Every number on this site comes from one recorded sweep of{" "}
          <a href={SIM_REPO} className={A}>
            Disaggregated_Inference_Sim
          </a>
          , a discrete-event simulator of LLM serving with a roofline cost model
          and a power model:{" "}
          <a href={simFile(commit, "examples/tradeoffs.py")} className={A}>
            examples/tradeoffs.py
          </a>{" "}
          wrote{" "}
          <a href={simFile(commit, "examples/tradeoffs.json")} className={A}>
            examples/tradeoffs.json
          </a>{" "}
          at simulator commit <code>{SWEEP.meta.simulator_commit}</code>,{" "}
          <V of="meta.points" fmt="int" /> configurations in{" "}
          <V of="meta.wall_min" fmt="int" /> minutes on{" "}
          <V of="meta.workers" fmt="int" /> workers. This site vendors that
          file, the simulator&apos;s JavaScript engine and its results.md byte
          for byte at commit <code>{commit.slice(0, 7)}</code> (the code is
          unchanged since the sweep ran).
        </p>

        <h2>The cluster and the levers</h2>
        <p>
          Every configuration is the same <V of="meta.gpus" fmt="int" /> GPUs
          serving <V of="meta.model" />. The baseline is{" "}
          {SWEEP.levers.baseline!.label.replace(/^2 x/, "two instances of")};
          each lever changes that (the combined rows change several things at
          once):
        </p>
        <MdxTable>
          <thead>
            <tr>
              <th className="p-2 text-left">Family</th>
              <th className="p-2 text-left">Lever</th>
            </tr>
          </thead>
          <tbody>
            {LEVER_KEYS.map((k) => (
              <tr
                key={k}
                className="border-t border-neutral-200 dark:border-neutral-800"
              >
                <td className="p-2">{FAMILY_LABEL[SWEEP.levers[k]!.family]}</td>
                <td className="p-2">
                  {SWEEP.levers[k]!.label}
                  {SWEEP.levers[k]!.hardware
                    ? ` (${SWEEP.levers[k]!.hardware!.join(", ").toUpperCase()} only)`
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </MdxTable>

        <h2>What is measured</h2>
        <ul>
          <li>
            <strong>Capacity</strong>: the highest arrival rate at which at
            least <V of="meta.slo_target" fmt="pct" /> of requests meet both
            SLOs (time to first token and time per output token),
            DistServe&apos;s goodput (
            <a href="https://arxiv.org/abs/2401.09670" className={A}>
              arXiv:2401.09670
            </a>
            ), found by doubling and then bisection; rejected requests count as
            misses. At capacity the sweep records goodput and output tokens per
            second per GPU, cost per million output tokens (at the illustrative
            prices below) and joules per output token (the power model, static
            power included).
          </li>
          <li>
            <strong>Latency</strong>: TTFT, TPOT and ITL p50 and p99, and KV
            occupancy, at each workload&apos;s reference load: half the H100
            baseline&apos;s capacity, the same offered load for every lever.
          </li>
          <li>
            Multi-turn workloads run closed-loop sessions; offline batch is
            measured saturated (every request at once). One model, one seed (
            <V of="meta.seed" fmt="int" />
            ), and capacity is found to a tolerance, so results near an SLO
            cliff are noisy. <strong>Accuracy is not simulated</strong>: what a
            number format does to accuracy is on Numerics Explained.
          </li>
        </ul>
        <p>The metrics, and which way is better:</p>
        <MdxTable>
          <thead>
            <tr>
              <th className="p-2 text-left">Metric</th>
              <th className="p-2 text-left">Meaning</th>
              <th className="p-2 text-left">Better</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(METRICS).map((m) => (
              <tr
                key={m.key}
                className="border-t border-neutral-200 dark:border-neutral-800"
              >
                <td className="p-2">{m.label}</td>
                <td className="p-2">{m.long}</td>
                <td className="p-2">
                  {m.better === "max" ? "higher" : "lower"}
                </td>
              </tr>
            ))}
          </tbody>
        </MdxTable>

        <h2>The workloads</h2>
        <p>
          Each is a named, parameterised distribution in the simulator, with its
          source or rationale:
        </p>
        <MdxTable>
          <thead>
            <tr>
              <th className="p-2 text-left">Workload</th>
              <th className="p-2 text-right">Prompt (mean)</th>
              <th className="p-2 text-right">Output (mean)</th>
              <th className="p-2 text-right">Turns</th>
              <th className="p-2 text-right">SLOs (TTFT, TPOT)</th>
            </tr>
          </thead>
          <tbody>
            {WORKLOADS.map((w) => {
              const x = SWEEP.workloads[w];
              return (
                <tr
                  key={w}
                  className="border-t border-neutral-200 dark:border-neutral-800"
                >
                  <td className="p-2">{x.label}</td>
                  <td className="p-2 text-right font-mono">
                    {fixed(x.prompt_mean, 0)}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {fixed(x.output_mean, 0)}
                  </td>
                  <td className="p-2 text-right font-mono">{x.turns}</td>
                  <td className="p-2 text-right font-mono">
                    {METRICS.ttft_p99.fmt(x.ttft_slo)},{" "}
                    {METRICS.ttft_p99.fmt(x.tpot_slo)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </MdxTable>
        <ul>
          {WORKLOADS.map((w) => (
            <li key={w}>
              <strong>{SWEEP.workloads[w].label}.</strong>{" "}
              {linkify(SWEEP.workloads[w].rationale)}
            </li>
          ))}
        </ul>

        <h2>The devices</h2>
        <MdxTable>
          <thead>
            <tr>
              <th className="p-2 text-left">Device</th>
              <th className="p-2 text-right">BF16 TFLOP/s</th>
              <th className="p-2 text-right">HBM TB/s</th>
              <th className="p-2 text-right">HBM GB</th>
              <th className="p-2 text-left">Faster formats</th>
              <th className="p-2 text-right">$/GPU-hour (illustrative)</th>
            </tr>
          </thead>
          <tbody>
            {HARDWARE.map((h) => {
              const d = SWEEP.hardware[h];
              return (
                <tr
                  key={h}
                  className="border-t border-neutral-200 dark:border-neutral-800"
                >
                  <td className="p-2">{d.name}</td>
                  <td className="p-2 text-right font-mono">
                    {fixed(d.bf16_tflops, 0)}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {fixed(d.hbm_tb_s, 2)}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {fixed(d.hbm_gb, 0)}
                  </td>
                  <td className="p-2 font-mono">
                    {Object.entries(d.native_formats)
                      .map(([f, x]) => `${f.toUpperCase()} ${x}×`)
                      .join(", ")}
                  </td>
                  <td className="p-2 text-right font-mono">
                    ${fixed(d.usd_per_gpu_hour, 2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </MdxTable>

        <h2 id="caveats">Caveats</h2>
        <p>
          These are marked wherever the numbers they affect appear (the letter
          beside a matrix cell, the list under each chart):
        </p>
        {CAVEAT_ORDER.map((k) => (
          <section key={k} id={`caveat-${k}`} className="scroll-mt-6">
            <h3>
              <span className="mr-2 font-mono">{cav[k].mark}</span>
              {cav[k].short}
            </h3>
            <p>{cav[k].long}</p>
          </section>
        ))}

        <h2>Provenance</h2>
        <p>
          The vendored files, their commit and their SHA-256 (
          <code>src/lib/tradeoffs/vendor/VENDORED.json</code>, checked by the
          unit tests and re-read from the simulator&apos;s repository in CI):
        </p>
        <ul>
          {VENDORED.files.map((f) => (
            <li key={f.path}>
              <a href={simFile(commit, f.path)} className={A}>
                {f.path}
              </a>{" "}
              <code className="break-all">{f.sha256}</code>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
