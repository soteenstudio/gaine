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

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = resolve(PKG, "..");
const CLI = join(PKG, "dist", "cli.js");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

function scaffold(framework, lang, name = "demo-app") {
  const root = mkdtempSync(join(tmpdir(), "create-gaine-"));
  const res = spawnSync(process.execPath, [CLI, name, "-f", framework, "-l", lang], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { root, dir: join(root, name), res };
}

const combos = [
  ["next", "ts"],
  ["next", "js"],
  ["vitepress", "ts"],
  ["vitepress", "js"],
];

function publicSpecifiers() {
  const out = new Set();
  for (const dir of ["core", "nextjs", "vitepress"]) {
    const pkg = readJson(join(PACKAGES, dir, "package.json"));
    for (const key of Object.keys(pkg.exports))
      out.add(key === "." ? pkg.name : pkg.name + key.slice(1));
  }
  return out;
}

for (const [framework, lang] of combos) {
  test(`scaffold ${framework}-${lang}`, (t) => {
    const { root, dir, res } = scaffold(framework, lang);
    t.after(() => rmSync(root, { recursive: true, force: true }));
    assert.equal(res.status, 0, res.stderr);

    const files = walk(dir);
    assert.ok(existsSync(join(dir, ".gitignore")), ".gitignore is created from _gitignore");
    assert.ok(!existsSync(join(dir, "_gitignore")));

    for (const file of files) {
      const body = readFileSync(file, "utf8");
      assert.ok(!body.includes("{{name}}"), `unreplaced placeholder in ${file}`);
    }

    const pkg = readJson(join(dir, "package.json"));
    assert.equal(pkg.name, "demo-app");
    const versions = new Set(
      ["core", "nextjs", "vitepress"].map(
        (d) => readJson(join(PACKAGES, d, "package.json")).version,
      ),
    );
    assert.equal(versions.size, 1, "workspace packages share one version");
    const [version] = versions;
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
      if (dep.startsWith("@gaine/")) {
        assert.equal(
          { ...pkg.dependencies, ...pkg.devDependencies }[dep],
          `^${version}`,
          `${dep} must match the workspace version`,
        );
      }
    }

    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (framework === "next") {
      assert.match(deps.next, /^\^16\./);
      assert.match(deps.react, /^\^19\./);
      assert.match(deps["react-dom"], /^\^19\./);
      assert.ok(deps["@gaine/nextjs"]);
    } else {
      assert.match(deps.vitepress, /^\^1\./);
      assert.match(deps.vue, /^\^3\./);
      assert.equal(pkg.type, "module");
      assert.ok(deps["@gaine/vitepress"]);
    }
    assert.ok(deps.tailwindcss?.startsWith("^3."), "Tailwind 3 (the Gaine preset targets v3)");
    if (lang === "ts") {
      assert.ok(deps.typescript);
      assert.ok(deps["@types/node"], "@types/node is required for process.env in config files");
    }

    const known = publicSpecifiers();
    for (const file of files.filter((f) => /\.(m?[jt]sx?)$/.test(f))) {
      const body = readFileSync(file, "utf8");
      for (const m of body.matchAll(
        /from\s+["'](@gaine\/[^"']+)["']|import\s+["'](@gaine\/[^"']+)["']/g,
      )) {
        const spec = m[1] ?? m[2];
        assert.ok(known.has(spec), `${file}: "${spec}" is not an export of the workspace packages`);
      }
    }

    for (const file of files.filter((f) => f.endsWith(".css"))) {
      const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      const firstRule = css.search(/^\s*(?!@import|@charset)[^\s]/m);
      const lastImport = css.lastIndexOf("@import");
      assert.ok(
        lastImport === -1 || firstRule === -1 || lastImport < firstRule,
        `${file}: @import after other rules`,
      );
    }
  });
}

test("rejects a non-empty folder and invalid options", (t) => {
  const first = scaffold("next", "ts", "keep-me");
  t.after(() => rmSync(first.root, { recursive: true, force: true }));
  const again = spawnSync(process.execPath, [CLI, "keep-me", "-f", "next", "-l", "ts"], {
    cwd: first.root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.notEqual(again.status, 0);
  assert.match(again.stderr, /not empty/);

  for (const args of [
    ["x", "-f", "svelte", "-l", "ts"],
    ["x", "-f", "next", "-l", "py"],
    ["x", "-f"],
    ["Bad Name", "-f", "next", "-l", "ts"],
  ]) {
    const r = spawnSync(process.execPath, [CLI, ...args], {
      cwd: first.root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.notEqual(r.status, 0, args.join(" "));
  }
});
