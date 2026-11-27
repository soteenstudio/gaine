# Gaine speed bench

Auto-compare **plain Next.js** vs **Next.js + Gaine** (`withGaineSpeed`, Waterdrop, `GaineRuntime`, lite components).

## One-time setup

```bash
cd bench
npm install
npx playwright install chromium
```

## Run

```bash
pnpm bench                      # from repo root (or: node bench/run.mjs)
```

It will, with no further input:

1. Scaffold two apps in `bench/.work/`: **baseline** (plain Next 16 + Tailwind, hand-written theme toggle, language switcher, reveal, locale proxy) and **gaine** (the `create-gaine` Next template).
2. `npm install`, clean `next build`, `next start` on free ports.
3. Cold-cache Chromium loads, interleaved A/B (warm-up discarded), with Lighthouse-style throttling: FCP, LCP, TBT, CLS, TTFB, DCL, load, requests, bytes per type.
4. HTTP load test on `next start`: req/s, p50/p95, RSS.
5. Build stats: build time, `.next` size, static JS/CSS gzip, chunk count.
6. Statistics + verdict, written to `bench/results/<timestamp>/` (`report.html`, `report.md`, `report.json`; copy in `results/latest`).

A lab metric only counts as a win at **p < 0.05 (Mann-Whitney U)** and ≥ 3% change; byte/count metrics are deterministic.

## Useful options

| Option | Meaning |
|---|---|
| `--gaine-source local` | use `@gaine/*` packed from this checkout (`pnpm pack:local`) instead of npm |
| `--runs 20` | more samples = tighter result |
| `--profile mobile\|fast\|desktop` | slow-4G + 4× CPU (default), fast, or unthrottled |
| `--baseline-dir A --gaine-dir B --paths /,/about` | compare **your own two apps** |
| `--baseline-url URL --gaine-url URL` | compare two live deployments (browser metrics only) |
| `--fail-on-regress` | exit 1 if plain Next.js wins a key metric (use in CI) |

Run `node bench/run.mjs --help` for all flags.

## Fairness notes

- The baseline is a *feature-equivalent* control (same markup, same Tailwind, same i18n/theme/reveal features), not an empty app. Differences in the page markup would be your own, so for the most honest result use `--baseline-dir/--gaine-dir` on a real project before/after adopting Gaine.
- Don't run other heavy work during a benchmark. Both servers run on the same machine; loads are interleaved to cancel drift.
- Single `--build-runs` is noisy for build time; use `--build-runs 3` if you care.
