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

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (msg) => errors.push(msg);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

function looksUnminified(text) {
  const lines = text
    .replace(/^\/\/# sourceMappingURL=.*$/gm, "")
    .split("\n")
    .filter((l) => l.trim());
  if (lines.length < 10) return false;
  const codeLike = lines.filter((l) => /[;{}]\s*$/.test(l)).length;
  return codeLike / lines.length > 0.3;
}

function targets(value) {
  if (typeof value === "string") return [value];
  return Object.values(value ?? {}).flatMap(targets);
}

for (const name of ["core", "nextjs", "vitepress", "gaine"]) {
  const dir = join(ROOT, "packages", name);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const wanted = new Set([...targets(pkg.exports), ...targets(pkg.bin)]);
  for (const rel of wanted) {
    if (rel.endsWith("package.json")) continue;
    if (!existsSync(join(dir, rel))) fail(`${pkg.name}: missing ${rel}`);
  }
}

const client = [
  "theme-sync",
  "scroll-reveal",
  "language-switcher",
  "ui/dropdown-menu",
  "ui/theme-toggle",
];
for (const f of client) {
  const file = join(ROOT, "packages/nextjs/dist", `${f}.js`);
  if (!existsSync(file)) continue;
  if (!/^["']use client["']/.test(readFileSync(file, "utf8").trimStart()))
    fail(`@gaine/nextjs: "use client" lost in dist/${f}.js`);
}

const cli = join(ROOT, "packages/gaine/dist/cli.js");
if (existsSync(cli) && !readFileSync(cli, "utf8").startsWith("#!/usr/bin/env node"))
  fail("gaine: shebang missing in dist/cli.js");

for (const name of ["core", "nextjs", "vitepress", "gaine"]) {
  const dist = join(ROOT, "packages", name, "dist");
  if (!existsSync(dist)) continue;
  for (const file of walk(dist).filter((f) => f.endsWith(".js"))) {
    if (looksUnminified(readFileSync(file, "utf8")))
      fail(`${name}: looks unminified: ${file.slice(ROOT.length + 1)}`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log("dist OK");
