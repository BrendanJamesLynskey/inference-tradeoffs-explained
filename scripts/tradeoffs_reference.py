"""Write the recorded workloads and the engine-parity fixtures from Disaggregated_Inference_Sim.

The site's numbers come from the simulator's recorded trade-off sweep (`examples/tradeoffs.json`) and its live
what-if runs the simulator's own JavaScript engine (`web/sim_engine.js`), both vendored byte for byte at the
commit in `src/lib/tradeoffs/vendor/VENDORED.json` (`pnpm vendor`). This script runs the Python package at that
same commit and writes:

* `public/tradeoffs/workloads/<workload>.json`: each named workload exactly as the sweep generated it at the
  workload's reference load (seed 1, the sweep's own request count), so the browser replays the very requests
  Python used. (The simulator's JavaScript port has no generator for the multi-turn session workloads, and
  Python's Mersenne Twister would differ from V8's Math.log in the last bit anyway, so the rows are recorded.)
* `tests/fixtures/tradeoffs_parity.json`: engine parity. Fourteen sweep configurations across every lever
  family, built the sweep's way (`examples/tradeoffs.py` `config`), each with the SHA-256 of every request's
  seven timestamps as IEEE-754 doubles, the timestamps of its first requests and of the 24 the what-if
  timeline draws, and its summary (latency percentiles,
  energy, scheduler statistics). The unit tests run the vendored engine on the point's recorded `js_cfg` and the
  recorded rows and require the same digest, so the browser's configuration is the sweep's configuration.

Run with the simulator's virtualenv (simpy), the simulator checked out at the vendored commit:

    ../Disaggregated_Inference_Sim/.venv/bin/python scripts/tradeoffs_reference.py [path/to/sim] [--check]

`--check` writes nothing: it regenerates everything in memory, checks the simulator checkout is the vendored
commit and that its two vendored files have the recorded hashes, and fails if any committed file differs.
"""

from __future__ import annotations

import hashlib
import json
import math
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
CHECK = "--check" in sys.argv
SIM = Path(args[0]).resolve() if args else ROOT.parent / "Disaggregated_Inference_Sim"
sys.path.insert(0, str(SIM / "src"))
sys.path.insert(0, str(SIM / "examples"))

import tradeoffs as T  # noqa: E402  (the sweep script itself, at the vendored commit)
from disagg_sim.metrics import summarise  # noqa: E402
from disagg_sim.sim import simulate  # noqa: E402
from disagg_sim.workload import WORKLOADS, workload_rows  # noqa: E402

VENDOR = ROOT / "src/lib/tradeoffs/vendor"
VENDORED = json.loads((VENDOR / "VENDORED.json").read_text())
SWEEP = json.loads((VENDOR / "tradeoffs.json").read_text())
OUT_WL = ROOT / "public/tradeoffs/workloads"
OUT_FIX = ROOT / "tests/fixtures/tradeoffs_parity.json"

# (workload, hardware, lever): every lever family, every workload and device at least once
CASES = [
    ("chat", "h100", "baseline"),
    ("chat", "h100", "chunked-512"),
    ("chat", "h100", "prefix-cache"),
    ("chat", "h100", "disagg-levers"),
    ("chat", "h100", "spec-mtp"),
    ("chat", "h200", "modern-spec"),
    ("voice", "h100", "paged-swap"),
    ("voice", "h100", "tp8"),
    ("coding-agent", "h200", "modern-disagg"),
    ("coding-agent", "h100", "decode-priority"),
    ("long-rag", "b200", "w4a4-fp4"),
    ("long-rag", "h100", "tp2pp2"),
    ("offline-batch", "h100", "fp8-all"),
    ("offline-batch", "b200", "disagg-2p1d"),
]
STAMPS = ("arrival", "prefill_start", "first_token", "kv_start", "kv_ready", "decode_start", "finish")
NAN = struct.pack("<Q", 0x7FF8000000000000)


def git(*a: str) -> str:
    return subprocess.run(["git", "-C", str(SIM), *a], capture_output=True, text=True, check=True).stdout.strip()


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def stamp_digest(reqs) -> str:
    """SHA-256 of every request's seven timestamps as little-endian doubles (None as the canonical NaN)."""
    h = hashlib.sha256()
    for r in reqs:
        for k in STAMPS:
            v = getattr(r, k)
            h.update(NAN if v is None else struct.pack("<d", float(v)))
    return h.hexdigest()


def clean(x):
    if isinstance(x, float) and not math.isfinite(x):
        return None
    if isinstance(x, dict):
        return {k: clean(v) for k, v in x.items()}
    if isinstance(x, list):
        return [clean(v) for v in x]
    return x


def dumps(obj) -> str:
    return json.dumps(clean(obj), separators=(",", ":")) + "\n"


def workload(name: str):
    rate = SWEEP["workloads"][name]["reference_rate"]
    n = T.n_requests(name, rate)
    return rate, n, WORKLOADS[name].generate(rate, n, seed=T.SEED)


def main() -> int:
    commit = VENDORED["commit"]
    head = git("rev-parse", "HEAD")
    if head != commit:
        print(f"the simulator checkout is at {head[:7]}, the vendored commit is {commit[:7]}", file=sys.stderr)
        return 1
    for f in VENDORED["files"]:
        src = (SIM / f["path"]).read_bytes()
        if sha(src) != f["sha256"] or (VENDOR / f["file"]).read_bytes() != src:
            print(f"{f['path']}: the vendored copy or its recorded hash differs from the simulator's", file=sys.stderr)
            return 1

    files: dict[Path, str] = {}
    rows_of = {}
    for name in SWEEP["workloads"]:
        rate, n, reqs = workload(name)
        rows = workload_rows(reqs)
        rows_of[name] = reqs
        files[OUT_WL / f"{name}.json"] = dumps({"commit": commit, "workload": name, "rate": rate, "seed": T.SEED,
                                                "n": n, "rows": rows})

    cases = []
    for w, hw, lever in CASES:
        point = next(p for p in SWEEP["points"] if (p["workload"], p["hardware"], p["lever"]) == (w, hw, lever))
        over = next(o for k, _f, _l, o, _h in T.LEVERS if k == lever)
        _rate, _n, reqs = workload(w)
        res = simulate(T.config(hw, w, over), reqs)
        m = summarise(res)
        lat = m["latency_s"]
        s = m.get("scheduler", {})
        summary = {"ttft_p50": lat["ttft"]["p50"], "ttft_p99": lat["ttft"]["p99"], "tpot_p50": lat["tpot"]["p50"],
                   "tpot_p99": lat["tpot"]["p99"], "itl_p50": lat["itl"]["p50"], "itl_p99": lat["itl"]["p99"],
                   "completed": m["requests"]["completed"], "rejected": m["requests"]["rejected"],
                   "total_J": m["energy"]["total_J"], "preemptions": s.get("preemptions", 0),
                   "prefix_hit_tokens": s.get("prefix_cache", {}).get("hit_tokens", 0),
                   "tokens_per_verify": s.get("speculative", {}).get("tokens_per_verify", 0.0)}
        # the sweep recorded these at the same load: the reference run must reproduce them
        for k in ("ttft_p50", "ttft_p99", "tpot_p50", "tpot_p99", "itl_p50", "itl_p99"):
            if summary[k] != point["metrics"][k]:
                print(f"{w}/{hw}/{lever}: {k} {summary[k]} != the sweep's {point['metrics'][k]}", file=sys.stderr)
                return 1
        cases.append({"name": f"{w} / {hw} / {lever}", "workload": w, "hardware": hw, "lever": lever,
                      "cfg": point["js_cfg"], "stamps_sha256": stamp_digest(res.requests),
                      "first": [[getattr(r, k) for k in STAMPS] for r in res.requests[:5]],
                      # the requests the what-if timeline draws (src/lib/tradeoffs/timeline.ts `lanes`)
                      "lane_start": len(res.requests) // 10,
                      "lanes": [[getattr(r, k) for k in STAMPS]
                                for r in res.requests[len(res.requests) // 10:len(res.requests) // 10 + 24]],
                      "requests": len(res.requests), "summary": summary})
    files[OUT_FIX] = dumps({"simulator": VENDORED["repository"], "commit": commit, "cases": cases})

    bad = 0
    for path, text in files.items():
        if CHECK:
            if not path.exists() or path.read_text() != text:
                print(f"out of date: {path.relative_to(ROOT)}", file=sys.stderr)
                bad += 1
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
            print(f"wrote {path.relative_to(ROOT)} ({len(text):,} bytes)")
    if CHECK and not bad:
        print(f"up to date: {len(files)} files at {commit[:7]}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
