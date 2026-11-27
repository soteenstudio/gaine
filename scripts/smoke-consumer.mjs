#!/usr/bin/env node
/*
 * Copyright 2026 SoTeen Studio
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { builtinModules } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shell = process.platform === "win32";
const errors = [];
const fail = (m) => errors.push(m);
const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));

function run(cmd, args, cwd, quiet = false, env = process.env) {
  const useShell = shell && cmd !== process.execPath;
  const quote = (a) => (useShell && /[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
  return spawnSync(cmd, args.map(quote), {
    cwd,
    env,
    encoding: "utf8",
    shell: useShell,
    stdio: quiet ? "pipe" : ["ignore", "inherit", "inherit"],
  });
}

const KEEP_CONFIG = new Set([
  "npm_config_registry",
  "npm_config_userconfig",
  "npm_config_cache",
  "npm_config_proxy",
  "npm_config_https_proxy",
  "npm_config_noproxy",
  "npm_config_cafile",
  "npm_config_strict_ssl",
]);
const npmEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([k]) => !/^npm_config_/i.test(k) || KEEP_CONFIG.has(k.toLowerCase()),
  ),
);

const pkgs = readdirSync(join(ROOT, "packages"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(ROOT, "packages", e.name, "package.json")))
  .map((e) => ({
    dir: join(ROOT, "packages", e.name),
    json: readJson(join(ROOT, "packages", e.name, "package.json")),
  }))
  .filter((p) => !p.json.private);

const IMPORT_RE =
  /\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
const builtins = new Set(builtinModules);
const pkgNameOf = (spec) => {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
};
function checkGraph({ app, pkg, label, startFile, fail, resolveSpec }) {
  const pkgDir = join(app, "node_modules", pkg.name);
  const declared = { ...pkg.dependencies, ...pkg.peerDependencies };
  const optional = pkg.peerDependenciesMeta ?? {};
  const seen = new Set();
  const queue = [startFile];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!existsSync(file)) {
      fail(`${label}: ${relative(pkgDir, file)} is missing from the installed package`);
      continue;
    }
    if (!file.endsWith(".js")) continue;
    for (const m of readFileSync(file, "utf8").matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (spec.startsWith(".")) {
        queue.push(resolve(dirname(file), spec));
        continue;
      }
      if (spec.startsWith("node:") || builtins.has(spec.split("/")[0])) continue;
      const dep = pkgNameOf(spec);
      if (dep === pkg.name) continue;
      if (!(dep in declared)) {
        fail(
          `${label}: ${relative(pkgDir, file)} imports "${spec}" but ${dep} is not in dependencies/peerDependencies`,
        );
        continue;
      }
      if (!optional[dep]?.optional && !existsSync(join(app, "node_modules", dep)))
        fail(`${label}: ${dep} (imported by ${relative(pkgDir, file)}) is not installed`);
      if (dep.startsWith("@gaine/")) resolveSpec(spec, label);
    }
  }
}

const work = mkdtempSync(join(tmpdir(), "gaine-smoke-"));
const packs = join(work, "tarballs");
const app = join(work, "consumer");
mkdirSync(packs);
mkdirSync(app);

try {
  const tarballs = {};
  for (const p of pkgs) {
    const r = run("pnpm", ["pack", "--pack-destination", packs], p.dir, true);
    if (r.status !== 0) {
      fail(`pnpm pack failed for ${p.json.name}: ${(r.stderr || r.stdout).trim()}`);
      continue;
    }
    const file = join(
      packs,
      `${p.json.name.replace("@", "").replace("/", "-")}-${p.json.version}.tgz`,
    );
    if (!existsSync(file)) fail(`tarball not found for ${p.json.name}: ${file}`);
    else {
      tarballs[p.json.name] = file;
      console.log(`  packed ${p.json.name}: ${(statSync(file).size / 1024).toFixed(1)} KiB`);
    }
  }
  if (errors.length) throw new Error("packing failed");

  const spec = (f) => `file:${f.split("\\").join("/")}`;
  writeFileSync(
    join(app, "package.json"),
    JSON.stringify(
      {
        name: "gaine-smoke-consumer",
        private: true,
        type: "module",
        dependencies: Object.fromEntries(Object.entries(tarballs).map(([n, f]) => [n, spec(f)])),
        overrides: Object.fromEntries(
          Object.entries(tarballs)
            .filter(([n]) => n.startsWith("@gaine/"))
            .map(([n, f]) => [n, spec(f)]),
        ),
      },
      null,
      2,
    ),
  );
  console.log("Installing tarballs into an empty consumer…");
  const install = run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"],
    app,
    false,
    npmEnv,
  );
  if (install.status !== 0) {
    const dropped = Object.keys(process.env).filter(
      (k) => /^npm_config_/i.test(k) && !KEEP_CONFIG.has(k.toLowerCase()),
    );
    if (dropped.length) console.error(`(ignored inherited config: ${dropped.join(", ")})`);
    throw new Error("npm install of the tarballs failed");
  }

  const probe = join(app, "probe.mjs");
  writeFileSync(
    probe,
    `const [spec, kind] = process.argv.slice(2);
const url = import.meta.resolve(spec);
if (kind === "css") {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const text = readFileSync(fileURLToPath(url), "utf8").replace(/\\/\\*[\\s\\S]*?\\*\\//g, "").trim();
  if (!text) throw new Error("empty CSS: " + spec);
} else if (kind === "js") {
  await import(spec);
}
`,
  );
  const RUNTIME = new Set(["@gaine/core"]);
  const resolved = new Map();
  const explain = (r) => {
    const lines = (r.stderr || r.stdout || String(r.error ?? "")).trim().split("\n");
    return lines.find((l) => /Error/.test(l)) ?? lines[0] ?? "failed";
  };
  const resolveSpec = (spec, label) => {
    if (!resolved.has(spec)) {
      const r = run(process.execPath, [probe, spec, "resolve"], app, true);
      resolved.set(spec, r.status === 0 ? null : explain(r));
    }
    if (resolved.get(spec))
      fail(`${label}: cross-package import "${spec}" does not resolve: ${resolved.get(spec)}`);
  };

  for (const p of pkgs) {
    if (!p.json.exports) continue;
    for (const [key, value] of Object.entries(p.json.exports)) {
      if (key === "./package.json") continue;
      const specifier = key === "." ? p.json.name : p.json.name + key.slice(1);
      const target =
        typeof value === "string"
          ? value
          : (value.import ??
            value.default ??
            Object.values(value).find((v) => typeof v === "string"));
      const isCss = typeof target === "string" && target.endsWith(".css");
      const kind = isCss ? "css" : RUNTIME.has(p.json.name) ? "js" : "resolve";
      const before = errors.length;

      const r = run(process.execPath, [probe, specifier, kind], app, true);
      if (r.status !== 0) fail(`${specifier}: ${explain(r)}`);
      else if (kind === "resolve")
        checkGraph({
          app,
          pkg: p.json,
          label: specifier,
          startFile: join(app, "node_modules", p.json.name, target),
          fail,
          resolveSpec,
        });
      if (errors.length === before)
        console.log(`  ok ${specifier}${kind === "resolve" ? " (static)" : ""}`);
    }
  }

  const walkAll = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? e.name === "node_modules"
          ? []
          : walkAll(join(dir, e.name))
        : [join(dir, e.name)],
    );
  for (const p of pkgs) {
    const dir = join(app, "node_modules", p.json.name);
    for (const f of walkAll(dir).filter((f) => f.endsWith(".map")))
      fail(`${p.json.name}: published tarball contains ${relative(dir, f)}`);
  }

  const cli = join(app, "node_modules", "create-gaine", "dist", "cli.js");
  const own = pkgs.find((p) => p.json.name === "create-gaine");
  const version = own?.json.version;
  for (const [framework, lang] of [
    ["next", "ts"],
    ["next", "js"],
    ["vitepress", "ts"],
    ["vitepress", "js"],
  ]) {
    const name = `demo-${framework}-${lang}`;
    const r = run(process.execPath, [cli, name, "-f", framework, "-l", lang], app, true);
    if (r.status !== 0) {
      fail(`create-gaine ${framework}-${lang}: ${(r.stderr || r.stdout).trim()}`);
      continue;
    }
    const manifest = readJson(join(app, name, "package.json"));
    for (const [dep, range] of Object.entries({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    })) {
      if (dep.startsWith("@gaine/") && range !== `^${version}`)
        fail(`${framework}-${lang}: ${dep}@${range} should be ^${version}`);
    }
    console.log(`  ok scaffold ${framework}-${lang}`);
  }
} catch (err) {
  if (!errors.length) errors.push(err.message);
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log("consumer smoke OK");
