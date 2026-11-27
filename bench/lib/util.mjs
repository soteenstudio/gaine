import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";

const shell = process.platform === "win32";

// `pnpm run` leaks npm_config_* / pnpm settings into child processes (e.g. allow-scripts),
// which makes a nested `npm install` fail. Drop them, keeping only network-related ones.
const KEEP = /^npm_config_(registry|proxy|https_proxy|http_proxy|noproxy|cafile|ca|strict_ssl|userconfig|globalconfig|cache)$/i;
export function cleanEnv(extra = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/^npm_config_/i.test(k) && !KEEP.test(k)) continue;
    if (/^pnpm_/i.test(k) || /^npm_(lifecycle|package|command|node_execpath)/i.test(k)) continue;
    env[k] = v;
  }
  return { ...env, ...extra };
}

export function run(cmd, args, { cwd, env, quiet } = {}) {
  const res = spawnSync(cmd, args, {
    cwd,
    env: cleanEnv(env),
    stdio: quiet ? "pipe" : "inherit",
    encoding: "utf8",
    shell: shell && cmd !== process.execPath, // paths with spaces (C:\Program Files) break under cmd.exe
  });
  if (res.status !== 0) {
    const tail = quiet ? `\n${res.stdout ?? ""}\n${res.stderr ?? ""}` : "";
    throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(" ")}${tail}`);
  }
  return res;
}

export function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitForHttp(url, timeoutMs = 60_000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (res.status < 500) return;
      last = `HTTP ${res.status}`;
    } catch (e) {
      last = e.message;
    }
    await sleep(300);
  }
  throw new Error(`Server at ${url} did not become ready (${last})`);
}

export function startNext(dir, port) {
  const bin = join(dir, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [bin, "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: dir,
    env: cleanEnv({ NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", PORT: String(port) }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  child.getLog = () => log;
  return child;
}

export function stop(child) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
}

/** Sum RSS (MB) of a process and its descendants. POSIX only; returns NaN elsewhere. */
export function treeRssMb(pid) {
  if (process.platform === "win32") return NaN;
  const res = spawnSync("ps", ["-A", "-o", "pid=,ppid=,rss="], { encoding: "utf8" });
  if (res.status !== 0) return NaN;
  const rows = res.stdout
    .trim()
    .split("\n")
    .map((l) => l.trim().split(/\s+/).map(Number));
  const kids = new Map();
  for (const [p, pp, rss] of rows) {
    if (!kids.has(pp)) kids.set(pp, []);
    kids.get(pp).push([p, rss]);
  }
  const rssOf = new Map(rows.map(([p, , r]) => [p, r]));
  let total = 0;
  const stack = [pid];
  while (stack.length) {
    const p = stack.pop();
    total += rssOf.get(p) ?? 0;
    for (const [c] of kids.get(p) ?? []) stack.push(c);
  }
  return total / 1024;
}

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

/** Inspect a finished `next build` output. */
export async function inspectBuild(dir) {
  const nextDir = join(dir, ".next");
  let total = 0;
  for await (const f of walk(nextDir)) {
    if (f.includes(`${join(".next", "cache")}`)) continue;
    total += (await stat(f)).size;
  }
  let jsGz = 0;
  let cssGz = 0;
  let chunks = 0;
  for await (const f of walk(join(nextDir, "static"))) {
    if (f.endsWith(".js")) {
      jsGz += gzipSync(await readFile(f)).length;
      chunks++;
    } else if (f.endsWith(".css")) cssGz += gzipSync(await readFile(f)).length;
  }
  return { nextDirMb: total / 1048576, staticJsGz: jsGz, staticCssGz: cssGz, chunks };
}

export const fmt = {
  num(v, d = 1) {
    if (!Number.isFinite(v)) return "-";
    return v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 });
  },
  bytes(v) {
    if (!Number.isFinite(v)) return "-";
    if (Math.abs(v) >= 1048576) return `${(v / 1048576).toFixed(2)} MB`;
    if (Math.abs(v) >= 1024) return `${(v / 1024).toFixed(1)} kB`;
    return `${Math.round(v)} B`;
  },
  value(def, v) {
    if (!Number.isFinite(v)) return "-";
    if (def.unit === "B") return fmt.bytes(v);
    if (def.id === "cls") return v.toFixed(3);
    const d = def.unit === "MB" || def.unit === "s" || def.id === "p50" || def.id === "p95" ? 2 : def.unit === "ms" ? 0 : 0;
    return `${fmt.num(v, d)}${def.unit ? " " + def.unit : ""}`;
  },
  pct(v) {
    if (!Number.isFinite(v)) return "n/a";
    return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
  },
};