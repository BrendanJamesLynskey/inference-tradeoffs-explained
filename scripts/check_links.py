"""
Checks every external link in the chapters, pages, site data and README:
each must return 200 (a DOI that answers 403 to scripts is confirmed
through Crossref instead), and every link into one of the owner's slide
decks must point at an anchor that exists, with the slide's heading
printed so it can be compared with the link text. arXiv links are checked
at export.arxiv.org (title and first author printed).

    python3 scripts/check_links.py

Manual (network); not run in CI. opencompute.org answers 403 to curl's
default user agent, so a browser user agent is sent.
"""
from __future__ import annotations

import html
import json
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
FILES = (
    list((ROOT / "src").rglob("*.tsx"))
    + [f for f in (ROOT / "src").rglob("*.ts") if "vendor" not in f.parts]
    + [ROOT / "README.md", ROOT / "RUNBOOK.md"]
)
VENDOR = ROOT / "src/lib/tradeoffs/vendor"


def generated_links() -> set[str]:
    """Links the pages build from data: the workloads' cited arXiv ids and DOIs, and the vendored files at their commit."""
    sweep = json.loads((VENDOR / "tradeoffs.json").read_text())
    rec = json.loads((VENDOR / "VENDORED.json").read_text())
    out = set()
    for w in sweep["workloads"].values():
        out |= {f"https://arxiv.org/abs/{a}" for a in re.findall(r"arXiv:(\d{4}\.\d{5})", w["rationale"])}
        out |= {f"https://doi.org/{d}" for d in re.findall(r"doi:(10\.\d{4,}/[^\s),;]+)", w["rationale"])}
    for path in [f["path"] for f in rec["files"]] + ["examples/tradeoffs.py"]:
        out.add(f"{rec['repository']}/blob/{rec['commit']}/{path}")
    # the chapters' links into the companion sites and decks, built by src/lib/site.ts helpers
    sites = {"kernels": "https://gpu-kernels-explained.vercel.app", "numerics": "https://numerics-explained.vercel.app",
             "silicon": "https://systolic-arrays-explained.vercel.app",
             "inference": "https://llm-inference-explained.vercel.app",
             "architectures": "https://llm-architectures-explained.vercel.app"}
    for f in (ROOT / "src/content").rglob("*.tsx"):
        text = f.read_text()
        for site, slug in re.findall(r'(kernels|numerics|silicon|inference|architectures)Ch\(\s*"([^"]+)"', text):
            out.add(f"{sites[site]}/learn/{slug}")
        for repo in re.findall(r'deck\(\s*"([^"]+)"', text):
            out.add(f"https://brendanjameslynskey.github.io/{repo}/")
    return out
URL = re.compile(r"https?://[^\s\"'`)<>\]}]+")


def fetch(url: str) -> tuple[int, str]:
    out = subprocess.run(
        ["curl", "-sL", "-A", UA, "-o", "-", "-w", "\n%{http_code}", "--max-time", "40", url],
        capture_output=True,
    )
    body, _, code = out.stdout.decode("utf-8", "replace").rpartition("\n")
    return int(code or 0), body


def main() -> int:
    urls: dict[str, set[str]] = {}
    for f in FILES:
        if not f.exists():
            continue
        for u in URL.findall(f.read_text()):
            u = u.rstrip(".,;")
            if "localhost" in u or "${" in u or u.endswith("/blob/main/"):
                continue
            urls.setdefault(u, set()).add(str(f.relative_to(ROOT)))
    for u in generated_links():
        urls.setdefault(u, set()).add("(built from the vendored data)")
    bad = 0
    pages: dict[str, str] = {}
    for u in sorted(urls):
        base, _, anchor = u.partition("#")
        if "arxiv.org/abs/" in u:
            aid = u.rsplit("/", 1)[1]
            code, body = fetch(f"https://export.arxiv.org/abs/{aid}")
            t = re.search(r'citation_title" content="([^"]+)"', body)
            a = re.search(r'citation_author" content="([^"]+)"', body)
            print(f"{code} arXiv {aid}: {html.unescape(t.group(1)) if t else '?'} ({a.group(1) if a else '?'})")
            bad += code != 200
            time.sleep(1)
            continue
        if base not in pages:
            code, body = fetch(base)
            pages[base] = body if code == 200 else ""
            if code != 200 and "doi.org/" in base:
                doi = base.split("doi.org/", 1)[1]
                c2, b2 = fetch(f"https://api.crossref.org/works/{doi}")
                title = json.loads(b2)["message"]["title"][0] if c2 == 200 else "?"
                print(f"{code} {base} (Crossref {c2}: {title})")
                bad += c2 != 200
                continue
            print(f"{code} {base}")
            bad += code != 200
        if anchor and "brendanjameslynskey.github.io" in base:
            body = pages[base]
            m = re.search(rf'id="{re.escape(anchor)}"[^>]*>(.{{0,1500}})', body, re.S)
            h = re.search(r"<h[12][^>]*>(.*?)</h[12]>", m.group(1), re.S) if m else None
            title = html.unescape(re.sub("<[^>]+>", "", h.group(1))).strip() if h else None
            print(f"    #{anchor}: {title or 'MISSING'}")
            bad += title is None
    print(f"{len(urls)} links, {bad} problems")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
