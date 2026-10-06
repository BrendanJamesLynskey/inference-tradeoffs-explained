/**
 * scripts/vendor-tradeoffs.ts
 *
 * Vendor the three files this site is built on from Disaggregated_Inference_Sim
 * at a pinned commit, and record which one:
 *
 *     pnpm vendor <commit> [path/to/Disaggregated_Inference_Sim]
 *
 * - `web/sim_engine.js`: the simulator's own JavaScript engine (bit-exact
 *   with its Python package, tested there), which the live what-if runs;
 * - `examples/tradeoffs.json`: the recorded trade-off sweep (levers ×
 *   workloads × hardware, every metric), the site's single number source;
 * - `examples/results.md`: the simulator's recorded results, which the
 *   tests read to check the site's derived tables (sign changes) and the
 *   validation numbers the site quotes against the simulator's own text.
 *
 * Each file is copied byte for byte from `git show <commit>:<path>` (never
 * from the working tree, so local edits cannot leak in) into
 * `src/lib/tradeoffs/vendor/`, and `VENDORED.json` next to them records the
 * repository, the full commit hash, its date and each file's SHA-256. The
 * commit must already be on the simulator's `origin`, so anyone can check
 * the pin. tests/unit/vendor.test.ts fails if a copy, a recorded hash or the
 * fixtures' commit disagree; CI's "Data and fixtures" job re-reads all three
 * files from the simulator's repository at that commit and compares them.
 *
 * After vendoring, regenerate the recorded workloads and parity fixtures at
 * the same commit:
 *
 *     <sim>/.venv/bin/python scripts/tradeoffs_reference.py <sim>
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const FILES = [
  { path: "web/sim_engine.js", dest: "sim_engine.js" },
  { path: "examples/tradeoffs.json", dest: "tradeoffs.json" },
  { path: "examples/results.md", dest: "results.md" },
] as const;

const ref = process.argv[2];
if (!ref) {
  console.error(
    "usage: pnpm vendor <commit> [path/to/Disaggregated_Inference_Sim]",
  );
  process.exit(2);
}
const sim = resolve(
  process.argv[3] ?? join(process.cwd(), "..", "Disaggregated_Inference_Sim"),
);
const git = (...args: string[]): string =>
  execFileSync("git", ["-C", sim, ...args], { encoding: "utf-8" }).trim();

const commit = git("rev-parse", "--verify", `${ref}^{commit}`);
const remote = git("branch", "-r", "--contains", commit);
if (!/origin\//.test(remote)) {
  console.error(`${commit} is not on origin: push it before vendoring.`);
  process.exit(1);
}
const dest = join(process.cwd(), "src", "lib", "tradeoffs", "vendor");
const files = FILES.map((f) => {
  const source = execFileSync("git", [
    "-C",
    sim,
    "show",
    `${commit}:${f.path}`,
  ]);
  writeFileSync(join(dest, f.dest), source);
  const sha256 = createHash("sha256").update(source).digest("hex");
  console.log(`vendored ${f.path} @ ${commit.slice(0, 7)} (${sha256})`);
  return { path: f.path, file: f.dest, sha256 };
});
const record = {
  repository:
    "https://github.com/BrendanJamesLynskey/Disaggregated_Inference_Sim",
  commit,
  committed: git("show", "-s", "--format=%cI", commit),
  files,
};
writeFileSync(
  join(dest, "VENDORED.json"),
  JSON.stringify(record, null, 2) + "\n",
);
