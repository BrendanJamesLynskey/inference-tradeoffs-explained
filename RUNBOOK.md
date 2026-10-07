# RUNBOOK.md — Deploying and checking the site

The site is static: no database, no secrets, no environment variables. A
deploy can't break a schema, but it can still break in ways CI doesn't
see, so every deploy follows the same three steps. They are adapted from
transformer-explainer's RUNBOOK §7.

## 1. Deploy from a clean export

The Vercel project (`inference-tradeoffs-explained`) is not on Vercel's Git
integration. Deploy with the logged-in Vercel CLI from a clean export of
`HEAD`, so nothing untracked (caches, `node_modules`, local files) is
uploaded:

```bash
rm -rf /tmp/ite-deploy && mkdir /tmp/ite-deploy
git archive HEAD | tar -x -C /tmp/ite-deploy
cp -r .vercel /tmp/ite-deploy/
(cd /tmp/ite-deploy && vercel deploy --yes)          # preview
(cd /tmp/ite-deploy && vercel deploy --prod --yes)   # production
vercel ls inference-tradeoffs-explained | head                   # newest must be ● Ready
```

Test a preview first. Previews are protected by Vercel Authentication; to
smoke-check one, create a protection-bypass token in the project settings
and pass it as `VERCEL_BYPASS` (never commit or print it).

## 2. Smoke-check

```bash
pnpm smoke https://inference-tradeoffs-explained.vercel.app
# a protected preview:
VERCEL_BYPASS=… pnpm smoke https://<preview-url>
```

It fetches every page and the five recorded workloads, and fails on any
non-200 (redirects included) or on a page without the content that proves it
rendered from the data: the landing page's sweep numbers (looked up by the
smoke script with the same code), the method page's caveat anchors and
vendored commit, each lever page's title and widget placeholder, and the
seven-way site switch with Trade-offs current. Then open `/what-if` in a
browser: both configurations must simulate (the status line says "Done")
and, for a sweep configuration, the page must say its live latencies are
identical to the recorded sweep's. Open `/explore`, press **Play**, step and
scrub. With reduce-motion set in the OS, nothing should play until you press
Play.

## 3. Read the logs

```bash
vercel logs --environment production --since 15m --no-branch --expand
```

A static site should log almost nothing. On the Hobby plan the CLI only
reaches back about an hour; the dashboard's Logs view keeps more.

## Why e2e runs under `--no-experimental-require-module`

Plain Node 20.19+ / 22.12+ can `require()` an ES module; Vercel's function
loader can't. transformer-explainer shipped a comment renderer that passed
every local and CI test and returned 500 on Vercel for that reason
(2026-10-04). This site has no server functions, but CI runs the e2e
server under the flag anyway, so the class of bug can't arrive unnoticed if
one is added.

## Updating the data

The sweep, the engine and results.md are vendored from
Disaggregated_Inference_Sim at one commit. To move to a newer one:

```bash
pnpm vendor <commit>                                                    # copies the three files, records SHA-256s
../Disaggregated_Inference_Sim/.venv/bin/python scripts/tradeoffs_reference.py   # workloads + parity fixtures
../Disaggregated_Inference_Sim/.venv/bin/python scripts/mechanisms_reference.py  # the chapters' recorded scenarios
pnpm test                                                               # parity, all 350 points, fronts, results.md, chapters
```

The chapters quote results.md cells by section, table, row and column
(`md|…` paths) and the recorded scenarios by key (`mech|…`): a path that no
longer resolves fails the build, so a newer results.md whose tables moved
shows up at once.

The simulator checkout must be at that commit (the script refuses
otherwise). Never edit the vendored files or the fixtures by hand: CI
regenerates the fixtures from the simulator at the recorded commit and fails
on any difference.
