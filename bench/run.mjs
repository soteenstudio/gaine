#!/usr/bin/env node
/**
 * Auto-compare speed: plain Next.js vs Next.js + Gaine.
 *
 *   node bench/run.mjs                       scaffold both apps, build, measure, report
 *   node bench/run.mjs --gaine-source local  use @gaine/* packed from this checkout
 *   node bench/run.mjs --baseline-dir A --gaine-dir B --paths /,/about    compare your own apps
 *   node bench/run.mjs --baseline-url https://a.example --gaine-url https://b.example   compare live deployments
 */
import { mkdir, rm, writeFile, cp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { argv, exit } from "node:process";
import { buildApp, installDeps, scaffoldBaseline, scaffoldGaine, BENCH, isDir } from "./lib/apps.mjs";
import { compareAll, verdict as makeVerdict } from "./lib/metrics.mjs";
import { loadPlaywright, loadTest, measureLoad, PROFILES } from "./lib/measure.mjs";
import { toConsole, toHtml, toMarkdown } from "./lib/report.mjs";
import { freePort, startNext, stop, treeRssMb, waitForHttp } from "./lib/util.mjs";

const HELP = `
Usage: node bench/run.mjs [options]

Targets (default: scaffold a plain Next.js app and a Gaine starter side by side)
  --baseline-dir <dir>     use your own app as the baseline (must be buildable)
  --gaine-dir <dir>        use your own Gaine app
  --baseline-url <url>     measure an already running/deployed baseline (skips build + server metrics)
  --gaine-url <url>        measure an already running/deployed Gaine site
  --gaine-source <npm|local>   where @gaine/* comes from for the scaffolded app (default: npm)
  --lang <ts|js>           Gaine template language (default: ts)
  --paths <a,b,c>          pages to measure (default: /id,/en for scaffolds, / for custom targets)

Measurement
  --runs <n>               cold page loads per page per app (default: 10)
  --warmup <n>             discarded warm-up loads per app (default: 2)
  --profile <mobile|fast|desktop>   network/CPU throttle (default: mobile = slow 4G, 4x CPU)
  --build-runs <n>         clean builds per app (default: 1)
  --load-seconds <n>       HTTP load test per round (default: 5, 0 = skip)
  --browser-channel <c>    use an installed browser (e.g. chrome) instead of bundled Chromium
  --headed                 show the browser

Workflow
  --work-dir <dir>         default bench/.work
  --out <dir>              default bench/results/<timestamp>
  --reinstall              reinstall deps even if node_modules exists
  --skip-build             reuse existing .next in the work dirs
  --fail-on-regress        exit 1 if plain Next.js beats Gaine on a key metric (CI gate)
  -h, --help
`;

function parse(args) {
  const o = { runs: 10, warmup: 2, profile: "mobile", buildRuns: 1, loadSeconds: 5, lang: "ts", gaineSource: "npm" };
  const num = new Set(["runs", "warmup", "buildRuns", "loadSeconds"]);
  const bool = new Set(["headed", "reinstall", "skipBuild", "failOnRegress", "help"]);
  for (let i = 0; i < args.length; i++) {
    let a = args[i];
    if (a === "-h") a = "--help";
    if (!a.startsWith("--")) throw new Error(`Unexpected argument ${a}`);
    const [flag, inline] = a.slice(2).split("=", 2);
    const key = flag.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (bool.has(key)) o[key] = true;
    else {
      const v = inline ?? args[++i];
      if (v === undefined) throw new Error(`--${flag} needs a value`);
      o[key] = num.has(key) ? Number(v) : v;
    }
  }
  return o;
}

const log = (m) => console.log(`› ${m}`);

async function main() {
  const o = parse(argv.slice(2));
  if (o.help) return console.log(HELP);
  if (!PROFILES[o.profile]) throw new Error(`Unknown profile ${o.profile}`);

  const work = resolve(o.workDir ?? join(BENCH, ".work"));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = resolve(o.out ?? join(BENCH, "results", stamp));
  await mkdir(work, { recursive: true });
  await mkdir(outDir, { recursive: true });

  const targets = {
    baseline: { name: "baseline", url: o.baselineUrl, dir: o.baselineDir && resolve(o.baselineDir) },
    gaine: { name: "gaine", url: o.gaineUrl, dir: o.gaineDir && resolve(o.gaineDir) },
  };
  const custom = Boolean(o.baselineDir || o.gaineDir || o.baselineUrl || o.gaineUrl);
  const paths = (o.paths ?? (custom ? "/" : "/id,/en")).split(",").map((p) => p.trim());

  const metrics = { baseline: {}, gaine: {} };
  const push = (side, id, v) => (metrics[side][id] ??= []).push(...(Array.isArray(v) ? v : [v]));
  const servers = [];
  const cleanup = () => servers.forEach(stop);
  process.on("exit", cleanup);
  process.on("SIGINT", () => exit(130));

  // 1. prepare + build + start
  for (const t of Object.values(targets)) {
    if (t.url) {
      t.base = t.url.replace(/\/$/, "");
      continue;
    }
    if (!t.dir) {
      log(`Scaffolding ${t.name} app`);
      t.dir =
        t.name === "baseline"
          ? await scaffoldBaseline(work)
          : await scaffoldGaine(work, { source: o.gaineSource, lang: o.lang });
    } else if (!(await isDir(t.dir))) throw new Error(`${t.dir} is not a directory`);
    log(`Installing ${t.name} dependencies`);
    await installDeps(t.dir, { force: o.reinstall });
    if (!o.skipBuild) {
      log(`Building ${t.name} (${o.buildRuns}×)`);
      const b = await buildApp(t.dir, { runs: o.buildRuns });
      for (const k of ["buildSec", "nextDirMb", "staticJsGz", "staticCssGz", "chunks"]) push(t.name, k, b[k]);
    }
    const port = await freePort();
    log(`Starting ${t.name} on :${port}`);
    t.server = startNext(t.dir, port);
    servers.push(t.server);
    t.base = `http://127.0.0.1:${port}`;
  }
  for (const t of Object.values(targets)) {
    await waitForHttp(t.base + paths[0]).catch((e) => {
      throw new Error(`${t.name}: ${e.message}\n${t.server?.getLog?.() ?? ""}`);
    });
  }

  // 2. browser loads, interleaved A/B so drift hits both equally
  const pw = loadPlaywright();
  const browser = await pw.chromium.launch({ headless: !o.headed, channel: o.browserChannel });
  const perPath = {};
  try {
    const order = ["baseline", "gaine"];
    const total = o.warmup + o.runs;
    for (let i = 0; i < total; i++) {
      const warm = i < o.warmup;
      for (const path of paths) {
        for (const side of i % 2 ? [...order].reverse() : order) {
          const rec = await measureLoad(browser, targets[side].base + path, o.profile);
          if (warm) continue;
          for (const [k, v] of Object.entries(rec)) {
            push(side, k, v);
            ((perPath[path] ??= { baseline: {}, gaine: {} })[side][k] ??= []).push(v);
          }
        }
      }
      process.stdout.write(`\r› Browser loads ${Math.min(i + 1, total)}/${total}${warm ? " (warm-up)" : "          "}`);
    }
    process.stdout.write("\n");
  } finally {
    await browser.close();
  }

  // 3. server throughput (only for apps we started ourselves)
  if (o.loadSeconds > 0 && !o.baselineUrl && !o.gaineUrl) {
    log(`HTTP load test (${o.loadSeconds}s × 2 rounds per app)`);
    for (let round = 0; round < 2; round++)
      for (const side of round % 2 ? ["gaine", "baseline"] : ["baseline", "gaine"]) {
        const t = targets[side];
        await loadTest(t.base + paths[0], { seconds: 1 }); // warm
        const r = await loadTest(t.base + paths[0], { seconds: o.loadSeconds });
        for (const k of ["rps", "p50", "p95"]) push(side, k, r[k]);
      }
    for (const side of ["baseline", "gaine"]) {
      const rss = targets[side].server ? treeRssMb(targets[side].server.pid) : NaN;
      if (Number.isFinite(rss)) push(side, "rssMb", rss);
    }
  }

  // 4. compare + report
  const rows = compareAll(metrics.baseline, metrics.gaine);
  const verdict = makeVerdict(rows);
  const meta = {
    date: new Date().toISOString(),
    profile: o.profile,
    runs: o.runs,
    paths,
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    gaineSource: custom ? "custom" : o.gaineSource,
  };
  const json = { meta, verdict, rows, perPath, raw: metrics };
  await writeFile(join(outDir, "report.json"), JSON.stringify(json, null, 2));
  await writeFile(join(outDir, "report.md"), toMarkdown(rows, verdict, meta));
  await writeFile(join(outDir, "report.html"), toHtml(rows, verdict, meta));
  const latest = join(BENCH, "results", "latest");
  await rm(latest, { recursive: true, force: true });
  await mkdir(join(BENCH, "results"), { recursive: true });
  await cp(outDir, latest, { recursive: true });

  console.log(toConsole(rows, verdict, meta));
  console.log(`  Report: ${join(outDir, "report.html")}\n`);

  cleanup();
  if (o.failOnRegress && verdict.regressions.length) {
    console.error(`Regression on key metrics: ${verdict.regressions.join(", ")}`);
    exit(1);
  }
  exit(0);
}

main().catch((e) => {
  console.error(`\n✖ ${e.message}`);
  exit(1);
});
