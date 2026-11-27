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
  const code = text.replace(/^\/\/# sourceMappingURL=.*$/gm, "");
  if (code.length <= 500) return false;
  const inLongLines = code
    .split("\n")
    .filter((l) => l.length > 150)
    .reduce((n, l) => n + l.length, 0);
  return inLongLines / code.length < 0.4;
}

function targets(value) {
  if (typeof value === "string") return [value];
  return Object.values(value ?? {}).flatMap(targets);
}

for (const name of ["core", "nextjs", "vitepress", "create-gaine"]) {
  const dir = join(ROOT, "packages", name);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const wanted = new Set([...targets(pkg.exports), ...targets(pkg.bin)]);
  const files = (pkg.files ?? []).map((f) => f.replace(/^\.\//, "").replace(/\/$/, ""));
  const covered = (rel) => {
    const r = rel.replace(/^\.\//, "");
    return files.some((f) => r === f || r.startsWith(`${f}/`));
  };
  for (const rel of wanted) {
    if (rel.endsWith("package.json")) continue;
    const abs = join(dir, rel);
    if (!existsSync(abs)) {
      fail(`${pkg.name}: missing ${rel}`);
      continue;
    }
    if (!covered(rel))
      fail(`${pkg.name}: ${rel} is exported but not covered by "files" (not published)`);
    if (
      rel.endsWith(".css") &&
      !readFileSync(abs, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim()
    )
      fail(`${pkg.name}: ${rel} is empty`);
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
  if (!existsSync(file)) {
    fail(`@gaine/nextjs: dist/${f}.js is missing`);
    continue;
  }
  if (!/^["']use client["']/.test(readFileSync(file, "utf8").trimStart()))
    fail(`@gaine/nextjs: "use client" lost in dist/${f}.js`);
}

const barrel = join(ROOT, "packages/nextjs/dist/index.js");
if (existsSync(barrel)) {
  const text = readFileSync(barrel, "utf8");
  for (const f of client)
    if (!text.includes(`./${f}.js`))
      fail(
        `@gaine/nextjs: dist/index.js does not import ./${f}.js (client component inlined into the barrel?)`,
      );
}

const uiEntry = join(ROOT, "packages/nextjs/dist/ui.js");
if (!existsSync(uiEntry)) fail("@gaine/nextjs: dist/ui.js is missing");
else {
  const text = readFileSync(uiEntry, "utf8");
  for (const f of client)
    if (text.includes(`./${f}.js`))
      fail(`@gaine/nextjs: dist/ui.js must stay server-only but references ./${f}.js`);
}

const cli = join(ROOT, "packages/create-gaine/dist/cli.js");
if (!existsSync(cli)) fail("create-gaine: dist/cli.js is missing");
else if (!readFileSync(cli, "utf8").startsWith("#!/usr/bin/env node"))
  fail("create-gaine: shebang missing in dist/cli.js");

for (const name of ["core", "nextjs", "vitepress", "create-gaine"]) {
  const dist = join(ROOT, "packages", name, "dist");
  if (!existsSync(dist)) {
    fail(`${name}: dist/ is missing (run pnpm build first)`);
    continue;
  }
  for (const file of walk(dist).filter((f) => f.endsWith(".map")))
    fail(`${name}: source map must not be published: ${file.slice(ROOT.length + 1)}`);
  for (const file of walk(dist).filter((f) => f.endsWith(".js"))) {
    if (/^\/\/# sourceMappingURL=/m.test(readFileSync(file, "utf8")))
      fail(`${name}: sourceMappingURL left in ${file.slice(ROOT.length + 1)}`);
    if (looksUnminified(readFileSync(file, "utf8")))
      fail(`${name}: looks unminified: ${file.slice(ROOT.length + 1)}`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log("dist OK");
