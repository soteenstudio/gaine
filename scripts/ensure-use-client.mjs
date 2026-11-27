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

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const PKG = process.cwd();
const SRC = join(PKG, "src");
const DIST = join(PKG, "dist");
const DIRECTIVE = /^\s*["']use client["']/;

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

const problems = [];
let restored = 0;
for (const file of walk(SRC).filter((f) => /\.(?:[mc]?[jt]sx?)$/.test(f))) {
  if (!DIRECTIVE.test(readFileSync(file, "utf8"))) continue;
  const rel = relative(SRC, file)
    .replace(/\\/g, "/")
    .replace(/\.[mc]?[jt]sx?$/, "");
  const out = join(DIST, `${rel}.js`);
  if (!existsSync(out)) {
    problems.push(
      `dist/${rel}.js is missing: src/${rel} has "use client" but is not built as its own entry (add it to CLIENT in tsup.config.ts)`,
    );
    continue;
  }
  const code = readFileSync(out, "utf8");
  if (!DIRECTIVE.test(code)) {
    writeFileSync(out, `"use client";\n${code}`);
    restored++;
  }
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join("\n"));
  process.exit(1);
}
if (restored) console.log(`restored "use client" in ${restored} file(s)`);
