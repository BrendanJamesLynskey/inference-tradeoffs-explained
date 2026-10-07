"""Write the chapter animations' state sequences from Disaggregated_Inference_Sim's own Python package.

Every mechanism animation on the chapter pages is a sequence of states the simulator computed, not a drawing:
this script runs small, named scenarios through the real simulator (`disagg_sim.sim.simulate`, at the commit
in `src/lib/tradeoffs/vendor/VENDORED.json`) and records, without changing what it does:

* every forward pass ("step") of every instance: when it started, how long it took, its label, what bound it
  (compute, memory, power), its dynamic joules, its communication and draft time, the KV memory in use and,
  for the scheduled instances (the brief 20A1/20A2 levers), every running row's state: prompt tokens computed,
  output tokens, KV units held, cached tokens covering it, plus the queue, the swapped rows and the prefix
  cache's segments;
* what each row did in each step (prompt tokens computed, output tokens emitted), from the next record of that
  row (its next step, its preemption or its finish);
* preemptions (recompute or swap), finishes and KV hand-offs (with the bytes on the link);
* every request's timestamps, and the SHA-256 of them as IEEE-754 doubles: the unit tests run the vendored
  JavaScript engine on the same configuration and rows and require the same digest, so the animation's
  timing is exactly the live engine's.

It also writes cost-model tables (`cost_model.json`) for the parallelism and quantisation chapters, whose
animations call the vendored engine's cost model live: the tests check the engine against these numbers.

The recording wraps `Instance.step`, `ScheduledInstance.preempt`, `Simulation.finish` and
`Simulation.transfer` and only reads state; each scenario is run a second time unwrapped and must give the
same timestamps (checked here).

    ../Disaggregated_Inference_Sim/.venv/bin/python scripts/mechanisms_reference.py [path/to/sim] [--check]

`--check` writes nothing and fails if any committed file differs from what the simulator gives.
"""

from __future__ import annotations

import hashlib
import json
import math
import struct
import subprocess
import sys
from dataclasses import replace
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith("--")]
CHECK = "--check" in sys.argv
SIM = Path(args[0]).resolve() if args else ROOT.parent / "Disaggregated_Inference_Sim"
sys.path.insert(0, str(SIM / "src"))

from disagg_sim import sim as S  # noqa: E402
from disagg_sim.hardware import (ACCELERATORS, KV_PRESETS, LINKS, MODELS, QUANT_FORMATS, CostModel,  # noqa: E402
                                 KVTransit, Parallel)
from disagg_sim.metrics import summarise  # noqa: E402
from disagg_sim.speculative import Speculative  # noqa: E402
from disagg_sim.workload import LengthDist, Request, chat_sessions, poisson_workload, workload_rows  # noqa: E402

VENDOR = ROOT / "src/lib/tradeoffs/vendor"
VENDORED = json.loads((VENDOR / "VENDORED.json").read_text())
OUT = ROOT / "public/tradeoffs/mechanisms"
STAMPS = ("arrival", "prefill_start", "first_token", "kv_start", "kv_ready", "decode_start", "finish")
NAN = struct.pack("<Q", 0x7FF8000000000000)


# ───────────────────────────────────────────────────────────── configs ──
def py_config(c: dict) -> S.SimConfig:
    """The Python SimConfig a JavaScript engine configuration means (the engine's keys are camelCase)."""
    def dev(key):
        if key is None:
            return None
        d = ACCELERATORS[key]
        e = c.get("engine", {})
        if d.transform is not None and e:
            names = {"enob": "enob", "maskRate": "mask_rate_hz", "detection": "detection", "overlap": "overlap"}
            d = replace(d, transform=replace(d.transform, **{names[k]: v for k, v in e.items() if k in names}))
        return d

    model = MODELS[c["model"]]
    if "lmHead" in c:
        model = replace(model, prefill_lm_head=c["lmHead"])
    if "cedReplayOn" in c:
        model = replace(model, ced_replay_on=c["cedReplayOn"])
    tr = None
    if "kvCompress" in c:
        tr = KVTransit(KV_PRESETS[c["kvCompress"]], where=c.get("kvCompressAt", "transit"))
    spec = c.get("speculative")
    kw = dict(
        model=model, device=dev(c.get("device", "h100")), devices_per_instance=c.get("devicesPerInstance", 4),
        mode=c.get("mode", "disagg"), n_prefill=c.get("nPrefill", 1), n_decode=c.get("nDecode", 1),
        n_colocated=c.get("nColocated", 2), link=LINKS[c.get("link", "ib-ndr")], power_cap_w=c.get("powerCap"),
        dvfs=c.get("dvfs", False), prefill_device=dev(c.get("prefillDevice")), decode_device=dev(c.get("decodeDevice")),
        kv_transit=tr, batch_policy=c.get("batchPolicy", "prefill-priority"),
        max_num_batched_tokens=c.get("maxNumBatchedTokens"), kv_policy=c.get("kvPolicy", "oracle"),
        kv_block_size=c.get("kvBlockSize", 16), preemption=c.get("preemption", "recompute"),
        host_link=LINKS[c.get("hostLink", "pcie5")], prefix_caching=c.get("prefixCaching", False),
        speculative=Speculative(**spec) if spec else None, max_decode_batch=c.get("maxDecodeBatch", 256),
        ttft_slo=c.get("ttftSlo", 1.0), tpot_slo=c.get("tpotSlo", 0.025))
    return S.SimConfig(**kw)


def requests_of(rows: list) -> list[Request]:
    out = []
    for i, row in enumerate(rows):
        r = Request(i, float(row[0]), int(row[1]), int(row[2]))
        if len(row) > 3:
            x = row[3]
            r.prefix = tuple((k, int(v)) for k, v in x["chain"])
            r.emit_key, r.after, r.think = x["emit"], x["after"], float(x["think"])
        out.append(r)
    return out


# ──────────────────────────────────────────────────────────── recorder ──
class Recorder:
    """Wraps the simulator's step, preemption, finish and hand-off methods; reads state only."""

    def __init__(self):
        self.log: list[tuple] = []
        self.handoffs: dict[int, float] = {}
        self._orig = {}

    def __enter__(self):
        rec = self
        o = self._orig
        o["step"] = S.Instance.step
        o["preempt"] = S.ScheduledInstance.preempt
        o["finish"] = S.Simulation.finish
        o["transfer"] = S.Simulation.transfer

        def step(inst, kind, cost, label, batch):
            snap = rec.snapshot(inst, kind, cost, label)
            rec.log.append(("step", inst, snap))
            yield from o["step"](inst, kind, cost, label, batch)

        def preempt(inst, r):
            state = (r.done_prompt, r.tokens_out)
            o["preempt"](inst, r)
            mode = "swap" if r in getattr(inst, "swapped", []) else "recompute"
            rec.log.append(("preempt", inst, {"t": inst.env.now, "rid": r.rid, "state": state, "mode": mode}))

        def finish(sim, r, t=None):
            o["finish"](sim, r, t)
            rec.log.append(("finish", None, {"t": r.finish, "rid": r.rid,
                                             "state": (r.done_prompt or r.prompt_len, r.tokens_out)}))

        def transfer(sim, r):
            res = o["transfer"](sim, r)
            rec.handoffs[r.rid] = res[1]
            return res

        S.Instance.step = step
        S.ScheduledInstance.preempt = preempt
        S.Simulation.finish = finish
        S.Simulation.transfer = transfer
        return self

    def __exit__(self, *exc):
        S.Instance.step = self._orig["step"]
        S.ScheduledInstance.preempt = self._orig["preempt"]
        S.Simulation.finish = self._orig["finish"]
        S.Simulation.transfer = self._orig["transfer"]

    @staticmethod
    def snapshot(inst, kind, cost, label) -> dict:
        now = inst.env.now
        snap = {"inst": inst.name, "t0": now, "dt": cost.time, "label": label, "bound": cost.bound,
                "ec": cost.compute_j, "em": cost.memory_j, "comm": getattr(cost, "comm_time", 0.0),
                "draft": getattr(cost, "draft_time", 0.0), "kv": inst.kv_used, "cap": inst.kv_cap}
        if isinstance(inst, S.ScheduledInstance):
            snap["rows"] = [[r.rid, r.done_prompt, r.target, r.tokens_out, r.alloc, r.covered, r.base_out]
                            for r in inst.running]
            snap["queue"] = [r.rid for r in inst.queue]
            snap["swapped"] = [r.rid for r in inst.swapped]
            snap["swap_t"] = inst.swap_t
            if inst.cache is not None:
                snap["cache"] = [[n.key, n.tokens, n.units, n.refs] for n in
                                 sorted(inst.cache.nodes.values(), key=lambda n: n.seq)]
        else:
            # the plain instances reserve each request's whole KV at admission (Instance.kv_need)
            snap["rows"] = [[r.rid, r.prompt_len, r.prompt_len, r.tokens_out, inst.kv_need(r), 0, 0]
                            for r in inst.running]
        return snap


def digest(reqs) -> str:
    h = hashlib.sha256()
    for r in reqs:
        for k in STAMPS:
            v = getattr(r, k)
            h.update(NAN if v is None else struct.pack("<d", float(v)))
    return h.hexdigest()


# the JavaScript engine has no defaults for these: every scenario's configuration is written out in full
DEFAULTS = {"device": "h100", "devicesPerInstance": 4, "mode": "disagg", "nPrefill": 1, "nDecode": 1,
            "nColocated": 2, "link": "ib-ndr"}


def run_variant(key: str, label: str, cfg: dict, rows: list) -> dict:
    cfg = {**DEFAULTS, **cfg}
    plain = requests_of(rows)
    S.simulate(py_config(cfg), plain)
    reqs = requests_of(rows)
    with Recorder() as rec:
        res = S.simulate(py_config(cfg), reqs)
    if digest(reqs) != digest(plain):
        raise SystemExit(f"{key}: the recorder changed the simulation")
    m = summarise(res)
    names = [i.name for i in res.instances]
    steps, events = [], []
    log = rec.log
    for idx, (what, inst, d) in enumerate(log):
        if what == "step":
            d = dict(d)
            d["inst"] = names.index(d["inst"])
            # what each row did in this step: its next record (next step on this instance, preemption, finish)
            work = []
            for rid, dp, _tg, to, _al, _cv, _bo in d["rows"]:
                after = None
                for what2, inst2, d2 in log[idx + 1:]:
                    if what2 == "step" and inst2 is inst:
                        hit = next((x for x in d2["rows"] if x[0] == rid), None)
                        if hit is not None:
                            after = (hit[1], hit[3])
                            break
                    elif what2 in ("preempt", "finish") and d2["rid"] == rid:
                        after = d2["state"]
                        break
                if after is None:
                    r = reqs[rid]
                    after = (r.done_prompt, r.tokens_out)
                work.append([rid, max(0, after[0] - dp), max(0, after[1] - to)])
            d["work"] = work
            steps.append(d)
        elif what == "preempt":
            events.append([d["t"], "preempt-" + d["mode"], d["rid"], names.index(inst.name)])
        else:
            events.append([d["t"], "finish", d["rid"], -1])
    lat = m["latency_s"]
    sched = m.get("scheduler", {}) or {}
    summary = {
        "ttft_p50": lat["ttft"]["p50"], "ttft_p99": lat["ttft"]["p99"], "tpot_p50": lat["tpot"]["p50"],
        "tpot_p99": lat["tpot"]["p99"], "itl_p99": lat["itl"]["p99"], "completed": m["requests"]["completed"],
        "j_per_tok": m["energy"]["J_per_output_token"], "total_J": m["energy"]["total_J"],
        "preemptions": sched.get("preemptions", 0),
        "hit_rate": sched.get("prefix_cache", {}).get("hit_rate", 0.0),
        "tokens_per_verify": sched.get("speculative", {}).get("tokens_per_verify", 0.0),
    }
    return {
        "key": key, "label": label, "cfg": cfg, "rows": rows, "insts": names,
        "blk": [getattr(i, "blk", 1) for i in res.instances],
        "idle_w": [i.cost.idle_w for i in res.instances],
        "steps": steps, "events": events,
        "reqs": [[getattr(r, k) for k in STAMPS] + [r.prompt_len, r.output_len, len(r.itls),
                                                     sum(1 for x in r.itls if x == 0.0)] for r in reqs],
        "handoff_bytes": [rec.handoffs.get(r.rid) for r in reqs],
        "stamps_sha256": digest(reqs), "horizon": res.horizon, "summary": summary,
    }


# ─────────────────────────────────────────────────────────── scenarios ──
def batching() -> dict:
    """Chapter 1: decodes running when two long prompts arrive (Mistral-7B, one A100; section 19's setting)."""
    rows = [[0.0, 300, 48], [0.002, 420, 48], [0.004, 260, 48], [0.006, 380, 48],
            [0.12, 1800, 12], [0.16, 1500, 12]]
    base = {"model": "mistral-7b", "device": "a100", "devicesPerInstance": 1, "mode": "colocated", "nColocated": 1}
    v = [("prefill-priority", "Prefill-priority", {}),
         ("decode-priority", "Decode-priority", {"batchPolicy": "decode-priority"}),
         ("chunked-256", "Chunked, 256-token budget", {"batchPolicy": "chunked", "maxNumBatchedTokens": 256}),
         ("chunked-512", "Chunked, 512-token budget", {"batchPolicy": "chunked", "maxNumBatchedTokens": 512}),
         ("chunked-2048", "Chunked, 2,048-token budget", {"batchPolicy": "chunked", "maxNumBatchedTokens": 2048})]
    return {"title": "Batching policy", "variants": [run_variant(k, lab, {**base, **o}, rows) for k, lab, o in v]}


def paged() -> dict:
    """Chapter 2: requests outgrow the KV memory (OPT-13B on one A100-40GB, section 20's setting)."""
    reqs = poisson_workload(12.0, 18, LengthDist(700, 0.4, hi=1024), LengthDist(420, 0.4, hi=1024), seed=3)
    rows = workload_rows(reqs)
    base = {"model": "opt-13b", "device": "a100-40g", "devicesPerInstance": 1, "mode": "colocated",
            "nColocated": 1}
    # reserved KV in the scheduled instance too (a token budget equal to the default max_prefill_tokens changes
    # nothing but the class), so both variants record each row's allocation
    v = [("oracle", "Reserved (prompt + output up front)", {"maxNumBatchedTokens": 8192}),
         ("paged", "Paged blocks, preempt by recompute", {"kvPolicy": "paged", "kvBlockSize": 64}),
         ("paged-swap", "Paged blocks, preempt by swap to host",
          {"kvPolicy": "paged", "kvBlockSize": 64, "preemption": "swap", "hostLink": "pcie4"})]
    return {"title": "KV memory", "variants": [run_variant(k, lab, {**base, **o}, rows) for k, lab, o in v]}


def prefix() -> dict:
    """Chapter 3: multi-turn sessions sharing system prompts (Mistral-7B, one A100)."""
    reqs = chat_sessions(3.0, 12, LengthDist(200, 0.3), LengthDist(24, 0.3), seed=5, turns=3, think=0.15,
                         system_prompts=2, system_len=1024)
    rows = workload_rows(reqs)
    base = {"model": "mistral-7b", "device": "a100", "devicesPerInstance": 1, "mode": "colocated",
            "nColocated": 1, "kvPolicy": "paged"}
    v = [("off", "Prefix caching off", {}), ("on", "Prefix caching on", {"prefixCaching": True})]
    return {"title": "Prefix caching", "variants": [run_variant(k, lab, {**base, **o}, rows) for k, lab, o in v]}


def pools() -> dict:
    """Chapter 4: the same 8 GPUs colocated or split into a prefill and a decode pool (Llama-3-70B)."""
    reqs = poisson_workload(4.0, 14, LengthDist(2048, 0.5), LengthDist(96, 0.5), seed=2)
    rows = workload_rows(reqs)
    base = {"model": "llama3-70b", "device": "h100", "devicesPerInstance": 4}
    v = [("colocated", "Colocated, 2 x 4 H100", {"mode": "colocated", "nColocated": 2}),
         ("1p1d", "Disaggregated 1P1D, 4 + 4 H100", {"mode": "disagg"})]
    return {"title": "Disaggregation", "variants": [run_variant(k, lab, {**base, **o}, rows) for k, lab, o in v]}


def hetero() -> dict:
    """Chapter 5: different hardware per pool (Llama-3-8B, section 10) and the optical prefill pool (section 11)."""
    reqs = poisson_workload(8.0, 14, LengthDist(2048, 0.5), LengthDist(48, 0.5), seed=1)
    rows = workload_rows(reqs)
    base = {"model": "llama3-8b", "device": "h100", "devicesPerInstance": 1, "mode": "disagg"}
    circ = {"model": "llama3-8b-hyena-circ", "lmHead": "last", "device": "h100", "devicesPerInstance": 1,
            "mode": "disagg"}
    v = [("h100-h100", "H100 prefill, H100 decode", base),
         ("h100-a100", "H100 prefill, A100 decode", {**base, "decodeDevice": "a100"}),
         ("a100-h100", "A100 prefill, H100 decode", {**base, "prefillDevice": "a100"}),
         ("circ-gpu", "FFT model: H100 prefill, H100 decode", circ),
         ("circ-optical", "FFT model: optical prefill (optimistic), H100 decode",
          {**circ, "prefillDevice": "optical-fft", "engine": {"enob": 11, "maskRate": 20000.0, "overlap": True}}),
         ("circ-optical-default", "FFT model: optical prefill (defaults), H100 decode",
          {**circ, "prefillDevice": "optical-fft"})]
    return {"title": "Heterogeneous pools", "variants": [run_variant(k, lab, o, rows) for k, lab, o in v]}


def handoff() -> dict:
    """Chapter 6: the KV hand-off link and compressing it (Llama-3-8B 1P1D, sections 14 and 15)."""
    reqs = poisson_workload(10.0, 14, LengthDist(2048, 0.5), LengthDist(48, 0.5), seed=4)
    rows = workload_rows(reqs)
    base = {"model": "llama3-8b", "device": "h100", "devicesPerInstance": 1, "mode": "disagg"}
    v = [("nvlink4", "NVLink 4", {"link": "nvlink4"}),
         ("ib-ndr", "InfiniBand NDR", {"link": "ib-ndr"}),
         ("eth-25g", "25 GbE", {"link": "eth-25g"}),
         ("eth-25g-fp8", "25 GbE, FP8 in transit", {"link": "eth-25g", "kvCompress": "fp8"}),
         ("eth-25g-fp4-gpu", "25 GbE, FP4 blocks at the GPU",
          {"link": "eth-25g", "kvCompress": "fp4-block", "kvCompressAt": "endpoint"})]
    return {"title": "KV hand-off", "variants": [run_variant(k, lab, {**base, **o}, rows) for k, lab, o in v]}


def ced() -> dict:
    """Chapter 7: long prompts, short outputs, decoder-only against CED (section 16's 70B shape, 1P1D)."""
    reqs = poisson_workload(1.2, 8, LengthDist(8192, 0.3), LengthDist(32, 0.3), seed=6)
    rows = workload_rows(reqs)
    base = {"device": "h100", "devicesPerInstance": 4, "mode": "disagg"}
    v = [("decoder-only", "Decoder-only Llama-3-70B shape", {"model": "llama3-70b"}),
         ("ced-prefill", "CED, replay on the prefill pool", {"model": "llama3-70b-ced"}),
         ("ced-decode", "CED, replay on the decode pool", {"model": "llama3-70b-ced", "cedReplayOn": "decode"})]
    return {"title": "Encoder-only prefill", "variants": [run_variant(k, lab, {**base, **o}, rows) for k, lab, o in v]}


def speculative() -> dict:
    """Chapter 10: draft tokens accepted or rejected (Llama-3-8B, one H100, MTP draft)."""
    rows = [[0.0, 512, 40], [0.001, 384, 40]]   # not simultaneous: see the README (engine tie order)
    base = {"model": "llama3-8b", "device": "h100", "devicesPerInstance": 1, "mode": "colocated", "nColocated": 1}
    v = [("off", "No speculation", {}),
         ("g3a07", "gamma 3, alpha 0.7", {"speculative": {"draft": "mtp", "gamma": 3, "alpha": 0.7, "seed": 0}}),
         ("g5a08", "gamma 5, alpha 0.8", {"speculative": {"draft": "mtp", "gamma": 5, "alpha": 0.8, "seed": 0}}),
         ("g3a04", "gamma 3, alpha 0.4", {"speculative": {"draft": "mtp", "gamma": 3, "alpha": 0.4, "seed": 0}})]
    return {"title": "Speculative decoding",
            "variants": [run_variant(k, lab, {**base, **o}, rows) for k, lab, o in v]}


def power() -> dict:
    """Chapter 11: per-step power of a colocated instance (Llama-3-70B on 4 H100s, sections 2 and 3)."""
    reqs = poisson_workload(3.0, 10, LengthDist(2048, 0.5), LengthDist(64, 0.5), seed=7)
    rows = workload_rows(reqs)
    base = {"model": "llama3-70b", "device": "h100", "devicesPerInstance": 4, "mode": "colocated", "nColocated": 1}
    v = [("default", "No cap", {}), ("dvfs", "DVFS on memory-bound steps", {"dvfs": True}),
         ("cap400", "400 W cap per GPU, DVFS", {"powerCap": 400.0, "dvfs": True}),
         ("cap300", "300 W cap per GPU, DVFS", {"powerCap": 300.0, "dvfs": True})]
    return {"title": "Power", "variants": [run_variant(k, lab, {**base, **o}, rows) for k, lab, o in v]}


# ───────────────────────────────────────────────────── cost-model tables ──
def step_row(c) -> list:
    return [c.time, c.flops, c.bytes, c.bound, c.compute_j, c.memory_j, getattr(c, "comm_time", 0.0)]


def cost_tables() -> dict:
    """Steps from the Python cost model, for the engine-driven animations of chapters 8 and 9."""
    m70 = MODELS["llama3-70b"]
    h100 = ACCELERATORS["h100"]
    tp = []
    for n in (2, 4, 8):
        cm = CostModel(m70, h100, n, 0.5e-3, parallel=Parallel(tp=n))
        tp.append({"tp": n, "decode_b1": step_row(cm.decode_sum(2048, 1)),
                   "decode_b64": step_row(cm.decode_sum(64 * 2048, 64)),
                   "prefill_8192": step_row(cm.prefill([8192])), "kv_tokens": cm.kv_capacity_tokens})
    pp = []
    for t, p, mb in ((4, 1, None), (2, 2, 1), (2, 2, 2), (2, 2, 4), (1, 4, 4)):
        cm = CostModel(m70, h100, t * p, 0.5e-3, parallel=Parallel(tp=t, pp=p, microbatches=mb))
        pp.append({"tp": t, "pp": p, "mb": mb, "prefill": step_row(cm.prefill([4096] * 4)),
                   "decode": step_row(cm.decode_sum(64 * 2048, 64))})
    formats = []
    for dev, wf, kf, cf in (("h100", "bf16", "bf16", "bf16"), ("h100", "fp8", "bf16", "bf16"),
                            ("h100", "fp8", "bf16", "fp8"), ("h100", "int4", "bf16", "bf16"),
                            ("h100", "fp4", "bf16", "bf16"), ("h100", "bf16", "fp8", "bf16"),
                            ("h100", "fp8", "fp8", "fp8"), ("b200", "bf16", "bf16", "bf16"),
                            ("b200", "fp8", "bf16", "fp8"), ("b200", "fp4", "bf16", "fp4")):
        m = replace(m70, weight_bytes=QUANT_FORMATS[wf], kv_bytes=QUANT_FORMATS[kf])
        d = ACCELERATORS[dev]
        sp = d.format_speedup(cf) if cf != "bf16" else 1.0
        cm = CostModel(m, d, 4, 0.5e-3, compute_speedup=sp)
        formats.append({"device": dev, "weights": wf, "kv": kf, "compute": cf, "speedup": sp,
                        "decode_b1": step_row(cm.decode_sum(2048, 1)),
                        "decode_b64": step_row(cm.decode_sum(64 * 2048, 64)),
                        "prefill_8192": step_row(cm.prefill([8192])), "kv_tokens": cm.kv_capacity_tokens})
    links = {k: [LINKS[k].bandwidth, LINKS[k].latency] for k in ("nvlink3", "nvlink4", "nvlink5", "pcie5")}
    return {"tp": tp, "pp": pp, "formats": formats, "links": links,
            "quant_bytes": {k: v for k, v in QUANT_FORMATS.items()}}


SCENARIOS = {"batching": batching, "paged": paged, "prefix": prefix, "pools": pools, "hetero": hetero,
             "handoff": handoff, "ced": ced, "speculative": speculative, "power": power}


def clean(x):
    if isinstance(x, float) and not math.isfinite(x):
        return None
    if isinstance(x, dict):
        return {k: clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [clean(v) for v in x]
    return x


def dumps(obj) -> str:
    return json.dumps(clean(obj), separators=(",", ":")) + "\n"


def main() -> int:
    commit = VENDORED["commit"]
    head = subprocess.run(["git", "-C", str(SIM), "rev-parse", "HEAD"], capture_output=True, text=True,
                          check=True).stdout.strip()
    if head != commit:
        print(f"the simulator checkout is at {head[:7]}, the vendored commit is {commit[:7]}", file=sys.stderr)
        return 1
    only = [a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")]
    files: dict[Path, str] = {}
    for name, fn in SCENARIOS.items():
        if only and name not in only:
            continue
        files[OUT / f"{name}.json"] = dumps({"commit": commit, "scenario": name, **fn()})
    if not only or "cost_model" in only:
        files[OUT / "cost_model.json"] = dumps({"commit": commit, **cost_tables()})
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
        print(f"up to date: {len(files)} mechanism files at {commit[:7]}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
