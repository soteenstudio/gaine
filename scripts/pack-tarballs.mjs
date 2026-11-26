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

import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { argv, exit } from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".tarball");
const args = argv.slice(2);
const skipBuild = args.includes("--no-build");
const keep = args.includes("--keep");
const only = args.filter((a) => !a.startsWith("--"));
const shell = process.platform === "win32";

function run(cmd, cmdArgs, cwd) {
  const res = spawnSync(cmd, cmdArgs, { cwd, stdio: "inherit", shell });
  if (res.status !== 0) {
    console.error(`\nFailed: ${cmd} ${cmdArgs.join(" ")}`);
    exit(res.status ?? 1);
  }
}

const packagesDir = join(ROOT, "packages");
const packages = [];
for (const entry of await readdir(packagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = join(packagesDir, entry.name);
  const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8").catch(() => "null"));
  if (!pkg || pkg.private) continue;
  if (only.length && !only.includes(entry.name) && !only.includes(pkg.name)) continue;
  packages.push({ dir, name: pkg.name });
}
if (!packages.length) {
  console.error("No packages matched.");
  exit(1);
}

if (!skipBuild) run("pnpm", ["build"], ROOT);
if (!keep) await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const pkg of packages) {
  console.log(`\nPacking ${pkg.name}`);
  run("pnpm", ["pack", "--pack-destination", OUT], pkg.dir);
}

const files = (await readdir(OUT)).filter((f) => f.endsWith(".tgz")).sort();
console.log(`\nTarballs in ${OUT}:`);
for (const f of files) console.log(`  ${f}`);
