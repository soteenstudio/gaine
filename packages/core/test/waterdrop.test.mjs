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
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWaterdrop, waterdropAvailable } from "../dist/waterdrop/index.js";

const site = async () => {
  const dir = await mkdtemp(join(tmpdir(), "gaine-waterdrop-"));
  await mkdir(join(dir, "assets"));
  await writeFile(
    join(dir, "index.html"),
    `<!doctype html><html><head><script type="module" src="/assets/app.js"></script><link rel="preload" as="script" href="/assets/gone.js"></head><body><img src="/assets/a.png"><img src="/assets/b.png"><img src="/assets/c.png"><p>hello    world</p></body></html>`,
  );
  await writeFile(
    join(dir, "assets", "app.js"),
    '// comment\nimport { helper } from "./helper.js";\nexport function main(){return helper()+1;}\nexport function dead(){}\n',
  );
  await writeFile(
    join(dir, "assets", "helper.js"),
    "export function helper(){return 41;}\nexport function unusedHelper(){}\n",
  );
  await writeFile(
    join(dir, "assets", "app.css"),
    "/* c */\n.hero{color:red;}\n.unused{color:blue;}\n",
  );
  await writeFile(join(dir, "assets", "a.png"), Buffer.from([1, 2, 3]));
  await writeFile(join(dir, "assets", "b.png"), Buffer.from([1, 2, 3]));
  await writeFile(join(dir, "assets", "c.png"), Buffer.from([4, 5, 6]));
  await writeFile(join(dir, "assets", "orphan.png"), Buffer.from([9, 9, 9]));
  return dir;
};

test("waterdrop runs with native engine when available", async () => {
  const dir = await site();
  try {
    const result = await runWaterdrop({
      root: dir,
      outDir: dir,
      report: { path: "waterdrop-report.json", pretty: true },
      css: { purge: true },
      html: { minify: true, lazyImages: true },
      js: { minify: "always" },
    });
    assert.equal(result.native, waterdropAvailable());
    assert.equal(result.report.pages.length, 1);
    assert.ok(result.report.orphans.includes("assets/orphan.png"));
    const html = await readFile(join(dir, "index.html"), "utf8");
    assert.ok(html.includes("modulepreload") || html.includes("helper.js"));
    const js = await readFile(join(dir, "assets", "app.js"), "utf8");
    assert.ok(!js.includes("// comment"));
    const report = JSON.parse(await readFile(join(dir, "waterdrop-report.json"), "utf8"));
    assert.equal(report.summary.assets > 0, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("waterdrop falls back to the JavaScript engine", async () => {
  const dir = await site();
  const previous = process.env.GAINE_WATERDROP_BIN;
  process.env.GAINE_WATERDROP_BIN = "/definitely/missing/waterdrop";
  try {
    const result = await runWaterdrop({
      root: dir,
      outDir: dir,
      mode: "analyze",
      html: { minify: true },
    });
    assert.equal(result.native, false);
    assert.equal(result.report.mode, "analyze");
    const untouched = await readFile(join(dir, "index.html"), "utf8");
    assert.ok(untouched.includes("hello"));
  } finally {
    if (previous === undefined) delete process.env.GAINE_WATERDROP_BIN;
    else process.env.GAINE_WATERDROP_BIN = previous;
    await rm(dir, { recursive: true, force: true });
  }
});

test("exclude accepts path prefixes in the JS engine (parity with native)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gaine-waterdrop-"));
  const previous = process.env.GAINE_WATERDROP_BIN;
  process.env.GAINE_WATERDROP_BIN = "/definitely/missing/waterdrop";
  try {
    await mkdir(join(dir, "server", "chunks"), { recursive: true });
    await mkdir(join(dir, "static", "chunks"), { recursive: true });
    await writeFile(join(dir, "index.html"), `<script src="/static/chunks/a.js"></script>`);
    await writeFile(join(dir, "static", "chunks", "a.js"), "// c\nvar a = 1;\n");
    await writeFile(join(dir, "server", "chunks", "s.js"), "// c\nvar s = 1;\n");
    await runWaterdrop({
      root: dir,
      outDir: dir,
      exclude: ["server/chunks"],
      js: { minify: "always" },
    });
    assert.ok(!(await readFile(join(dir, "static", "chunks", "a.js"), "utf8")).includes("// c"));
    assert.ok((await readFile(join(dir, "server", "chunks", "s.js"), "utf8")).includes("// c"));
  } finally {
    if (previous === undefined) delete process.env.GAINE_WATERDROP_BIN;
    else process.env.GAINE_WATERDROP_BIN = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
