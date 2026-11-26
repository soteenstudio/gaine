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

import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { argv, cwd, exit } from "node:process";
import { spawnSync } from "node:child_process";

const shell = process.platform === "win32";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARBALLS = join(ROOT, ".tarball");
const LIBS = ["core", "nextjs", "vitepress"];

const args = argv.slice(2);
const force = args.includes("--force");
const noInstall = args.includes("--no-install");
const positional = args.filter((a) => !a.startsWith("--"));
const targetDir = resolve(positional.find((a) => !LIBS.includes(a)) ?? cwd());
const wanted = positional.filter((a) => LIBS.includes(a));

if (!existsSync(join(targetDir, "package.json"))) {
  console.error(`No package.json in ${targetDir}`);
  exit(1);
}

const libs = {};
for (const dir of LIBS) {
  const pkg = JSON.parse(await readFile(join(ROOT, "packages", dir, "package.json"), "utf8"));
  const file = join(TARBALLS, `${pkg.name.replace("@", "").replace("/", "-")}-${pkg.version}.tgz`);
  if (!existsSync(file)) continue;
  libs[dir] = { name: pkg.name, file };
}
if (!libs.core) {
  console.error(
    `Tarballs not found in ${TARBALLS}. Run \`pnpm pack:local\` in the Gaine repo first.`,
  );
  exit(1);
}

const manifestPath = join(targetDir, "package.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const has = (name) => Boolean(manifest.dependencies?.[name] ?? manifest.devDependencies?.[name]);
const selected = wanted.length
  ? wanted
  : ["core", ...(has("next") ? ["nextjs"] : []), ...(has("vitepress") ? ["vitepress"] : [])];
if (!wanted.length && selected.length === 1) selected.push("nextjs", "vitepress");

const spec = (file) => "file:" + relative(targetDir, file).split("\\").join("/");
const usingNpm =
  existsSync(join(targetDir, "package-lock.json")) &&
  !existsSync(join(targetDir, "pnpm-lock.yaml"));

manifest.dependencies ??= {};
const overrides = {};
for (const [dir, lib] of Object.entries(libs)) {
  overrides[lib.name] = spec(lib.file);
  if (selected.includes(dir)) manifest.dependencies[lib.name] = spec(lib.file);
}
const isManaged = (value) =>
  typeof value === "string" && value.startsWith("file:") && value.includes(".tarball");

function pnpmMajor() {
  const res = spawnSync("pnpm", ["--version"], { cwd: targetDir, encoding: "utf8", shell });
  return res.status === 0 ? Number.parseInt(res.stdout.trim(), 10) : 0;
}

async function writeWorkspaceOverrides() {
  const file = join(targetDir, "pnpm-workspace.yaml");
  let yaml = existsSync(file) ? await readFile(file, "utf8") : "";
  yaml = yaml.replace(/^[ \t]+["']?@gaine\/[^\s"':]+["']?:\s*["']?file:.*\r?\n?/gm, "");
  const lines = Object.entries(overrides)
    .map(([name, value]) => `  "${name}": ${value}\n`)
    .join("");
  if (/^overrides:[ \t]*\r?\n/m.test(yaml))
    yaml = yaml.replace(/^(overrides:[ \t]*\r?\n)/m, `$1${lines}`);
  else yaml = (yaml && !yaml.endsWith("\n") ? yaml + "\n" : yaml) + `overrides:\n${lines}`;
  await writeFile(file, yaml);
  console.log(`Updated ${file}`);
}

let viaWorkspaceYaml = false;
if (usingNpm) manifest.overrides = { ...manifest.overrides, ...overrides };
else if (pnpmMajor() >= 10) {
  viaWorkspaceYaml = true;
  if (manifest.pnpm?.overrides) {
    for (const [k, v] of Object.entries(manifest.pnpm.overrides))
      if (isManaged(v)) delete manifest.pnpm.overrides[k];
    if (!Object.keys(manifest.pnpm.overrides).length) delete manifest.pnpm.overrides;
    if (!Object.keys(manifest.pnpm).length) delete manifest.pnpm;
  }
} else
  manifest.pnpm = { ...manifest.pnpm, overrides: { ...manifest.pnpm?.overrides, ...overrides } };

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Updated ${manifestPath}`);
if (viaWorkspaceYaml) await writeWorkspaceOverrides();
for (const dir of selected)
  if (libs[dir]) console.log(`  ${libs[dir].name} -> ${spec(libs[dir].file)}`);

if (noInstall) exit(0);
const pm = usingNpm ? "npm" : "pnpm";
const installArgs = ["install", ...(force ? ["--force"] : [])];
const res = spawnSync(pm, installArgs, { cwd: targetDir, stdio: "inherit", shell });
exit(res.status ?? 1);
